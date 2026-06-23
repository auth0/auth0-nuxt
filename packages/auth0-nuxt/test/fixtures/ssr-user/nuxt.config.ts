export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // --- SSR user write ON by default (the module default) ---
    // Not shared-cacheable: the user should be server-rendered into the payload.
    '/private': { headers: { 'Cache-Control': 'no-store' } },
    // Shared-cacheable: the cache guard skips the write, so the user must NOT be rendered.
    '/cacheable': { headers: { 'Cache-Control': 'public, s-maxage=900' } },
    // Not shared-cacheable, but opted out explicitly via the `auth0.ssrUser` route rule.
    '/opted-out': { headers: { 'Cache-Control': 'no-store' }, auth0: { ssrUser: false } },

    // --- SSR user write OFF by default for the `/optin` subtree, opted back in per route ---
    // Nitro merges route rules by specificity, so the more specific `ssrUser: true` wins.
    '/optin/**': { auth0: { ssrUser: false } },
    '/optin/dashboard': { auth0: { ssrUser: true } },
  },
  runtimeConfig: {
    auth0: {
      domain: 'example.auth0.com',
      clientId: '',
      clientSecret: '',
      appBaseUrl: '',
      sessionSecret: '',
    },
  },
});
