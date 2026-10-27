// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { setup } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { FLOW_COOKIE, auth0Config, createClient, freePort, ignoreNuxtEnv, newUser } from './passkeys.shared';

// An app with a broad Nitro cache rule. Nitro runs a route that such a rule matches without the headers and cookies of the
// request, and it replaces the Cache-Control header of the route. So the Origin check would answer 403 to every client, with
// a header that lets a CDN cache that answer. The example keeps its routes out of every cache rule in its nuxt.config.ts.
// This test reads those rules from that file, so it fails when the example drops them.
ignoreNuxtEnv();
const port = await freePort();
const origin = `http://localhost:${port}`;
const app = createClient(origin);

/** The `routeRules` of nuxt.config.ts of the example. */
async function exampleRouteRules() {
  vi.stubGlobal('defineNuxtConfig', (config: unknown) => config);
  try {
    const { default: config } = await import('../../../examples/example-nuxt-passkeys/nuxt.config');
    return config.routeRules ?? {};
  } finally {
    vi.unstubAllGlobals();
  }
}

describe('passkeys example: an app with a broad cache rule', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/passkeys', import.meta.url)),
    port,
    nuxtConfig: {
      // The broad rule of the app comes first, then the rules of the example.
      routeRules: { '/**': { cache: { swr: true, maxAge: 60 } }, ...(await exampleRouteRules()) },
      runtimeConfig: { auth0: auth0Config(origin) },
    },
  });

  it('I1: a login start still reaches Auth0 for each client, and the answer says no-store', async () => {
    const first = newUser();
    const second = newUser();

    const a = await app.call(first, '/api/passkey/login/start', { body: {} });
    const b = await app.call(second, '/api/passkey/login/start', { body: {} });

    expect([a.status, b.status]).toEqual([200, 200]);
    expect([a.headers.get('cache-control'), b.headers.get('cache-control')]).toEqual(['no-store', 'no-store']);
    expect(a.json.authnParamsPublicKey?.challenge).not.toBe(b.json.authnParamsPublicKey?.challenge);
    expect([first.jar.has(FLOW_COOKIE), second.jar.has(FLOW_COOKIE)]).toEqual([true, true]);
  });

  it('I2: a signup start answers each client with its own data', async () => {
    const a = await app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'alice@example.com' } });
    const b = await app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'bob@example.com' } });

    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.text).toContain('alice@example.com');
    expect(b.text).toContain('bob@example.com');
    expect(b.text).not.toContain('alice@example.com');
  });

  it('I3: a request that the guard refuses says no-store too, and is not served to the next valid request', async () => {
    // The guard sets `no-store` before its Origin check, so this is a different path from the two 200 answers above.
    const foreign = await app.call(newUser(), '/api/passkey/login/start', {
      body: {},
      headers: { origin: 'https://evil.example' },
    });
    const missing = await app.call(newUser(), '/api/passkey/login/start', { body: {}, headers: { origin: null } });
    const valid = await app.call(newUser(), '/api/passkey/login/start', { body: {} });

    expect([foreign.status, missing.status]).toEqual([403, 403]);
    expect([foreign.json.status, missing.json.status]).toEqual(['forbidden', 'forbidden']);
    expect([foreign.headers.get('cache-control'), missing.headers.get('cache-control')]).toEqual([
      'no-store',
      'no-store',
    ]);
    expect(valid.status).toBe(200);
    expect(valid.json.authnParamsPublicKey?.challenge).toBeTruthy();
  });
});
