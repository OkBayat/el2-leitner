import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { createAuthMiddleware } from "./authMiddleware.js";

function cookieClearOptions(options) {
  const { maxAge: _maxAge, expires: _expires, ...clearOptions } = options;
  return clearOptions;
}

function createAuthRateLimiter(options) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: "AUTH_RATE_LIMITED",
          message: "Too many authentication attempts. Try again later."
        }
      });
    }
  });
}

export function createApiRouter({ useCases, tokenService, authCookie, authRateLimit }) {
  const router = Router();
  const authLimiter = createAuthRateLimiter(authRateLimit);
  const authenticate = createAuthMiddleware({
    tokenService,
    getCurrentUser: useCases.getCurrentUser,
    cookieName: authCookie.name
  });

  router.use((req, res, next) => {
    if (req.path !== "/health") res.set("Cache-Control", "no-store");
    next();
  });

  router.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  router.post("/auth/register", authLimiter, async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await useCases.registerUser.execute({ email, password });
    const token = tokenService.issue(user.id);
    res.cookie(authCookie.name, token, authCookie.options);
    res.status(201).json({ user });
  });

  router.post("/auth/login", authLimiter, async (req, res) => {
    const { email, password } = req.body ?? {};
    const user = await useCases.loginUser.execute({ email, password });
    const token = tokenService.issue(user.id);
    res.cookie(authCookie.name, token, authCookie.options);
    res.status(200).json({ user });
  });

  router.post("/auth/logout", (_req, res) => {
    res.clearCookie(authCookie.name, cookieClearOptions(authCookie.options));
    res.status(204).end();
  });

  router.get("/auth/me", authenticate, (req, res) => {
    res.status(200).json({ user: req.auth.user });
  });

  router.get("/library/vocabulary-sources", authenticate, async (req, res) => {
    const result = await useCases.libraryQueries.vocabularySources(req.auth.user);
    res.status(200).json(result);
  });

  router.get("/library", authenticate, async (req, res) => {
    const result = await useCases.libraryQueries.list(req.auth.user);
    res.status(200).json(result);
  });

  router.post("/library", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.create(req.auth.user, req.body ?? {});
    res.status(201).json(result);
  });

  router.get("/library/:collectionId", authenticate, async (req, res) => {
    const result = await useCases.libraryQueries.get(req.auth.user, req.params.collectionId);
    res.status(200).json(result);
  });

  router.put("/library/:collectionId", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.update(req.auth.user, req.params.collectionId, req.body ?? {});
    res.status(200).json(result);
  });

  router.post("/library/:collectionId/subscription", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.subscribe(req.auth.user, req.params.collectionId);
    res.status(200).json(result);
  });

  router.delete("/library/:collectionId/subscription", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.unsubscribe(req.auth.user, req.params.collectionId);
    res.status(200).json(result);
  });

  router.post("/library/:collectionId/import", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.import(req.auth.user, req.params.collectionId, req.body ?? {});
    res.status(200).json(result);
  });

  router.post("/library/:collectionId/entries", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.addEntry(req.auth.user, req.params.collectionId, req.body ?? {});
    res.status(201).json(result);
  });

  router.put("/library/:collectionId/entries/:entryId", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.updateEntry(
      req.auth.user,
      req.params.collectionId,
      req.params.entryId,
      req.body ?? {}
    );
    res.status(200).json(result);
  });

  router.delete("/library/:collectionId/entries/:entryId", authenticate, async (req, res) => {
    const result = await useCases.libraryCommands.removeEntry(
      req.auth.user,
      req.params.collectionId,
      req.params.entryId
    );
    res.status(200).json(result);
  });

  router.post("/learning/sessions", authenticate, async (req, res) => {
    const result = await useCases.learningSessionCommands.start(req.auth.userId, req.body ?? {});
    res.status(201).json(result);
  });

  router.put("/learning/sessions/:sessionId/complete", authenticate, async (req, res) => {
    const result = await useCases.learningSessionCommands.complete(
      req.auth.userId,
      req.params.sessionId,
      req.body ?? {}
    );
    res.status(200).json(result);
  });

  router.post("/learning/sessions/:sessionId/abandon", authenticate, async (req, res) => {
    const result = await useCases.learningSessionCommands.abandon(
      req.auth.userId,
      req.params.sessionId,
      req.body ?? {}
    );
    res.status(200).json(result);
  });

  router.post("/learning/vocabulary-activations", authenticate, async (req, res) => {
    const result = await useCases.activateVocabulary.execute(req.auth.userId, req.body ?? {});
    res.status(200).json(result);
  });

  router.post("/learning/reviews", authenticate, async (req, res) => {
    const result = await useCases.recordReviewResult.execute(req.auth.userId, req.body ?? {});
    res.status(200).json(result);
  });

  router.get("/state", authenticate, async (req, res) => {
    const result = await useCases.getLearningState.execute(req.auth.userId);
    res.status(200).json(result);
  });

  router.put("/state", authenticate, async (req, res) => {
    const result = await useCases.saveLearningState.execute(
      req.auth.userId,
      req.body?.state,
      req.body?.revision,
      { practiceSessionId: req.get("X-Vocora-Session-Id") || null }
    );
    res.status(200).json(result);
  });

  return router;
}
