// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch, fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * Coverage for the module-level `ssrUser: false` default, which `ssr-user.test.ts` does not
 * reach: that fixture drives everything from route rules, so nothing there exercises the
 * module option being read at `server/plugins/auth.server.ts` and fed to `resolveSsrUser` as
 * `globalSsrUser`. Both sides of that read are unit-tested; the read itself only shows up in
 * a real server.
 *
 * Assertions are on the raw server-rendered HTML rather than `window.__NUXT__`, because the
 * client re-hydrates the user after load and would mask the very thing under test.
 */
describe('SSR user write, global opt-out via the module option', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';
  const EMAIL = 'user@example.com';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/ssr-user-global', import.meta.url)),
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

  async function sessionCookie(): Promise<string> {
    const encrypted = await encrypt(
      {
        user: { sub: SUB, email: EMAIL },
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

  it('does not server-render the user on a route with no rule of its own', async () => {
    // `/dashboard` has no route rule, so the module option is the only thing keeping it
    // anonymous. The page still renders; the claims are absent rather than the route failing.
    const html: string = await $fetch('/dashboard', { headers: { cookie: await sessionCookie() } });
    expect(html).not.toContain(SUB);
    expect(html).not.toContain(EMAIL);
    expect(html).toContain('anonymous');
  });

  it('server-renders the user on a route that opts back in over the global default', async () => {
    const html: string = await $fetch('/optin', { headers: { cookie: await sessionCookie() } });
    expect(html).toContain(SUB);
  });

  it('still serves the user from the profile endpoint under the global opt-out', async () => {
    // The opt-out only stops the SSR write. Without this, an app that opts out globally would
    // have no way left to learn who the user is.
    const response = await fetch('/auth/profile', { headers: { cookie: await sessionCookie() } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ sub: SUB });
  });
});
