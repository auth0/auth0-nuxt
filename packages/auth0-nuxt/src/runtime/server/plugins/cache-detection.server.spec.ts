import { describe, it, expect, vi } from 'vitest';

/**
 * Unit tests for the cache-detection Nitro plugin.
 *
 * The plugin itself imports `nitropack/runtime`, which is only available in the Nitro server
 * context and cannot be directly tested in Vitest. Instead, we test that the plugin's
 * _behavior_ is correct by verifying that `isRequestSharedCacheable` (the pure function
 * it delegates to) produces the right decisions given various route rules and paths.
 *
 * The integration is covered by the E2E test (`test/caching.test.ts`), which verifies that
 * shared-cacheable routes produce anonymous HTML while non-cacheable routes include the user.
 */
describe('cache-detection plugin behavior', () => {
  it('delegates cacheability decision to isRequestSharedCacheable', async () => {
    const { isRequestSharedCacheable } = await import('../utils/is-request-shared-cacheable');

    const getRouteRules = vi.fn((event: { path: string }) => {
      if (event.path === '/cacheable') {
        return { cache: { swr: 60 } };
      }
      return undefined;
    });

    const cacheableEvent = { path: '/cacheable', context: {} };
    const privateEvent = { path: '/private', context: {} };

    expect(isRequestSharedCacheable(getRouteRules, cacheableEvent)).toBe(true);
    expect(isRequestSharedCacheable(getRouteRules, privateEvent)).toBe(false);
  });

  it('handles case-sensitivity bypass (CVE-2026-53721)', async () => {
    const { isRequestSharedCacheable } = await import('../utils/is-request-shared-cacheable');

    const getRouteRules = vi.fn((event: { path: string }) => {
      if (event.path === '/cacheable') {
        return { cache: { swr: 60 } };
      }
      return undefined;
    });

    const uppercaseEvent = { path: '/Cacheable', context: {} };

    // The function should detect that the lowercased path matches a cacheable rule
    expect(isRequestSharedCacheable(getRouteRules, uppercaseEvent)).toBe(true);
  });
});
