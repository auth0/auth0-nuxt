// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, createPage, url } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * Browser-level coverage: on a shared-cacheable route (anonymous SSR HTML), the `auth.client`
 * plugin fetches `/auth/profile` after hydration and the UI reflects the logged-in user.
 * Needs a real browser to run the client JS, so it can't ride on `$fetch`.
 */
describe('SSR user client hydration', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';
  const EMAIL = 'user@example.com';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/ssr-user', import.meta.url)),
    browser: true,
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
    return encrypt(
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
  }

  it('hydrates the user from /auth/profile on a shared-cacheable route whose SSR HTML is anonymous', async () => {
    // `createPage()` with no path does not navigate, so we can seed the auth cookie on the
    // browser context *before* the first request — mirroring a logged-in visitor.
    const page = await createPage();
    const target = url('/cacheable');
    await page.context().addCookies([{ name: '__a0_session', value: await sessionCookie(), url: target }]);

    await page.goto(target, { waitUntil: 'hydration' });

    // After the client plugin fetches /auth/profile, the account UI reflects the logged-in
    // user — even though the server-rendered HTML for this cacheable route was anonymous.
    await expect.poll(async () => page.getByTestId('user-sub').textContent()).toBe(SUB);

    await page.close();
  });
});
