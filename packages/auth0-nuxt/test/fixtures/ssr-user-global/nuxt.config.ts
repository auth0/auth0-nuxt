export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  // Global opt-out via the module option — no route rule needed. Every route's SSR HTML
  // stays anonymous; the user is hydrated client-side.
  auth0: {
    ssrUser: false,
  },
  routeRules: {
    // A non-cacheable route that opts back IN per route, overriding the global opt-out.
    '/optin': { headers: { 'Cache-Control': 'no-store' }, auth0: { ssrUser: true } },
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
