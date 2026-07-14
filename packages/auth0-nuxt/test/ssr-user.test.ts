// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, $fetch } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { encrypt } from './encryption';

/**
 * End-to-end coverage for controlling the SSR user write. Assertions are on the raw
 * server-rendered HTML, not `window.__NUXT__` (the client re-hydrates the user after load).
 */
describe('SSR user write', async () => {
  const SECRET = 'a-sufficiently-long-session-secret-value-1234567890';
  const SUB = 'auth0|user-123';
  const EMAIL = 'user@example.com';

  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/ssr-user', import.meta.url)),
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

  describe('on by default (cache guard + opt-out)', () => {
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

      // A shared-cacheable route's HTML may be reused across visitors, so it stays
      // anonymous: the user's claims must not appear anywhere in the raw payload. (The
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

    it('does NOT server-render the user when the route opts out via auth0.ssrUser=false', async () => {
      // `/opted-out` is NOT shared-cacheable (it is `no-store`), so the cache guard alone
      // would server-render the user. It opts out explicitly with the
      // `routeRules: { auth0: { ssrUser: false } }` rule, which the middleware reads. This
      // gives consumers per-route (and, via `/**`, global) control over the SSR user write.
      const html: string = await $fetch('/opted-out', {
        headers: { cookie: await sessionCookie() },
      });

      expect(html).not.toContain(SUB);
      expect(html).not.toContain(EMAIL);
      expect(html).toContain('anonymous');
    });

    it('does NOT server-render the user on a case-variant of a shared-cacheable route (CVE-2026-53721)', async () => {
      // vue-router renders `/cacheable` for a mixed-case request, but Nitro's route-rule
      // matcher is case-sensitive, so `/Cacheable` would dodge the shared-cacheable rule.
      // The guard re-checks the lowercased path, so the user must still be absent.
      const html: string = await $fetch('/Cacheable', {
        headers: { cookie: await sessionCookie() },
      });

      expect(html).not.toContain(SUB);
      expect(html).not.toContain(EMAIL);
      expect(html).toContain('anonymous');
    });

    it('does NOT server-render the user on a case-variant of an opted-out route (CVE-2026-53721)', async () => {
      // Same bypass as above, but for the explicit opt-out rule: `/Opted-Out` renders the
      // `/opted-out` page while dodging its `auth0.ssrUser=false` rule. The guard re-checks
      // the lowercased path, so the user must still be absent from the SSR HTML.
      const html: string = await $fetch('/Opted-Out', {
        headers: { cookie: await sessionCookie() },
      });

      expect(html).not.toContain(SUB);
      expect(html).not.toContain(EMAIL);
      expect(html).toContain('anonymous');
    });
  });

  describe('off by default with per-route opt-in', () => {
    // The `/optin/**` subtree disables the SSR user write; `/optin/dashboard` opts back in.
    // Nitro merges route rules by specificity, so the more specific `ssrUser: true` wins.
    it('server-renders the user on a route opted back in, despite the subtree opt-out', async () => {
      const html: string = await $fetch('/optin/dashboard', {
        headers: { cookie: await sessionCookie() },
      });

      expect(html).toContain(SUB);
    });

    it('keeps a non-opted route in the subtree anonymous (the opt-out applies)', async () => {
      const html: string = await $fetch('/optin/profile', {
        headers: { cookie: await sessionCookie() },
      });

      expect(html).not.toContain(SUB);
      expect(html).toContain('anonymous');
    });
  });
});
