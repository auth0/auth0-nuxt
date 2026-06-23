import { isSharedCacheable, type CacheRouteRules } from './is-shared-cacheable';

/** Resolved route rules this decision inspects: cache signals plus the `auth0` opt-out key. */
type SkipRouteRules = (CacheRouteRules & { auth0?: { ssrUser?: boolean } }) | undefined;

/** Minimal shape of the H3 event this decision needs: a request path and a mutable context. */
interface RequestLike {
  path: string;
  context?: unknown;
}

/**
 * Decides, for a given set of resolved route rules, whether the SSR user write must be
 * skipped: when the route opts out explicitly (`auth0: { ssrUser: false }`) or is
 * shared-cacheable. In both cases the SSR HTML stays anonymous and the user is hydrated
 * client-side by the `auth.client` plugin.
 */
function shouldSkipForRules(routeRules: SkipRouteRules): boolean {
  if (routeRules?.auth0?.ssrUser === false) {
    return true;
  }
  return isSharedCacheable(routeRules);
}

/**
 * Decides whether the SSR auth middleware must skip writing the user into the `__NUXT__`
 * payload for a request — because the route opts out (`auth0: { ssrUser: false }`) or is
 * shared-cacheable.
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
 * the lowercased lookup closes that bypass for both the cache guard and the opt-out. The
 * second lookup uses a synthetic event with a fresh `context` so `getRouteRules` recomputes
 * rather than returning the cached result.
 *
 * @param getRouteRules Nitro's `getRouteRules` server util (injected for testability).
 * @param event The H3 request event (path + context).
 */
export function shouldSkipSsrUserWrite<E extends RequestLike>(
  getRouteRules: (event: E) => SkipRouteRules,
  event: E
): boolean {
  if (shouldSkipForRules(getRouteRules(event))) {
    return true;
  }

  const lowerPath = event.path.toLowerCase();
  if (lowerPath !== event.path) {
    const lowerEvent = { ...event, path: lowerPath, context: {} };
    if (shouldSkipForRules(getRouteRules(lowerEvent))) {
      return true;
    }
  }

  return false;
}
