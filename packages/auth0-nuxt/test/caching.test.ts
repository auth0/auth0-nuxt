// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * End-to-end coverage for the SSR user write on cacheable vs non-cacheable routes.
 * Assertions are on the raw server-rendered HTML, not `window.__NUXT__` (the client
 * re-hydrates the user after load).
 */
describe('SSR caching and the user in the payload', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';
  const EMAIL = 'user@example.com';

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

  it('server-renders the user into the raw SSR HTML on a NON-cacheable route', async () => {
    const html: string = await $fetch('/private', {
      headers: { cookie: await sessionCookie() },
    });

    // On a private (no-store) route the user IS server-rendered, so authenticated
    // content is present in the initial HTML without waiting for client hydration.
    expect(html).toContain(SUB);
    expect(html).toContain(EMAIL);
  });

  it('does NOT server-render the user into the raw SSR HTML on a shared-cacheable route', async () => {
    const html: string = await $fetch('/cacheable', {
      headers: { cookie: await sessionCookie() },
    });

    // To guarantee a shared-cacheable route's HTML (which may be reused across visitors)
    // never carries the user, its claims must not appear anywhere in the raw payload. (The
    // `auth0_user` useState *key* is still present in __NUXT_DATA__, but serialized as a
    // null reference — the claims themselves are absent.) The user is hydrated client-side.
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

  it('does NOT server-render the user on a case-variant of a shared-cacheable route (CVE-2026-53721)', async () => {
    // vue-router renders `/cacheable` for a mixed-case request, but Nitro's route-rule
    // matcher is case-sensitive, so an exact-path lookup for `/Cacheable` finds no rule.
    // The guard re-checks the lowercased path, so the user must still be absent.
    const html: string = await $fetch('/Cacheable', {
      headers: { cookie: await sessionCookie() },
    });

    expect(html).not.toContain(SUB);
    expect(html).not.toContain(EMAIL);
    expect(html).toContain('anonymous');
  });
});
