import { describe, it, expect, vi } from 'vitest';
import { isRequestSharedCacheable } from './is-request-shared-cacheable';

/**
 * `isRequestSharedCacheable` is the pure decision the SSR auth middleware delegates to.
 * It is extracted from the middleware so it can be unit-tested directly: the middleware
 * itself is gated behind a literal `import.meta.server` guard (required so the bundler
 * strips the server-only `nitropack/runtime` import from the client build), which the test
 * transform folds to `false` — making the middleware body unreachable under Vitest. Keeping
 * the branching logic here, dependency-injecting `getRouteRules`, sidesteps that entirely.
 */
describe('isRequestSharedCacheable', () => {
  it('returns false when the request path has no cache rules', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    expect(isRequestSharedCacheable(getRouteRules, { path: '/dashboard' })).toBe(false);
  });

  it('returns true when the request path is shared-cacheable', () => {
    const getRouteRules = vi.fn().mockReturnValue({ headers: { 'Cache-Control': 'public, s-maxage=900' } });
    expect(isRequestSharedCacheable(getRouteRules, { path: '/cacheable' })).toBe(true);
  });

  it('fails closed when route rules are unavailable', () => {
    const getRouteRules = vi.fn().mockReturnValue(undefined);
    expect(isRequestSharedCacheable(getRouteRules, { path: '/dashboard' })).toBe(true);
  });

  it('re-checks the lowercased path so a case-variant still matches the rule (CVE-2026-53721)', () => {
    // Nitro's route-rule matcher is case-sensitive while vue-router matches case-insensitively,
    // so `/Cacheable` renders the `/cacheable` page yet an exact-path lookup finds no rule.
    // The decision consults the lowercased path too so the cache rule is still applied.
    const getRouteRules = vi.fn((event: { path: string }) =>
      event.path === '/cacheable' ? { headers: { 'Cache-Control': 'public, s-maxage=900' } } : {}
    );

    expect(isRequestSharedCacheable(getRouteRules, { path: '/Cacheable' })).toBe(true);
  });

  it('queries the lowercased path with a fresh context so getRouteRules recomputes', () => {
    // The second lookup must not reuse the original event's cached `context._nitro.routeRules`.
    const getRouteRules = vi.fn().mockReturnValue({});
    const event = { path: '/Cacheable', context: { _nitro: { routeRules: { cache: {} } } } };

    isRequestSharedCacheable(getRouteRules, event);

    expect(getRouteRules).toHaveBeenCalledTimes(2);
    const secondArg = getRouteRules.mock.calls[1][0];
    expect(secondArg.path).toBe('/cacheable');
    expect(secondArg.context).toEqual({});
  });

  it('does not perform a second lookup when the path is already lowercase', () => {
    const getRouteRules = vi.fn().mockReturnValue({});
    isRequestSharedCacheable(getRouteRules, { path: '/cacheable' });
    expect(getRouteRules).toHaveBeenCalledTimes(1);
  });
});
