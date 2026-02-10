// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  modules: [
    [
      '@auth0/auth0-nuxt',
      {
        mountRoutes: true,
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
    public: {
      apiUrl: 'http://localhost:3001', // is overridden by NUXT_PUBLIC_API_URL environment variable
    },
  },
  app: {
    head: {
      title: 'Task0 - A Nuxt Example Application using Auth0',
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
        {
          rel: 'stylesheet',
          href: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
        },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.svg' }
      ],
    },
  },
});
