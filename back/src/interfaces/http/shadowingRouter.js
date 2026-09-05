import { Router, raw } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createAuthMiddleware } from './authMiddleware.js';

export function createShadowingRouter({ useCases, tokenService, authCookie }) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(createAuthMiddleware({ tokenService, getCurrentUser: useCases.getCurrentUser, cookieName: authCookie.name }));
  router.use(rateLimit({
    windowMs: 60000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false,
    keyGenerator: req => String(req.auth.userId),
    handler: (_req, res) => res.status(429).json({ error: { code: 'SHADOWING_RATE_LIMIT', message: 'Too many speech requests. Wait a moment and try again.' } }),
  }));
  router.post('/sessions', async (req, res) => res.status(201).json(await useCases.shadowingPractice.start(req.auth.userId)));
  router.delete('/sessions/:sessionId', async (req, res) => { await useCases.shadowingPractice.close(req.auth.userId, req.params.sessionId); res.status(204).end(); });
  router.post('/sessions/:sessionId/recordings', async (req, res) => res.status(201).json(await useCases.shadowingPractice.record(req.auth.userId, req.params.sessionId, req.body ?? {})));
  router.post('/sessions/:sessionId/recordings/:id/chunks', raw({ type: 'application/octet-stream', limit: 32000 }), async (req, res) => {
    const sequence = /^\d+$/u.test(String(req.query.sequence)) ? Number(req.query.sequence) : NaN;
    res.json(await useCases.shadowingPractice.chunk(req.auth.userId, req.params.sessionId, req.params.id, sequence, req.body));
  });
  router.post('/sessions/:sessionId/recordings/:id/finish', async (req, res) => res.json(await useCases.shadowingPractice.finish(req.auth.userId, req.params.sessionId, req.params.id)));
  router.delete('/sessions/:sessionId/recordings/:id', async (req, res) => { await useCases.shadowingPractice.cancel(req.auth.userId, req.params.sessionId, req.params.id); res.status(204).end(); });
  return router;
}
