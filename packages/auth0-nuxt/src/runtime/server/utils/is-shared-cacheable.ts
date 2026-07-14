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
 * Detects both Nitro's in-process cache rules (`cache` / `swr` / `isr`) and a
 * `Cache-Control` header route rule that lets a downstream shared cache / CDN store the
 * response — such headers are forwarded to the CDN and are NOT reflected by Nitro's own
 * cache signals. A response is treated as shared-cacheable when the header carries
 * `public`, `s-maxage`, or a positive `max-age`: `max-age` applies to shared caches too,
 * and RFC 9111's authenticated-response restriction covers only the `Authorization`
 * header, not cookies — so a cookie-authenticated `max-age` page can be stored by a
 * path-keyed shared cache. Explicit `private` / `no-store` directives opt the response
 * out and are honored.
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

  // Explicit shared-cache signals win, even alongside a contradictory `private` — some
  // CDNs honor `s-maxage` regardless — so we err toward keeping the payload anonymous.
  if (/(^|[\s,])(public|s-maxage)(\b|=)/i.test(cacheControl)) return true;

  // With no positive shared-cache signal, an explicit opt-out keeps the response out of
  // shared caches entirely; `max-age` (below) then applies only to private caches.
  if (/(^|[\s,])(private|no-store)(\b|=)/i.test(cacheControl)) return false;

  // A bare positive `max-age` is enough for a path-keyed shared cache to store a
  // cookie-authenticated response, so treat it as shared-cacheable.
  const maxAge = cacheControl.match(/(^|[\s,])max-age\s*=\s*(\d+)/i);
  return maxAge !== null && Number(maxAge[2]) > 0;
}
