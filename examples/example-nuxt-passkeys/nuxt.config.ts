// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: ['@auth0/auth0-nuxt'],
  css: ['~/assets/css/main.css'],
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
