// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * End-to-end demonstration of issue #52.
 *
 * The authenticated user is carried in an encrypted, stateless session cookie, so
 * `getUser()` resolves entirely offline (no Auth0 network call) — only the session
 * secret and a syntactically valid domain are needed.
 *
 * We assert on the RAW server-rendered HTML (what a shared cache / CDN would store),
 * NOT on `window.__NUXT__` after client hydration. On a non-cacheable route the user's
 * claims appear in the payload (the PII that would leak through a path-keyed CDN); on a
 * shared-cacheable route they must be absent (the fix), with the client hydrating later.
 */
describe('SSR caching and PII in the payload (#52)', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|pii-victim-123';
  const EMAIL = 'victim@example.com';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/caching', import.meta.url)),
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

  it('embeds the authenticated user in the raw SSR HTML on a NON-cacheable route (the leak surface)', async () => {
    const html: string = await $fetch('/private', {
      headers: { cookie: await sessionCookie() },
    });

    // On a private (no-store) route the user IS server-rendered — this is correct,
    // because the response is never stored by a shared cache. It also demonstrates
    // exactly what used to be baked into EVERY route's payload before the fix.
    expect(html).toContain(SUB);
    expect(html).toContain(EMAIL);
  });

  it('does NOT embed the authenticated user in the raw SSR HTML on a shared-cacheable route (the fix)', async () => {
    const html: string = await $fetch('/cacheable', {
      headers: { cookie: await sessionCookie() },
    });

    // The shared-cacheable route's HTML is what a CDN would store and serve to other
    // visitors. It must be anonymous: the user's claims must not appear anywhere in the
    // raw payload. (The `auth0_user` useState *key* is still present in __NUXT_DATA__,
    // but serialized as a null reference — the claims themselves are absent.)
    expect(html).not.toContain(SUB);
    expect(html).not.toContain(EMAIL);
    // The page still renders, just logged-out at SSR time.
    expect(html).toContain('anonymous');
  });

  it('renders cleanly for an anonymous visitor on the cacheable route', async () => {
    const html: string = await $fetch('/cacheable');
    expect(html).not.toContain(SUB);
    expect(html).toContain('anonymous');
  });
});
