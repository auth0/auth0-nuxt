/** The subset of resolved route rules this decision reads. */
export interface SsrUserRouteRules {
  auth0?: { ssrUser?: boolean };
}

/** The minimal shape of the H3 event this decision needs. */
export interface RequestLike {
  path: string;
  context?: unknown;
}

/**
 * Decides whether the SSR auth middleware should write the authenticated user into
 * `useUser()` — and therefore into the `__NUXT__` payload Nuxt embeds in the rendered HTML.
 *
 * A route opts out with the `auth0: { ssrUser: false }` route rule; `globalSsrUser` supplies
 * the module-level default when a route sets no rule of its own. Opted-out routes render
 * anonymous HTML and are hydrated client-side by the `auth.client` plugin instead.
 *
 * The path is checked as-is and then, if it differs, lowercased. Nitro's route-rule matcher
 * is case-sensitive while vue-router matches case-insensitively, so `/Blog` renders the
 * `/blog` page while dodging `/blog`'s route rule (CVE-2026-53721); the second lookup closes
 * that bypass. It uses a synthetic event with a fresh `context` because Nitro's
 * `getRouteRules` memoizes its result onto `event.context._nitro.routeRules`.
 *
 * Both lookups must agree to write the user, so if `/Blog` sets `ssrUser: true` while `/blog`
 * sets `ssrUser: false`, the opt-out wins. That is the safe direction: where two rules
 * disagree across case variants, keep the user out of the payload.
 *
 * `getRouteRules` is injected rather than imported so this stays unit-testable without a
 * Nitro runtime.
 *
 * @param getRouteRules Nitro's `getRouteRules` server util.
 * @param event The H3 request event (path + context).
 * @param globalSsrUser The module-level default, applied when no route rule sets `auth0.ssrUser`.
 * @returns `true` to write the user during SSR, `false` to keep the HTML anonymous.
 */
export function resolveSsrUser<E extends RequestLike>(
  getRouteRules: (event: E) => SsrUserRouteRules | undefined,
  event: E,
  globalSsrUser: boolean = true
): boolean {
  if (!ssrUserForRules(getRouteRules(event), globalSsrUser)) {
    return false;
  }

  const lowerPath = event.path.toLowerCase();
  if (lowerPath !== event.path) {
    const lowerEvent = { ...event, path: lowerPath, context: {} };
    if (!ssrUserForRules(getRouteRules(lowerEvent), globalSsrUser)) {
      return false;
    }
  }

  return true;
}

/** Resolves the effective `ssrUser` for one set of route rules: rule wins over the default. */
function ssrUserForRules(routeRules: SsrUserRouteRules | undefined, globalSsrUser: boolean): boolean {
  return routeRules?.auth0?.ssrUser ?? globalSsrUser;
}
