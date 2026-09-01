export function resolveSafeReturnTo({ search = '', origin, fallback = 'index.html' } = {}) {
  const requested = new URLSearchParams(search).get('returnTo');
  if (!requested || !requested.startsWith('/') || requested.startsWith('//') || !origin) return fallback;

  try {
    const destination = new URL(requested, origin);
    if (destination.origin !== origin) return fallback;
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
