// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch, fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * Coverage for controlling the SSR user write. Assertions are on the raw server-rendered
 * HTML rather than `window.__NUXT__`, because the client re-hydrates the user after load and
 * would mask the very thing under test.
 */
describe('SSR user write', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/ssr-user', import.meta.url)),
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
        user: { sub: SUB },
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

  it('server-renders the user by default', async () => {
    const html: string = await $fetch('/private', { headers: { cookie: await sessionCookie() } });
    expect(html).toContain(SUB);
  });

  it('does not server-render the user on an opted-out route', async () => {
    const html: string = await $fetch('/opted-out', { headers: { cookie: await sessionCookie() } });
    expect(html).not.toContain(SUB);
    // The page still renders, and renders as anonymous — the claims are absent rather than the
    // route having failed.
    expect(html).toContain('anonymous');
  });

  it('does not server-render the user on a route in an opted-out subtree', async () => {
    const html: string = await $fetch('/optin/profile', { headers: { cookie: await sessionCookie() } });
    expect(html).not.toContain(SUB);
  });

  it('server-renders the user on a route that opts back in over its subtree', async () => {
    const html: string = await $fetch('/optin/dashboard', { headers: { cookie: await sessionCookie() } });
    expect(html).toContain(SUB);
  });

  it('serves the profile endpoint as no-store', async () => {
    const response = await fetch('/auth/profile', { headers: { cookie: await sessionCookie() } });
    expect(response.headers.get('cache-control')).toBe('no-store');
    const data = await response.json();
    expect(data).toMatchObject({ sub: SUB });
  });
});
