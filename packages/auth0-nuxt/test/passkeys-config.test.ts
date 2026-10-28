// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { setup } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import {
  SESSION_SECRET,
  auth0Config,
  createClient,
  freePort,
  ignoreNuxtEnv,
  newUser,
  requestsTo,
  script,
  signupCredential,
  storedSessions,
} from './passkeys.shared';
import { decrypt } from './encryption';

// One server with the settings that are not the defaults of the fixture:
// an empty `clientIpHeader` (the default of the example), an empty `realm`, an `appBaseUrl` with a path and a
// stateful session store.
//
// With an empty `clientIpHeader` every request of this server comes from one client, the socket address, so all the tests
// of this file share one rate-limit count per route (5 signup starts a minute). Keep the signup starts of a test few.
ignoreNuxtEnv();
const port = await freePort();
const origin = `http://localhost:${port}`;
const app = createClient(origin);

describe('passkeys example: other configurations', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/passkeys', import.meta.url)),
    port,
    nuxtConfig: {
      auth0: {
        sessionStoreFactoryPath: fileURLToPath(new URL('./fixtures/passkeys/fakes/session-store.ts', import.meta.url)),
      },
      runtimeConfig: {
        auth0: auth0Config(`${origin}/base/path`),
        passkey: { realm: '', clientIpHeader: '' },
      },
    },
  });

  beforeEach(async () => {
    await script({ reset: true });
  });

  it('F3: an app base URL with a path still passes the Origin check, which compares origins', async () => {
    const res = await app.call(newUser(), '/api/passkey/login/start', { body: {} });

    expect(res.status).toBe(200);
  });

  it('F2: an empty `realm` setting sends no realm to Auth0, which means the Default Directory', async () => {
    await app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });
    await app.call(newUser(), '/api/passkey/login/start', { body: {} });

    const [register] = await requestsTo('/passkey/register');
    const [challenge] = await requestsTo('/passkey/challenge');
    expect(register?.body).not.toHaveProperty('realm');
    expect(challenge?.body).not.toHaveProperty('realm');
  });

  it('F1: with a session store, complete() writes the session through the store, and the cookie holds only an id', async () => {
    const user = newUser();
    const start = await app.call(user, '/api/passkey/signup/start', { body: { email: 'new@example.com' } });

    const done = await app.call(user, '/api/passkey/complete', {
      body: { credential: signupCredential(start.json.authnParamsPublicKey!.challenge) },
    });

    expect(done.json).toEqual({ status: 'complete' });
    const sessions = await storedSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.[1].user?.sub).toBe('auth0|signup-user');

    // The cookie is only an identifier: decrypting it shows an id and no user.
    const cookie = user.jar
      .names()
      .filter((name) => name.startsWith('__a0_session'))
      .sort()
      .map((name) => user.jar.get(name))
      .join('');
    const payload = await decrypt<{ id?: string; user?: unknown }>(cookie, SESSION_SECRET, '__a0_session');
    expect(payload.id).toBe(sessions[0]?.[0]);
    expect(payload.user).toBeUndefined();

    const profile = await app.call<{ email?: string }>(user, '/auth/profile');
    expect(profile.json.email).toBe('new@example.com');
  });
});
