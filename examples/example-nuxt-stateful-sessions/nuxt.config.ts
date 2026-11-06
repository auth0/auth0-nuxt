// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [
    [
      '@auth0/auth0-nuxt',
      {
        /**
         * Providing a session store factory switches the SDK from the default stateless session
         * (the whole session, encrypted, in a cookie) to a stateful one: the session data is
         * persisted by the store, and the cookie only carries an encrypted reference to it.
         *
         * The factory must default export a function that returns a `SessionStore`.
         * `~~` resolves to the root of the project, so this works with the `app/` directory of Nuxt 4.
         */
        sessionStoreFactoryPath: '~~/server/utils/session-store.ts',
      },
    ],
  ],
  runtimeConfig: {
    auth0: {
      domain: '', // is overridden by NUXT_AUTH0_DOMAIN environment variable
      clientId: '', // is overridden by NUXT_AUTH0_CLIENT_ID environment variable
      clientSecret: '', // is overridden by NUXT_AUTH0_CLIENT_SECRET environment variable
      sessionSecret: '', // is overridden by NUXT_AUTH0_SESSION_SECRET environment variable
      appBaseUrl: 'http://localhost:3000', // is overridden by NUXT_AUTH0_APP_BASE_URL environment variable
      audience: '', // is overridden by NUXT_AUTH0_AUDIENCE environment variable
    },
  },
  app: {
    head: {
      script: [
        {
          src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
          integrity: 'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz',
          crossorigin: 'anonymous',
        },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
          integrity: 'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH',
          crossorigin: 'anonymous',
        },
      ],
    },
  },
});
