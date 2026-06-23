import { isSharedCacheable, type CacheRouteRules } from './is-shared-cacheable';

/** Minimal shape of the H3 event this decision needs: a request path and a mutable context. */
interface RequestLike {
  path: string;
  context?: unknown;
}

/**
 * Decides whether the SSR response for a request is shared-cacheable — i.e. whether the
 * auth middleware must skip writing the user into the `__NUXT__` payload to keep cached
 * HTML anonymous.
 *
 * Extracted as a pure, dependency-injected function (rather than living inline in the
 * middleware) so it can be unit-tested directly: the middleware is gated behind a literal
 * `import.meta.server` guard — required so the client bundle tree-shakes the server-only
 * `nitropack/runtime` import — which the test transform folds to `false`, making the
 * middleware body unreachable under Vitest.
 *
 * Checks the request path as-is, then re-checks the lowercased path. Nitro's route-rule
 * matcher is case-sensitive but vue-router matches case-insensitively, so a request like
 * `/Cacheable` renders the `/cacheable` page while dodging its route rule (CVE-2026-53721);
 * the lowercased lookup closes that bypass. The second lookup uses a synthetic event with a
 * fresh `context` so `getRouteRules` recomputes rather than returning the cached result.
 *
 * @param getRouteRules Nitro's `getRouteRules` server util (injected for testability).
 * @param event The H3 request event (path + context).
 */
export function isRequestSharedCacheable<E extends RequestLike>(
  getRouteRules: (event: E) => CacheRouteRules | undefined,
  event: E
): boolean {
  if (isSharedCacheable(getRouteRules(event))) {
    return true;
  }

  const lowerPath = event.path.toLowerCase();
  if (lowerPath !== event.path) {
    const lowerEvent = { ...event, path: lowerPath, context: {} };
    if (isSharedCacheable(getRouteRules(lowerEvent))) {
      return true;
    }
  }

  return false;
}
