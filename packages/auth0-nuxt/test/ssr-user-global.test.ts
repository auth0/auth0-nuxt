// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * End-to-end coverage for the module-level `ssrUser: false` global opt-out. Unlike the
 * per-route `auth0.ssrUser` route rule, this needs no route rule — it is the
 * cache-mechanism-agnostic escape hatch. Assertions are on the raw server-rendered HTML.
 */
describe('SSR user write — global opt-out (module option)', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';
  const EMAIL = 'user@example.com';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/ssr-user-global', import.meta.url)),
    nuxtConfig: {
      ssr: true,
      runtimeConfig: {
        auth0: {
          domain: 'example.auth0.com',
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

  it('keeps a non-cacheable route anonymous under the global opt-out (no route rule)', async () => {
    // `/dashboard` is not shared-cacheable and has no route rule of its own, so only the
    // module-level `ssrUser: false` keeps it anonymous.
    const html: string = await $fetch('/dashboard', {
      headers: { cookie: await sessionCookie() },
    });

    expect(html).not.toContain(SUB);
    expect(html).not.toContain(EMAIL);
    expect(html).toContain('anonymous');
  });

  it('server-renders the user on a route opted back in per route, despite the global opt-out', async () => {
    const html: string = await $fetch('/optin', {
      headers: { cookie: await sessionCookie() },
    });

    expect(html).toContain(SUB);
  });
});
