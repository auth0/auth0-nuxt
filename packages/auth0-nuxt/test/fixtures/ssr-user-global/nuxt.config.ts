export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  // Global opt-out via the module option, so a route needs no rule of its own to stay
  // anonymous. This is the sibling of the `ssr-user` fixture, which drives the same
  // behaviour entirely from route rules.
  auth0: {
    ssrUser: false,
  },
  routeRules: {
    // Opts back in, overriding the global default. Route rules win over the module option.
    '/optin': { auth0: { ssrUser: true } },
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
