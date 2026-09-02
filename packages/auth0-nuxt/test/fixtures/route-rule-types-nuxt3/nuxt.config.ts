// Mirror of `../route-rule-types/nuxt.config.ts` for Nuxt 3. Keep the two in step: the only
// intended difference between the fixtures is which `nuxt` their root directory resolves.
export default defineNuxtConfig({
  modules: ['../../../src/module'],
  routeRules: {
    // The documented override. This is the whole point of the module's type template: it must
    // typecheck in a consumer's config without the consumer declaring anything themselves.
    '/private/**': { headers: { 'Cache-Control': 'no-store' }, auth0: { ssrUser: true } },
    '/blog/**': { swr: 3600, auth0: { ssrUser: false } },

    // The negative case. If the template ever widened `NitroRouteConfig` instead of adding one
    // key — or if excess-property checking stopped applying here — this directive would go
    // unused and TypeScript would fail the build, which is what we want it to do.
    // @ts-expect-error: `nope` is not a known route-rule key
    '/bogus': { nope: { x: 1 } },
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
