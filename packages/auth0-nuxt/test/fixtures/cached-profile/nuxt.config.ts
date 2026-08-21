export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // A site-wide shared-cache rule, which is the idiomatic way to opt everything out at once.
    // Without the module's own `cache: false` on the profile route, Nitro would wrap that
    // handler in `cachedEventHandler` — keying by path without the session cookie and
    // overwriting the handler's `no-store` — and serve one user's claims to the next.
    '/**': { swr: 60, auth0: { ssrUser: false } },
  },
  runtimeConfig: {
    auth0: {
      domain: 'example.auth0.local',
      clientId: '',
      clientSecret: '',
      appBaseUrl: '',
      sessionSecret: '',
    },
  },
});
