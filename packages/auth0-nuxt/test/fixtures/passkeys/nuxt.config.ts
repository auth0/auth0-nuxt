import { fileURLToPath } from 'node:url';

// The fixture runs the passkeys example's own app and server code against the module source, with a fake Auth0.
// A `NUXT_AUTH0_*` or `NUXT_PASSKEY_*` variable replaces the matching setting below when the server starts, so the test
// files call `ignoreNuxtEnv()` (test/passkeys.shared.ts) before `setup()`.
const example = fileURLToPath(new URL('../../../../../examples/example-nuxt-passkeys', import.meta.url));
const fake = (name: string) => fileURLToPath(new URL(`./fakes/${name}`, import.meta.url));

export default defineNuxtConfig({
  ssr: true,
  srcDir: `${example}/app`,
  serverDir: `${example}/server`,
  modules: ['../../../src/module'],
  nitro: {
    plugins: [fake('auth0-plugin.ts')],
    handlers: [
      { route: '/__fake/script', method: 'post', handler: fake('auth0-script.post.ts') },
      { route: '/__fake/state', method: 'get', handler: fake('auth0-state.get.ts') },
      { route: '/__fake/session-store', method: 'get', handler: fake('session-store-state.get.ts') },
    ],
  },
  runtimeConfig: {
    auth0: {
      domain: 'example.auth0.local',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      sessionSecret: 'a-very-long-secret-for-tests-1234567890',
      // Every test file passes its own with a port it picked: the Origin check compares with it.
      appBaseUrl: 'http://localhost:3000',
      audience: 'https://api.example.local',
    },
    passkey: {
      realm: 'Username-Password-Authentication',
      clientIpHeader: 'x-forwarded-for',
    },
  },
});
