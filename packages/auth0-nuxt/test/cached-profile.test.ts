// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * The profile endpoint returns the current user's claims, so it must never be shared-cached.
 * Its own `Cache-Control: no-store` is not sufficient on its own: Nitro wraps any handler whose
 * route rules carry `cache` in `cachedEventHandler`, which keys entries by path (the session
 * cookie is not part of the key) and overwrites the handler's `cache-control` with its own.
 *
 * This fixture applies `'/**': { swr: 60 }`, the idiomatic site-wide opt-out, which is exactly
 * the configuration that would trigger that wrapping. The module counters it with
 * `extendRouteRules(routes.profile, { cache: false })`.
 */
describe('profile endpoint under a site-wide cache rule', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const FIRST_SUB = 'auth0|user-first';
  const SECOND_SUB = 'auth0|user-second';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/cached-profile', import.meta.url)),
    nuxtConfig: {
      ssr: true,
      runtimeConfig: {
        auth0: {
          domain: 'example.auth0.local',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          sessionSecret: SECRET,
          appBaseUrl: 'http://127.0.0.1:3003',
        },
      },
    },
  });

  async function sessionCookie(sub: string): Promise<string> {
    const encrypted = await encrypt(
      {
        user: { sub },
        idToken: '<id_token>',
        refreshToken: '<refresh_token>',
        tokenSets: [],
        internal: { sid: '<sid>', createdAt: 1 },
      },
      SECRET,
      '__a0_session',
      Date.now() / 1000 + 3600
    );
    return `__a0_session=${encrypted}`;
  }

  it('keeps no-store instead of the wildcard rule\'s cache-control', async () => {
    const response = await fetch('/auth/profile', { headers: { cookie: await sessionCookie(FIRST_SUB) } });

    expect(response.headers.get('cache-control')).toBe('no-store');
    // Nitro's cache wrapper would replace `no-store` with an `s-maxage`/`stale-while-revalidate`
    // pair, and would add its own validators.
    expect(response.headers.get('cache-control')).not.toContain('s-maxage');
    expect(response.headers.get('cache-control')).not.toContain('stale-while-revalidate');
  });

  it('does not serve one session\'s claims to another', async () => {
    const first = await fetch('/auth/profile', { headers: { cookie: await sessionCookie(FIRST_SUB) } });
    expect(await first.json()).toMatchObject({ sub: FIRST_SUB });

    // Same path, different session. A path-keyed cache entry would return FIRST_SUB here.
    const second = await fetch('/auth/profile', { headers: { cookie: await sessionCookie(SECOND_SUB) } });
    expect(await second.json()).toMatchObject({ sub: SECOND_SUB });
  });

  it('does not serve a logged-in user\'s claims to an anonymous visitor', async () => {
    const authenticated = await fetch('/auth/profile', { headers: { cookie: await sessionCookie(FIRST_SUB) } });
    expect(await authenticated.json()).toMatchObject({ sub: FIRST_SUB });

    const anonymous = await fetch('/auth/profile');
    expect(anonymous.headers.get('cache-control')).toBe('no-store');
    expect(await anonymous.text()).not.toContain(FIRST_SUB);
  });
});
