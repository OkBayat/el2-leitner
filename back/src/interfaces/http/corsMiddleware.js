const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const ALLOWED_HEADERS = 'Content-Type, X-Vocora-Native-Client, X-Vocora-Session-Id';

function isSameOrigin(req, origin) {
  try {
    const parsed = new URL(origin);
    return parsed.host === req.get('host') && parsed.protocol === `${req.protocol}:`;
  } catch {
    return false;
  }
}

export function createCredentialedCors({ allowedOrigins = [] } = {}) {
  const allowed = new Set(allowedOrigins);

  return (req, res, next) => {
    const origin = req.get('origin');
    if (!origin) return next();

    const trusted = allowed.has(origin) || isSameOrigin(req, origin);
    if (!trusted) {
      if (req.method === 'OPTIONS' || !SAFE_METHODS.has(req.method)) {
        return res.status(403).json({
          error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed.' }
        });
      }
      return next();
    }

    res.vary('Origin');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  };
}
