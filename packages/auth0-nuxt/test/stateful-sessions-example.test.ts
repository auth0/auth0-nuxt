// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { fetch as appFetch, setup } from '@nuxt/test-utils';
import { fileURLToPath } from 'node:url';
import { SESSION_SECRET, auth0Config, freePort, ignoreNuxtEnv, storedSessions } from './passkeys.shared';
import { decrypt } from './encryption';

// The app and the server code of examples/example-nuxt-stateful-sessions, with a fake Auth0 (fixtures/stateful-sessions).
// The example keeps its sessions in the memory of the server, so the sessions of the tests in this file add up.
ignoreNuxtEnv();
const port = await freePort();
const origin = `http://localhost:${port}`;

const SESSION_COOKIE = '__a0_session';

/** The cookies a response sets, as the `Cookie` header that sends them back. */
function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/** Logs in through the real login and callback routes. Returns the cookies the callback set. */
async function login(): Promise<string> {
  const loginRes = await appFetch('/auth/login', { redirect: 'manual' });
  expect(loginRes.status).toBe(302);

  // The login only sends the PKCE challenge, so the callback needs the code and the transaction cookie of the login.
  const callbackRes = await appFetch('/auth/callback?code=fake-code', {
    redirect: 'manual',
    headers: { cookie: cookieHeader(loginRes) },
  });
  expect(callbackRes.status).toBe(302);
  return cookieHeader(callbackRes);
}

describe('example-nuxt-stateful-sessions', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/stateful-sessions', import.meta.url)),
    port,
    nuxtConfig: { runtimeConfig: { auth0: auth0Config(origin) } },
  });

  it('persists the session in the store, and the cookie only holds its identifier', async () => {
    const before = (await storedSessions()).length;

    const cookies = await login();

    const sessions = await storedSessions();
    expect(sessions).toHaveLength(before + 1);
    const [identifier, state] = sessions.at(-1)!;
    expect(state.user?.sub).toBe('auth0|user_123');

    // The cookie holds an encrypted reference to the stored session, not the user and the tokens.
    const cookie = cookies.split('; ').find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    const payload = await decrypt<Record<string, unknown>>(
      decodeURIComponent(cookie.slice(SESSION_COOKIE.length + 1)),
      SESSION_SECRET,
      SESSION_COOKIE
    );
    expect(payload.id).toBe(identifier);
    expect(payload).not.toHaveProperty('user');
    expect(payload).not.toHaveProperty('idToken');
  });

  it('lets the user with that cookie open the private page', async () => {
    const cookies = await login();

    const res = await appFetch('/private', { headers: { cookie: cookies } });

    expect(res.status).toBe(200);
    expect(await res.text()).toContain('This is a private page. Your session data is stored server-side.');
  });

  it('sends a visitor without a session to the login route', async () => {
    const res = await appFetch('/private', { redirect: 'manual' });

    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toContain('/auth/login?returnTo=/private');
  });

  it('removes the session from the store on a Back-Channel Logout', async () => {
    const cookies = await login();
    const before = (await storedSessions()).length;

    const { logoutToken } = (await (
      await appFetch('/__fake/logout-token', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sid: 'sid_123' }),
      })
    ).json()) as { logoutToken: string };
    const res = await appFetch('/auth/backchannel-logout', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ logout_token: logoutToken }).toString(),
    });

    expect(res.status).toBe(204);
    // Every session of this file has the same `sid`, so the logout removes them all.
    expect(before).toBeGreaterThan(0);
    expect(await storedSessions()).toHaveLength(0);

    // The cookie still points at the removed session, so the visitor has no session any more.
    const privateRes = await appFetch('/private', { redirect: 'manual', headers: { cookie: cookies } });
    expect(privateRes.status).toBe(302);
  });
});
