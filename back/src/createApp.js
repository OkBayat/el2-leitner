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

function setNoStoreHeaders(res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function setStaticCacheHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath).toLowerCase();
  if (extension === ".html" || extension === ".css" || extension === ".js" || filename === "manifest.webmanifest") {
    // A mixed frontend release is more damaging than the bandwidth saved by
    // caching executable assets. Keep browser/CDN behavior deterministic.
    setNoStoreHeaders(res);
  }
  if (filename === "service-worker.js") {
    res.setHeader("Service-Worker-Allowed", "/");
  }
  if (filename === "manifest.webmanifest") {
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
  }
}

function isHtmlNavigationRequest(req) {
  if (req.method !== "GET") return false;
  const extension = path.extname(req.path).toLowerCase();
  if (extension && extension !== ".html") return false;
  return Boolean(req.accepts("html"));
}

function resolveSpaIndex(staticDirectory) {
  const candidates = [
    path.join(staticDirectory, "index.html"),
    // Angular source trees keep the HTML shell under src/. Production Docker
    // copies dist/browser into staticDirectory, so the first candidate wins in
    // production while tests/dev tooling can still exercise SPA fallback.
    path.join(staticDirectory, "src", "index.html")
  ];
  return candidates.find((candidate) => existsSync(candidate)) || null;
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
      authRateLimit: container.authRateLimit,
      listeningAudioDirectory: container.listeningAudioDirectory
    })
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found." } });
  });

  if (staticDirectory && existsSync(staticDirectory)) {
    const spaIndex = resolveSpaIndex(staticDirectory);
    app.use(express.static(staticDirectory, { index: "index.html", setHeaders: setStaticCacheHeaders }));
    if (spaIndex) {
      app.use((req, res, next) => {
        if (!isHtmlNavigationRequest(req)) return next();
        setNoStoreHeaders(res);
        res.sendFile(spaIndex, (error) => {
          if (error) next(error);
        });
      });
    }
  }

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Resource not found." } });
  });

  app.use(createErrorHandler({ logger, nodeEnv }));
  return app;
}
