export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // Default: the user IS server-rendered into the payload.
    '/private': {},
    // Opted out explicitly: the HTML must stay anonymous.
    '/opted-out': { auth0: { ssrUser: false } },
    // Subtree opted out, with one route opted back in. Nitro merges route rules by
    // specificity, so the more specific `ssrUser: true` wins for /optin/dashboard.
    '/optin/**': { auth0: { ssrUser: false } },
    '/optin/dashboard': { auth0: { ssrUser: true } },
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
