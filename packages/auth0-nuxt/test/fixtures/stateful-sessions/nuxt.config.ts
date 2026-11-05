import { fileURLToPath } from 'node:url';

// The fixture runs the app and the server code of examples/example-nuxt-stateful-sessions against the module source, with a
// fake Auth0. A `NUXT_AUTH0_*` variable replaces the matching setting below when the server starts, so the test file calls
// `ignoreNuxtEnv()` (test/passkeys.shared.ts) before `setup()`.
const example = fileURLToPath(new URL('../../../../../examples/example-nuxt-stateful-sessions', import.meta.url));
const fake = (name: string) => fileURLToPath(new URL(`./fakes/${name}`, import.meta.url));

export default defineNuxtConfig({
  ssr: true,
  srcDir: `${example}/app`,
  serverDir: `${example}/server`,
  dir: { public: `${example}/public` },
  // The same setting as the nuxt.config.ts of the example, which this fixture does not load.
  modules: [['../../../src/module', { sessionStoreFactoryPath: `${example}/server/utils/session-store.ts` }]],
  nitro: {
    plugins: [fake('auth0-plugin.ts')],
    handlers: [
      { route: '/__fake/logout-token', method: 'post', handler: fake('logout-token.post.ts') },
      { route: '/__fake/session-store', method: 'get', handler: fake('session-store.get.ts') },
    ],
  },
  runtimeConfig: {
    auth0: {
      domain: 'example.auth0.local',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      sessionSecret: 'a-very-long-secret-for-tests-1234567890',
      // The test file passes its own, with the port it picked.
      appBaseUrl: 'http://localhost:3000',
    },
  },
});
