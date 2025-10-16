// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, createPage } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

describe('auth.server middleware', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    nuxtConfig: {
      ssr: true,
      runtimeConfig: {
        auth0: {
          domain: '<domain>',
          clientId: '<client_id>',
          clientSecret: '<client_secret>',
          sessionSecret: '<secret>',
          appBaseUrl: 'http://127.0.0.1:3001',
        },
      },
    },
  });

  it('should populate the session on server-side render and expose it with the useUser hook', async () => {
    const encryptedSession = await encrypt(
      {
        user: { sub: '<sub>' },
        idToken: '<id_token>',
        refreshToken: '<refresh_token>',
        tokenSets: [],
        internal: { sid: '<sid>', createdAt: 1 },
      },
      '<secret>',
      '__a0_session',
      Date.now() / 1000
    );

    const page = await createPage('/', {
      storageState: {
        cookies: [
          {
            name: '__a0_session',
            value: encryptedSession,
            domain: '127.0.0.1',
            sameSite: 'Lax',
            secure: false,
            httpOnly: true,
            path: '/',
            expires: Math.floor((Date.now() + 3600000) / 1000), // 1 hour
          },
        ],
        origins: [],
      },
    });

    // The middleware should have run and populated the session.
    // The `app.vue` in the test fixture displays the logout link if the session is populated.
    const logoutLink = await page.getByTestId('logout-link');
    expect(await logoutLink.isVisible()).toBe(true);
  });
});
