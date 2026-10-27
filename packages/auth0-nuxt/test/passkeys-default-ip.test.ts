// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { setup } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { auth0Config, createClient, freePort, ignoreNuxtEnv, requestsTo, script, userAt } from './passkeys.shared';

// One server with the default `clientIpHeader` of the example (empty): every request of this server comes from one
// client, the socket address. The test below uses up the signup start count of that client, so it has a server to itself.
ignoreNuxtEnv();
const port = await freePort();
const origin = `http://localhost:${port}`;
const app = createClient(origin);

describe('passkeys example: the default client address', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/passkeys', import.meta.url)),
    port,
    nuxtConfig: { runtimeConfig: { auth0: auth0Config(origin), passkey: { clientIpHeader: '' } } },
  });

  beforeEach(async () => {
    await script({ reset: true });
  });

  it('D10: with the default `clientIpHeader`, a client-sent X-Forwarded-For is neither forwarded nor the rate-limit key', async () => {
    // Six different spoofed addresses are one client, the socket address, so the sixth request is over the limit of 5.
    // (If the header were the key, none of the six would be limited.)
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await app.call(userAt(`198.51.100.${i}`), '/api/passkey/signup/start', {
        body: { email: `u${i}@example.com` },
      });
      statuses.push(res.status);
    }

    expect(statuses.at(-1)).toBe(429);
    const forwarded = (await requestsTo('/passkey/register')).map((request) => request.headers['auth0-forwarded-for']);
    expect(forwarded.length).toBeGreaterThan(0);
    for (const value of forwarded) {
      expect(['127.0.0.1', '::1']).toContain(value);
    }
  });
});
