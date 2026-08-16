import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { createApiRouter } from "./interfaces/http/apiRouter.js";
import { createErrorHandler } from "./interfaces/http/errorHandler.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_STATIC_DIRECTORY = path.resolve(currentDirectory, "../../ui");

function setStaticCacheHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  } else if (extension === ".css" || extension === ".js") {
    res.setHeader("Cache-Control", "no-cache, max-age=0, must-revalidate");
  }
}

function isHtmlNavigationRequest(req) {
  if (req.method !== "GET") return false;
  const extension = path.extname(req.path).toLowerCase();
  if (extension && extension !== ".html") return false;
  return Boolean(req.accepts("html"));
}

function installOriginTiming(req, res, next) {
  const startedAt = performance.now();
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (!res.headersSent) {
      const durationMs = Math.max(0, performance.now() - startedAt);
      const formattedDuration = durationMs.toFixed(1);
      const existingTiming = res.getHeader("Server-Timing");
      const vocoraTiming = `vocora;dur=${formattedDuration}`;
      res.setHeader(
        "Server-Timing",
        existingTiming ? `${existingTiming}, ${vocoraTiming}` : vocoraTiming
      );
      res.setHeader("X-Vocora-Origin-Ms", formattedDuration);
      res.setHeader("X-Vocora-Request-Bytes", req.get("content-length") || "0");
    }
    return originalJson(payload);
  };

  next();
}

export function createApp({
  container,
  staticDirectory = DEFAULT_STATIC_DIRECTORY,
  logger = console,
  nodeEnv = "development",
  trustProxy = false
}) {
  const app = express();

  if (trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(installOriginTiming);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // The documented Docker deployment is HTTP on localhost. Browsers
          // (notably Safari) may otherwise rewrite it to unavailable HTTPS.
          "upgrade-insecure-requests": null
        }
      }
    })
  );
  app.use(express.json({ limit: "10mb", strict: true }));
  app.use(cookieParser());

  app.use(
    "/api",
    createApiRouter({
      useCases: container.useCases,
      tokenService: container.tokenService,
      authCookie: container.authCookie,
      authRateLimit: container.authRateLimit
    })
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found." } });
  });

  if (staticDirectory && existsSync(staticDirectory)) {
    app.use(express.static(staticDirectory, { index: "index.html", setHeaders: setStaticCacheHeaders }));
    app.use((req, res, next) => {
      if (!isHtmlNavigationRequest(req)) return next();
      res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.set("CDN-Cache-Control", "no-store");
      res.set("Surrogate-Control", "no-store");
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.sendFile(path.join(staticDirectory, "index.html"), (error) => {
        if (error) next(error);
      });
    });
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found." } });
  });

  app.use(createErrorHandler({ logger, nodeEnv }));
  return app;
}
