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
export const FRONTEND_RELEASE = "20260808-enter-router2";

const NO_STORE_VALUE = "private, no-store, no-cache, max-age=0, s-maxage=0, must-revalidate, proxy-revalidate";
const NO_STORE_EXTENSIONS = new Set([".html", ".css", ".js", ".json", ".webmanifest"]);

function setNoStoreHeaders(res, { clearBrowserCache = false } = {}) {
  res.setHeader("Cache-Control", NO_STORE_VALUE);
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Surrogate-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Vocora-Release", FRONTEND_RELEASE);
  if (clearBrowserCache) res.setHeader("Clear-Site-Data", '"cache"');
}

function setStaticCacheHeaders(res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (NO_STORE_EXTENSIONS.has(extension)) {
    setNoStoreHeaders(res, { clearBrowserCache: extension === ".html" });
  }
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
      setHeaders: setStaticCacheHeaders
    }));
    app.use((req, res, next) => {
      if (!isHtmlNavigationRequest(req)) return next();
      setNoStoreHeaders(res, { clearBrowserCache: true });
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
