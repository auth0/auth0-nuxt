import { describe, it, expect, vi } from 'vitest';
import { shouldSkipSsrUserWrite } from './should-skip-ssr-user-write';

/**
 * `shouldSkipSsrUserWrite` is the pure decision the SSR auth middleware delegates to: skip
 * the write when the route opts out (`auth0: { ssrUser: false }`) or is shared-cacheable.
 * It is extracted from the middleware so it can be unit-tested directly: the middleware
 * itself is gated behind a literal `import.meta.server` guard (required so the bundler
 * strips the server-only `nitropack/runtime` import from the client build), which the test
 * transform folds to `false` — making the middleware body unreachable under Vitest. Keeping
 * the branching logic here, dependency-injecting `getRouteRules`, sidesteps that entirely.
 */
describe('shouldSkipSsrUserWrite', () => {
  it('returns false when the request path has no cache rules and no opt-out', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' })).toBe(false);
  });

  it('returns true when the request path is shared-cacheable', () => {
    const getRouteRules = vi.fn().mockReturnValue({ headers: { 'Cache-Control': 'public, s-maxage=900' } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/cacheable' })).toBe(true);
  });

  it('returns true when the route opts out via auth0.ssrUser=false (even when not cacheable)', () => {
    const getRouteRules = vi.fn().mockReturnValue({ auth0: { ssrUser: false } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/opted-out' })).toBe(true);
  });

  it('returns false when the route explicitly opts in via auth0.ssrUser=true', () => {
    const getRouteRules = vi.fn().mockReturnValue({ auth0: { ssrUser: true } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' })).toBe(false);
  });

  it('fails closed when route rules are unavailable', () => {
    const getRouteRules = vi.fn().mockReturnValue(undefined);
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' })).toBe(true);
  });

  it('skips the write when the global option opts out (no route rule needed)', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' }, false)).toBe(true);
  });

  it('lets a per-route opt-in override a global opt-out', () => {
    const getRouteRules = vi.fn().mockReturnValue({ auth0: { ssrUser: true } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' }, false)).toBe(false);
  });

  it('lets a per-route opt-out apply even when the global default opts in', () => {
    const getRouteRules = vi.fn().mockReturnValue({ auth0: { ssrUser: false } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/opted-out' }, true)).toBe(true);
  });

  it('still skips a shared-cacheable route when the global option opts in (guard is not overridable)', () => {
    const getRouteRules = vi.fn().mockReturnValue({ headers: { 'Cache-Control': 'public, s-maxage=900' } });
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/cacheable' }, true)).toBe(true);
  });

  it('writes the user when both the global option and route opt in and the route is not cacheable', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/dashboard' }, true)).toBe(false);
  });

  it('re-checks the lowercased path so a case-variant still matches a cache rule (CVE-2026-53721)', () => {
    // Nitro's route-rule matcher is case-sensitive while vue-router matches case-insensitively,
    // so `/Cacheable` renders the `/cacheable` page yet an exact-path lookup finds no rule.
    // The decision consults the lowercased path too so the cache rule is still applied.
    const getRouteRules = vi.fn((event: { path: string }) =>
      event.path === '/cacheable' ? { headers: { 'Cache-Control': 'public, s-maxage=900' } } : {}
    );

    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/Cacheable' })).toBe(true);
  });

  it('re-checks the lowercased path so a case-variant still matches the opt-out (CVE-2026-53721)', () => {
    const getRouteRules = vi.fn((event: { path: string }) =>
      event.path === '/opted-out' ? { auth0: { ssrUser: false } } : {}
    );

    expect(shouldSkipSsrUserWrite(getRouteRules, { path: '/Opted-Out' })).toBe(true);
  });

  it('queries the lowercased path with a fresh context so getRouteRules recomputes', () => {
    // The second lookup must not reuse the original event's cached `context._nitro.routeRules`.
    const getRouteRules = vi.fn().mockReturnValue({});
    const event = { path: '/Cacheable', context: { _nitro: { routeRules: { cache: {} } } } };

    shouldSkipSsrUserWrite(getRouteRules, event);

    expect(getRouteRules).toHaveBeenCalledTimes(2);
    const secondArg = getRouteRules.mock.calls[1][0];
    expect(secondArg.path).toBe('/cacheable');
    expect(secondArg.context).toEqual({});
  });

  it('does not perform a second lookup when the path is already lowercase', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    shouldSkipSsrUserWrite(getRouteRules, { path: '/cacheable' });
    expect(getRouteRules).toHaveBeenCalledTimes(1);
  });
});
