export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // SSR user write OFF everywhere by default...
    '/**': { auth0: { ssrUser: false } },
    // ...but opted back IN on this specific route. Nitro merges route rules by
    // specificity, so the more specific `ssrUser: true` wins for `/opted-in`.
    '/opted-in': { auth0: { ssrUser: true } },
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
