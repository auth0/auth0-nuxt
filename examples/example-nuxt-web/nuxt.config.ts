// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [
    [
      '@auth0/auth0-nuxt',
      {
        mountRoutes: true,
        /**
         * In case you want to use a custom session store factory, you can specify the path to it here.
         * The session store factory is used to create a session store that is used to store the
         * session data. This is useful if you want to use a custom session store, such as Redis or MongoDB.
         * The session store factory should export a function that returns a session store instance.
         * 
         * If you enable this, ensure to run `docker-compose up` in the `examples/example-nuxt-web` directory
         * to start the Redis server, or change the `nitro.storage.redis` configuration to
         * use a different storage driver.
         * 
         * sessionStoreFactoryPath: '~/server/utils/session-store-factory.ts',
         */
      },
    ],
  ],
  imports: {
    autoImport: true,
  },
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
  nitro: {
    storage: {
      redis: {
        driver: 'redis',
        port: 6379,
        host: "127.0.0.1",
      }
    }
  },
  app: {
    head: {
      script: [
        {
          src: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js',
          integrity:
            'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz',
          crossorigin: 'anonymous',
        },
      ],
      link: [
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css',
          integrity:
            'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH',
          crossorigin: 'anonymous',
        },
      ],
    },
  },
});
