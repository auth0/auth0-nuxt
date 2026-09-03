export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  // The combination from the report: no module-owned routes, and SSR never writes the user, so
  // the client plugin fetches `/auth/profile` on every anonymous page load.
  auth0: {
    mountRoutes: false,
    ssrUser: false,
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
