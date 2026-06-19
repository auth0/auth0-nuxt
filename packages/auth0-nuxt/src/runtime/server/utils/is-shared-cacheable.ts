/**
 * Subset of the resolved Nitro route rules this predicate inspects. Declared
 * structurally (rather than importing `NitroRouteRules`) because the resolved type
 * does not surface `swr` / `isr` — Nitro normalizes those into `cache` at config time —
 * yet we still defensively check them in case an unresolved config object is passed.
 */
export interface CacheRouteRules {
  cache?: unknown;
  swr?: unknown;
  isr?: unknown;
  headers?: Record<string, string>;
}

/**
 * Determines whether a route's resolved Nitro route rules make its response
 * shareable across users by a downstream shared cache / CDN.
 *
 * Returns `true` (treat as cacheable) when route rules are unavailable, so callers
 * fail closed: when in doubt, keep the SSR payload anonymous and hydrate on the client.
 *
 * Detects both Nitro's in-process cache rules (`cache` / `swr` / `isr`) and a bare
 * `Cache-Control` header route rule containing `public` or `s-maxage` — the latter is
 * forwarded to the downstream CDN and is NOT reflected by Nitro's own cache signals.
 */
export function isSharedCacheable(routeRules: CacheRouteRules | undefined): boolean {
  if (!routeRules) return true;
  if (routeRules.cache || routeRules.swr || routeRules.isr) return true;

  const headers = routeRules.headers ?? {};
  let cacheControl = '';
  for (const key in headers) {
    if (key.toLowerCase() === 'cache-control') {
      cacheControl = headers[key] ?? '';
      break;
    }
  }

  return /(^|[\s,])(public|s-maxage)(\b|=)/i.test(cacheControl);
}
