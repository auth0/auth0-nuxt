export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  routeRules: {
    // Not shared-cacheable: the user should be server-rendered into the payload.
    '/private': { headers: { 'Cache-Control': 'no-store' } },
    // Shared-cacheable: the user must NOT be written into the SSR payload.
    '/cacheable': { headers: { 'Cache-Control': 'public, s-maxage=900' } },
    // Not shared-cacheable, but the SSR user write is opted out per route via the
    // `auth0.ssrUser` route rule, so the user must NOT be server-rendered.
    '/opted-out': { headers: { 'Cache-Control': 'no-store' }, auth0: { ssrUser: false } },
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
