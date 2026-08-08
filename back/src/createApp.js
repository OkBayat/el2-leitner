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
  res.setHeader("Cache-Control", "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function setStaticCacheHeaders(res) {
  // Vocora is currently deployed as a frequently changing application shell.
  // Do not let the browser, an intermediary proxy, or the CDN mix JavaScript,
  // CSS, HTML, fonts, or images from different releases.
  setNoStoreHeaders(res);
}

function isHtmlNavigationRequest(req) {
  if (req.method !== "GET") return false;
  const extension = path.extname(req.path).toLowerCase();
  if (extension && extension !== ".html") return false;
  return Boolean(req.accepts("html"));
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
    app.use(express.static(staticDirectory, {
      index: "index.html",
      etag: false,
      lastModified: false,
      cacheControl: false,
      setHeaders: setStaticCacheHeaders
    }));
    app.use((req, res, next) => {
      if (!isHtmlNavigationRequest(req)) return next();
      setNoStoreHeaders(res);
      res.sendFile(path.join(staticDirectory, "index.html"), {
        etag: false,
        lastModified: false,
        cacheControl: false
      }, (error) => {
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
