import { describe, it, expect, vi } from 'vitest';
import { resolveSsrUser } from './resolve-ssr-user';

/** A fake `getRouteRules` that resolves rules from a path map, like Nitro's matcher. */
function rulesFor(map: Record<string, unknown>) {
  return vi.fn((event: { path: string }) => map[event.path] as never);
}

describe('resolveSsrUser', () => {
  it('writes the user when no route rules match', () => {
    expect(resolveSsrUser(rulesFor({ '/x': {} }), { path: '/x' })).toBe(true);
  });

  it('writes the user when route rules are undefined', () => {
    expect(resolveSsrUser(rulesFor({}), { path: '/x' })).toBe(true);
  });

  it('skips the user when the route opts out', () => {
    const rules = rulesFor({ '/x': { auth0: { ssrUser: false } } });
    expect(resolveSsrUser(rules, { path: '/x' })).toBe(false);
  });

  it('skips the user when the module default is off and no rule overrides it', () => {
    expect(resolveSsrUser(rulesFor({ '/x': {} }), { path: '/x' }, false)).toBe(false);
  });

  it('lets a route opt back in over a module default of off', () => {
    const rules = rulesFor({ '/x': { auth0: { ssrUser: true } } });
    expect(resolveSsrUser(rules, { path: '/x' }, false)).toBe(true);
  });

  it('honours a lowercase route rule for a mixed-case path (CVE-2026-53721)', () => {
    // vue-router renders /blog for /Blog, but Nitro's matcher is case-sensitive,
    // so only the lowercased lookup finds the opt-out.
    const rules = rulesFor({ '/blog': { auth0: { ssrUser: false } } });
    expect(resolveSsrUser(rules, { path: '/Blog' })).toBe(false);
  });

  it('passes a fresh context on the lowercased lookup so Nitro recomputes', () => {
    const rules = rulesFor({ '/blog': { auth0: { ssrUser: false } } });
    resolveSsrUser(rules, { path: '/Blog', context: { _nitro: { routeRules: {} } } });
    expect(rules).toHaveBeenLastCalledWith(expect.objectContaining({ path: '/blog', context: {} }));
  });

  it('does not look up twice when the path is already lowercase', () => {
    const rules = rulesFor({ '/x': {} });
    resolveSsrUser(rules, { path: '/x' });
    expect(rules).toHaveBeenCalledTimes(1);
  });

  it('does not look up twice when the original path already opted out', () => {
    const rules = rulesFor({ '/X': { auth0: { ssrUser: false } } });
    resolveSsrUser(rules, { path: '/X' });
    expect(rules).toHaveBeenCalledTimes(1);
  });
});
