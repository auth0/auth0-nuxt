// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * Inverse of the opt-out model: the SSR user write is disabled globally with
 * `routeRules: { '/**': { auth0: { ssrUser: false } } }`, then opted back in on
 * specific routes with `{ auth0: { ssrUser: true } }`. This relies on Nitro merging
 * overlapping route rules by specificity (the more specific `ssrUser: true` wins), so it
 * is covered here to guard against that behaviour regressing.
 */
describe('global opt-out with per-route opt-in (#52)', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|optin-user-1';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/optin', import.meta.url)),
    nuxtConfig: {
      ssr: true,
      runtimeConfig: {
        auth0: {
          domain: 'example.auth0.com',
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          sessionSecret: SECRET,
          appBaseUrl: 'http://127.0.0.1:3021',
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

  it('server-renders the user on a route opted back in, despite the global opt-out', async () => {
    const html: string = await $fetch('/opted-in', {
      headers: { cookie: await sessionCookie() },
    });

    expect(html).toContain(SUB);
  });

  it('keeps a non-opted route anonymous (the global opt-out applies)', async () => {
    const html: string = await $fetch('/default', {
      headers: { cookie: await sessionCookie() },
    });

    expect(html).not.toContain(SUB);
    expect(html).toContain('anonymous');
  });
});
