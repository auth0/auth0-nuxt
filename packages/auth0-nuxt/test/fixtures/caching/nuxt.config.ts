export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // Not shared-cacheable: the user should be server-rendered into the payload.
    '/private': { headers: { 'Cache-Control': 'no-store' } },
    // Shared-cacheable: the user must NOT be written into the SSR payload.
    '/cacheable': { headers: { 'Cache-Control': 'public, s-maxage=900' } },
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
