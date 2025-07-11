export default defineNuxtConfig({
  ssr: true,
  modules: ['../../../src/module'],
  runtimeConfig: {
    auth0: {
      domain: '',
      clientId: '',
      clientSecret: '',
    },
  },
});
