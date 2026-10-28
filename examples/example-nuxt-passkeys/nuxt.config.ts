// `nuxt dev` refuses a request whose `Host` header is not `localhost` or an IP address, and the reverse proxy of the README
// forwards the hostname of the app. So the dev server must accept the host of NUXT_AUTH0_APP_BASE_URL. A production build
// has no such check.
const appBaseUrl = process.env.NUXT_AUTH0_APP_BASE_URL ?? '';
const appHost = URL.canParse(appBaseUrl) ? new URL(appBaseUrl).hostname : '';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: ['@auth0/auth0-nuxt'],
  css: ['~/assets/css/main.css'],
  vite: {
    server: { allowedHosts: appHost ? [appHost] : [] },
  },
  // Nitro runs a route that a `cache` or `swr` rule matches without the headers and cookies of the request, and it replaces
  // the Cache-Control header of the route. A broad rule of the app (for example '/**': { swr: 60 }) would make these routes
  // answer 403 to every client, with a header that lets a CDN cache that answer. So keep them out of every cache rule.
  routeRules: {
    '/api/passkey/**': { cache: false },
  },
  runtimeConfig: {
    auth0: {
      domain: '', // is overridden by NUXT_AUTH0_DOMAIN environment variable
      clientId: '', // is overridden by NUXT_AUTH0_CLIENT_ID environment variable
      clientSecret: '', // is overridden by NUXT_AUTH0_CLIENT_SECRET environment variable
      sessionSecret: '', // is overridden by NUXT_AUTH0_SESSION_SECRET environment variable
      appBaseUrl: '', // is overridden by NUXT_AUTH0_APP_BASE_URL environment variable (the module refuses to start without it)
      audience: '', // is overridden by NUXT_AUTH0_AUDIENCE environment variable
    },
    // Private settings (server only) of the passkey routes in server/api/passkey.
    passkey: {
      realm: '', // is overridden by NUXT_PASSKEY_REALM: the database connection. Empty means the Default Directory.
      clientIpHeader: '', // is overridden by NUXT_PASSKEY_CLIENT_IP_HEADER: for example x-forwarded-for (see the README)
    },
  },
});
