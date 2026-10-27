// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { setup, url } from '@nuxt/test-utils';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { PasskeyCredentialResponse } from '@auth0/auth0-server-js';
import type { ScriptedResponse } from './fixtures/passkeys/fakes/fake-state';
import { encrypt } from './encryption';
import {
  EMAIL_CODE,
  FLOW_COOKIE,
  PHONE_CODE,
  auth0Config,
  createClient,
  fakeLog,
  freePort,
  hasSession,
  ignoreNuxtEnv,
  loginCredential,
  newUser,
  readFlow,
  requestsTo,
  script,
  signupCredential,
  userAt,
  type CallInit,
  type CallResult,
  type PasskeyAnswer,
  type User,
} from './passkeys.shared';

ignoreNuxtEnv();
// The Origin check compares with the base URL of the app, so the port has to be known before the server starts.
const port = await freePort();
const origin = `http://localhost:${port}`;
const app = createClient(origin);

/** Starts a signup for `user` and returns the credential the browser would make for it. */
async function startSignup(user: User, body: Record<string, unknown> = { email: 'new@example.com' }) {
  const res = await app.call(user, '/api/passkey/signup/start', { body });
  return { res, credential: signupCredential(res.json.authnParamsPublicKey!.challenge) };
}

/** Starts a login for `user` and returns the credential the browser would make for it. */
async function startLogin(user: User) {
  const res = await app.call(user, '/api/passkey/login/start', { body: {} });
  return { res, credential: loginCredential(res.json.authnParamsPublicKey!.challenge) };
}

const complete = (user: User, body: unknown, init: CallInit = {}) =>
  app.call(user, '/api/passkey/complete', { body, ...init });

const CHALLENGE = 'Y2hhbGxlbmdl';

/** A flow cookie value that `secret` encrypted, the way the SDK makes one. */
async function flowCookie(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60;
  const flow = { authSession: 'AS-1', challenge: CHALLENGE, domain: 'example.auth0.local', expiresAt };
  return await encrypt(flow, secret, FLOW_COOKIE, expiresAt);
}

describe('passkeys example: HTTP flows', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/passkeys', import.meta.url)),
    port,
    nuxtConfig: { runtimeConfig: { auth0: auth0Config(origin) } },
  });

  beforeEach(async () => {
    await script({ reset: true });
  });

  describe('A. the happy paths', () => {
    it('A1: signup start keeps the flow in an encrypted cookie and returns only the WebAuthn options', async () => {
      const user = newUser();

      const res = await app.call(user, '/api/passkey/signup/start', {
        body: { email: 'new@example.com', name: 'New User' },
      });

      expect(res.status).toBe(200);
      expect(res.json.authnParamsPublicKey?.challenge).toBeTruthy();
      expect(res.json.verificationRequired).toEqual([]);
      expect(res.text).not.toMatch(/auth_?session/i);

      const cookie = res.setCookie.find((value) => value.startsWith(`${FLOW_COOKIE}=`)) ?? '';
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).toMatch(/Path=\//);
      expect(cookie).toMatch(/Max-Age=60(;|$)/);

      const flow = await readFlow(user);
      expect(flow.authSession).toMatch(/^AS-\d+$/);
      expect(flow.challenge).toBe(res.json.authnParamsPublicKey?.challenge);
    });

    it('A2: signup start sends the profile, the connection and the delivery method to Auth0', async () => {
      const user = newUser();

      await app.call(user, '/api/passkey/signup/start', {
        body: { email: 'a@example.com', phoneNumber: '+14155550100', name: 'Alice', deliveryMethod: 'voice' },
      });

      const [register] = await requestsTo('/passkey/register');
      expect(register?.body).toMatchObject({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        realm: 'Username-Password-Authentication',
        delivery_method: 'voice',
        user_profile: { email: 'a@example.com', name: 'Alice', phone_number: '+14155550100' },
      });
    });

    it('A3: signup start with codes lists the identifiers to verify and keeps the flow for 15 minutes', async () => {
      await script({ verificationRequired: ['email', 'phone'] });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/signup/start', {
        body: { email: 'a@example.com', phoneNumber: '+14155550100' },
      });

      expect(res.json.verificationRequired).toEqual(['email', 'phone']);
      expect(res.setCookie.find((value) => value.startsWith(`${FLOW_COOKIE}=`))).toMatch(/Max-Age=900(;|$)/);
    });

    it('A4: complete after a signup exchanges the credential, creates the session and clears the flow', async () => {
      const user = newUser();
      const start = await app.call(user, '/api/passkey/signup/start', { body: { email: 'new@example.com' } });
      const credential = signupCredential(start.json.authnParamsPublicKey!.challenge);
      const { authSession } = await readFlow(user);

      const done = await app.call(user, '/api/passkey/complete', { body: { credential } });

      expect(done.status).toBe(200);
      expect(done.json).toEqual({ status: 'complete' });
      const [token] = await requestsTo('/oauth/token');
      expect(token?.body).toMatchObject({
        grant_type: 'urn:okta:params:oauth:grant-type:webauthn',
        auth_session: authSession,
        authn_response: credential,
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        audience: 'https://api.example.local', // E1: the configured audience
      });
      expect(String((token?.body as { scope?: string }).scope)).toContain('openid');
      expect(user.jar.has(FLOW_COOKIE)).toBe(false);
      expect(hasSession(user)).toBe(true);

      const profile = await app.call<{ email?: string }>(user, '/auth/profile');
      expect(profile.json.email).toBe('new@example.com');
    });

    it('A5: login start and complete create a session', async () => {
      const user = newUser();

      const start = await app.call(user, '/api/passkey/login/start', { body: {} });

      expect(start.status).toBe(200);
      expect(start.json.authnParamsPublicKey?.challenge).toBeTruthy();
      expect(start.json).not.toHaveProperty('verificationRequired');
      const [challenge] = await requestsTo('/passkey/challenge');
      expect(challenge?.body).toMatchObject({
        client_id: 'test-client-id',
        client_secret: 'test-client-secret',
        realm: 'Username-Password-Authentication',
      });

      const done = await app.call(user, '/api/passkey/complete', {
        body: { credential: loginCredential(start.json.authnParamsPublicKey!.challenge) },
      });

      expect(done.json).toEqual({ status: 'complete' });
      expect(hasSession(user)).toBe(true);
      expect(user.jar.has(FLOW_COOKIE)).toBe(false);
    });
  });

  describe('B. complete fails', () => {
    it('B1: a wrong code is answered with `retry` and the identifiers still to verify, and the flow is kept', async () => {
      await script({ verificationRequired: ['email', 'phone'] });
      const user = newUser();
      const { credential } = await startSignup(user, { email: 'a@example.com', phoneNumber: '+14155550100' });
      const before = await readFlow(user);

      const res = await complete(user, { credential, verification: { email: EMAIL_CODE, phone: '000000' } });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'retry', verificationRequired: ['phone'] });
      const after = await readFlow(user);
      expect(after.authSession).toBe(before.authSession);
      expect(after.verificationRequired).toEqual(['phone']);
      expect(hasSession(user)).toBe(false);
    });

    it('B2: sending only the remaining code with the same credential completes the signup', async () => {
      await script({ verificationRequired: ['email', 'phone'] });
      const user = newUser();
      const { credential } = await startSignup(user, { email: 'a@example.com', phoneNumber: '+14155550100' });
      await complete(user, { credential, verification: { email: EMAIL_CODE, phone: '000000' } });

      const res = await complete(user, { credential, verification: { phone: PHONE_CODE } });

      expect(res.json).toEqual({ status: 'complete' });
      const tokens = await requestsTo('/oauth/token');
      expect(tokens).toHaveLength(2);
      expect((tokens[1]?.body as { verification: unknown }).verification).toEqual({ phone: PHONE_CODE });
      expect((tokens[1]?.body as { authn_response: unknown }).authn_response).toEqual(credential);
      expect(hasSession(user)).toBe(true);
    });

    it('B3: a missing code is answered with `invalid` before Auth0 is called, and the flow is kept', async () => {
      await script({ verificationRequired: ['email', 'phone'] });
      const user = newUser();
      const { credential } = await startSignup(user, { email: 'a@example.com', phoneNumber: '+14155550100' });

      const res = await complete(user, { credential, verification: { email: EMAIL_CODE } });

      expect(res.status).toBe(400);
      expect(res.json.status).toBe('invalid');
      expect(await requestsTo('/oauth/token')).toHaveLength(0);
      expect(user.jar.has(FLOW_COOKIE)).toBe(true);
    });

    it('B4: completing without a flow is answered with `restart` and Auth0 is not called', async () => {
      const user = newUser();

      const res = await complete(user, { credential: signupCredential('Y2hhbGxlbmdl') });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'restart' });
      expect(await requestsTo('/oauth/token')).toHaveLength(0);
    });

    it.each([
      ['a value that is no encrypted token', async () => 'not-an-encrypted-token'],
      ['a flow that another session secret encrypted', () => flowCookie('another-secret-of-more-than-32-characters')],
    ])('B4: a flow cookie that cannot be read (%s) is answered with `restart`', async (_label, makeCookie) => {
      const user = newUser();

      const res = await complete(
        user,
        { credential: signupCredential(CHALLENGE) },
        { headers: { cookie: `${FLOW_COOKIE}=${await makeCookie()}` } }
      );

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'restart' });
      expect(await requestsTo('/oauth/token')).toHaveLength(0);
    });

    it('B5: MFA required is answered with 200 `mfa_required`, without the mfa token, and creates no session', async () => {
      const user = newUser();
      const { credential } = await startLogin(user);
      await script({
        token: [
          {
            status: 403,
            json: {
              error: 'mfa_required',
              error_description: 'Multifactor authentication required',
              mfa_token: 'MFA-TOKEN-SECRET',
            },
          },
        ],
      });

      const res = await complete(user, { credential });

      expect(res.status).toBe(200);
      expect(res.json).toEqual({ status: 'mfa_required' });
      expect(JSON.stringify([res.text, [...res.headers]])).not.toContain('MFA-TOKEN-SECRET');
      expect(hasSession(user)).toBe(false);
      expect(user.jar.has(FLOW_COOKIE)).toBe(false);
    });

    it('B6: Auth0 rate limiting is answered with 429 `wait` and the seconds to wait, and the flow is kept', async () => {
      const user = newUser();
      const { credential } = await startLogin(user);
      await script({
        token: [
          {
            status: 429,
            json: { error: 'too_many_requests', error_description: 'Too many requests' },
            headers: { 'retry-after': '7' },
          },
        ],
      });

      const res = await complete(user, { credential });

      expect(res.status).toBe(429);
      expect(res.json).toEqual({ status: 'wait', retryAfterSeconds: 7 });
      expect(res.headers.get('retry-after')).toBe('7');
      expect(user.jar.has(FLOW_COOKIE)).toBe(true);
    });

    it.each(['abc', '0', '-5', '1e3', '0x10', '99999999999999999999999', 'Wed, 21 Oct 2026 07:28:00 GMT', ''])(
      'B6: a Retry-After of %j is not passed on as a number',
      async (retryAfter) => {
        const user = newUser();
        const { credential } = await startLogin(user);
        await script({
          token: [
            {
              status: 429,
              json: { error: 'too_many_requests', error_description: 'Too many requests' },
              headers: { 'retry-after': retryAfter },
            },
          ],
        });

        const res = await complete(user, { credential });

        expect(res.status).toBe(429);
        expect(res.json).toEqual({ status: 'wait' }); // no retryAfterSeconds, and never NaN or null
        expect(res.headers.get('retry-after')).toBeNull();
      }
    );

    it('B7: an ID token whose session has already expired is answered with `session_expired`, with no session', async () => {
      const user = newUser();
      const { credential } = await startLogin(user);
      await script({ idTokenClaims: { session_expiry: Math.floor(Date.now() / 1000) - 60 } });

      const res = await complete(user, { credential });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'session_expired' });
      expect(hasSession(user)).toBe(false);
    });

    it.each([
      ['an Auth0 500', { status: 500, json: { error: 'server_error', error_description: 'boom' } }],
      ['an HTML 502', { status: 502, text: '<html>Bad Gateway</html>' }],
      ['a network failure', { status: 0, networkError: 'fetch failed' }],
    ] satisfies Array<[string, ScriptedResponse]>)(
      'B8: %s is answered with `failed`, the flow is kept and the same request can be sent again',
      async (_label, failure) => {
        const user = newUser();
        const { credential } = await startLogin(user);
        await script({ token: [failure] });

        const res = await complete(user, { credential });

        expect(res.status).toBe(400);
        expect(res.json).toEqual({ status: 'failed' }); // Auth0's text stays in the server log
        expect(user.jar.has(FLOW_COOKIE)).toBe(true);

        const again = await complete(user, { credential });
        expect(again.json).toEqual({ status: 'complete' });
      }
    );

    it('B9: an invalid_request from Auth0 is answered with `invalid`', async () => {
      const user = newUser();
      const { credential } = await startLogin(user);
      await script({
        token: [{ status: 400, json: { error: 'invalid_request', error_description: 'Missing parameter' } }],
      });

      const res = await complete(user, { credential });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'invalid' });
    });

    it('B10: a newer start replaces the flow, so the first credential is answered with `restart`', async () => {
      const user = newUser();
      const first = await startLogin(user);
      await startLogin(user); // for example a second tab

      const res = await complete(user, { credential: first.credential });

      expect(res.json).toEqual({ status: 'restart' });
      expect(await requestsTo('/oauth/token')).toHaveLength(0);
    });
  });

  describe('C. a start that Auth0 refuses', () => {
    it('C1: a refused signup is answered with 400 `error` and no description, and no flow is stored', async () => {
      await script({
        register: [{ status: 400, json: { error: 'invalid_request', error_description: 'user already exists' } }],
      });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/signup/start', { body: { email: 'dup@example.com' } });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'error' }); // the description stays in the server log
      expect(user.jar.has(FLOW_COOKIE)).toBe(false);
    });

    it('C1: a refused login start is answered with 400 `error` and no description as well', async () => {
      await script({
        challenge: [{ status: 400, json: { error: 'invalid_request', error_description: 'bad realm' } }],
      });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/login/start', { body: {} });

      expect(res.status).toBe(400);
      expect(res.json).toEqual({ status: 'error' });
    });

    it.each([
      [
        'a 401 for a wrong client secret',
        { status: 401, json: { error: 'invalid_client', error_description: 'Client authentication failed' } },
      ],
      ['an HTML 502', { status: 502, text: '<html>Bad Gateway</html>' }],
      ['a 503', { status: 503, text: 'unavailable' }],
    ] satisfies Array<[string, ScriptedResponse]>)(
      'C2: %s is answered with 400 `error`: the HTTP status of Auth0 does not leak',
      async (_label, failure) => {
        await script({ register: [failure] });
        const user = newUser();

        const res = await app.call(user, '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

        expect(res.status).toBe(400);
        expect(res.json.status).toBe('error');
      }
    );

    it('C3: Auth0 rate limiting on a start is answered with 429 `rate_limited` and the seconds to wait', async () => {
      await script({
        register: [
          {
            status: 429,
            json: { error: 'too_many_requests', error_description: 'slow down' },
            headers: { 'retry-after': '5' },
          },
        ],
      });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

      expect(res.status).toBe(429);
      expect(res.json).toEqual({ status: 'rate_limited', retryAfterSeconds: 5 });
      expect(res.headers.get('retry-after')).toBe('5');
    });

    it.each(['abc', '0', '1e3', ''])('C3: a Retry-After of %j is not passed on as a number', async (retryAfter) => {
      await script({
        challenge: [
          {
            status: 429,
            json: { error: 'too_many_requests', error_description: 'slow down' },
            headers: { 'retry-after': retryAfter },
          },
        ],
      });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/login/start', { body: {} });

      expect(res.status).toBe(429);
      expect(res.json).toEqual({ status: 'rate_limited' });
    });

    it('C4: a network failure on a start is no Auth0 refusal: Nitro answers with its generic 500', async () => {
      await script({ register: [{ status: 0, networkError: 'connect ECONNREFUSED 10.0.0.1:443' }] });
      const user = newUser();

      const res = await app.call(user, '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

      expect(res.status).toBe(500);
      expect(res.json.status).toBeUndefined();
      expect(res.text).not.toContain('ECONNREFUSED');
      expect(res.text).not.toContain('example.auth0.local');
    });
  });

  describe('D. the guard', () => {
    const routes = ['/api/passkey/signup/start', '/api/passkey/login/start', '/api/passkey/complete'];

    it.each([
      ['missing', null],
      ['another site', 'https://evil.example'],
      ['a host that only starts like the app', `${origin}.evil.example`],
      ['another port', `http://localhost:${port + 1}`],
      ['another scheme', `https://localhost:${port}`],
      ['the opaque origin', 'null'],
    ])('D1: an Origin that is %s is answered with 403 `forbidden` on every route', async (_label, value) => {
      for (const path of routes) {
        const res = await app.call(newUser(), path, { body: {}, headers: { origin: value } });

        expect(res.status, path).toBe(403);
        expect(res.json, path).toEqual({ status: 'forbidden' });
        expect(res.setCookie, path).toEqual([]);
      }
      expect(await fakeLog()).toEqual([]); // Auth0 was not called
    });

    it('D1: requests from another site do not use up the budget of the real page', async () => {
      const user = newUser();
      for (let i = 0; i < 6; i++) {
        const res = await app.call(user, '/api/passkey/signup/start', {
          body: { email: `u${i}@example.com` },
          headers: { origin: 'https://evil.example' },
        });
        expect(res.status).toBe(403);
      }

      const real = await app.call(user, '/api/passkey/signup/start', { body: { email: 'real@example.com' } });

      expect(real.status).toBe(200); // the limit is 5 a minute: the six refused requests were not counted
    });

    it('D7: the sixth signup start in a minute from one address is answered with 429 `rate_limited`, before Auth0', async () => {
      const user = newUser();
      for (let i = 0; i < 5; i++) {
        const res = await app.call(user, '/api/passkey/signup/start', { body: { email: `u${i}@example.com` } });
        expect(res.status).toBe(200);
      }

      const sixth = await app.call(user, '/api/passkey/signup/start', { body: { email: 'u6@example.com' } });

      expect(sixth.status).toBe(429);
      expect(sixth.json.status).toBe('rate_limited');
      expect(sixth.json.retryAfterSeconds).toBeGreaterThan(0);
      expect(sixth.json.retryAfterSeconds).toBeLessThanOrEqual(60);
      expect(Number(sixth.headers.get('retry-after'))).toBe(sixth.json.retryAfterSeconds);
      expect(await requestsTo('/passkey/register')).toHaveLength(5);
    });

    it('D7: another address is not limited, and another route has its own count', async () => {
      const user = newUser();
      for (let i = 0; i < 6; i++) {
        await app.call(user, '/api/passkey/signup/start', { body: { email: `u${i}@example.com` } });
      }

      const other = await app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'other@example.com' } });
      const login = await app.call(user, '/api/passkey/login/start', { body: {} });

      expect(other.status).toBe(200);
      expect(login.status).toBe(200);
    });

    it('D7: two addresses in one IPv6 /64 share a count, and another /64 does not', async () => {
      for (let i = 0; i < 5; i++) {
        await app.call(userAt('2001:db8:1:2::1'), '/api/passkey/signup/start', {
          body: { email: `u${i}@example.com` },
        });
      }

      const sameNetwork = await app.call(userAt('2001:db8:1:2:ffff::5'), '/api/passkey/signup/start', {
        body: { email: 'x@example.com' },
      });
      const otherNetwork = await app.call(userAt('2001:db8:1:3::1'), '/api/passkey/signup/start', {
        body: { email: 'y@example.com' },
      });

      expect(sameNetwork.status).toBe(429);
      expect(otherNetwork.status).toBe(200);
    });

    it.each([
      ['a success', async () => app.call(newUser(), '/api/passkey/login/start', { body: {} })],
      [
        'a wrong Origin',
        async () =>
          app.call(newUser(), '/api/passkey/login/start', { body: {}, headers: { origin: 'https://evil.example' } }),
      ],
      [
        'a rate-limited request',
        async () => {
          const user = newUser();
          for (let i = 0; i < 5; i++) {
            await app.call(user, '/api/passkey/signup/start', { body: { email: `u${i}@example.com` } });
          }
          return app.call(user, '/api/passkey/signup/start', { body: { email: 'u6@example.com' } });
        },
      ],
      ['a missing flow', async () => complete(newUser(), { credential: signupCredential('Y2hhbGxlbmdl') })],
      [
        'an Auth0 refusal',
        async () => {
          await script({ register: [{ status: 400, json: { error: 'invalid_request', error_description: 'nope' } }] });
          return app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });
        },
      ],
      [
        'a failure nobody maps (Nitro answers with its generic 500)',
        async () => {
          await script({ register: [{ status: 0, networkError: 'fetch failed' }] });
          return app.call(newUser(), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });
        },
      ],
    ] satisfies Array<[string, () => Promise<CallResult<PasskeyAnswer>>]>)(
      'D8: %s is answered with `Cache-Control: no-store`',
      async (_label, send) => {
        const res = await send();

        expect(res.headers.get('cache-control')).toBe('no-store');
      }
    );

    it('D9: the last entry of the configured header is what Auth0 is told', async () => {
      await app.call(userAt('1.2.3.4, 5.6.7.8'), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

      const [register] = await requestsTo('/passkey/register');
      expect(register?.headers['auth0-forwarded-for']).toBe('5.6.7.8');
    });

    it('D9: an IPv4-mapped IPv6 address is told to Auth0 as the IPv4 address', async () => {
      await app.call(userAt('::ffff:203.0.113.9'), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

      const [register] = await requestsTo('/passkey/register');
      expect(register?.headers['auth0-forwarded-for']).toBe('203.0.113.9');
    });

    it('D9: the same address goes to Auth0 on a login start and on complete', async () => {
      const user = userAt('1.2.3.4, 5.6.7.9');
      const { credential } = await startLogin(user);

      await complete(user, { credential });

      const [challenge] = await requestsTo('/passkey/challenge');
      const [token] = await requestsTo('/oauth/token');
      expect(challenge?.headers['auth0-forwarded-for']).toBe('5.6.7.9');
      expect(token?.headers['auth0-forwarded-for']).toBe('5.6.7.9');
    });

    it('D9: the rate limit counts the last entry, so a client cannot dodge it by changing the first', async () => {
      const last = '198.51.100.77';
      for (let i = 0; i < 5; i++) {
        const res = await app.call(userAt(`10.0.0.${i}, ${last}`), '/api/passkey/signup/start', {
          body: { email: `u${i}@example.com` },
        });
        expect(res.status).toBe(200);
      }

      const res = await app.call(userAt(`10.9.9.9, ${last}`), '/api/passkey/signup/start', {
        body: { email: 'x@example.com' },
      });

      expect(res.status).toBe(429);
    });

    describe('when there is no usable client address in the header', () => {
      const socketAddresses = ['127.0.0.1', '::1'];

      it('D9: a last entry that is not an IP address is not forwarded: the socket address is used', async () => {
        await app.call(userAt('5.6.7.8, not-an-ip'), '/api/passkey/signup/start', { body: { email: 'a@example.com' } });

        const [register] = await requestsTo('/passkey/register');
        expect(socketAddresses).toContain(register?.headers['auth0-forwarded-for']);
      });

      it('D9: without the header the socket address is used', async () => {
        await app.call(newUser(), '/api/passkey/signup/start', {
          body: { email: 'a@example.com' },
          headers: { 'x-forwarded-for': null },
        });

        const [register] = await requestsTo('/passkey/register');
        expect(socketAddresses).toContain(register?.headers['auth0-forwarded-for']);
      });
    });
  });

  describe('D. the input checks', () => {
    const answeredWithNoStore = (res: { headers: Headers }) =>
      expect(res.headers.get('cache-control')).toBe('no-store');

    it.each([
      ['text/plain', 'text/plain'],
      ['a form', 'application/x-www-form-urlencoded'],
      ['application/jsonp', 'application/jsonp'],
      ['no content type', null],
    ])('D2: a body sent as %s is answered with 415', async (_label, contentType) => {
      for (const path of ['/api/passkey/signup/start', '/api/passkey/complete']) {
        const res = await app.call(newUser(), path, {
          rawBody: '{"email":"a@example.com"}',
          headers: { 'content-type': contentType },
        });

        expect(res.status, path).toBe(415);
        expect(res.json.status, path).toBe('invalid');
        answeredWithNoStore(res);
      }
      expect(await requestsTo('/passkey/register')).toHaveLength(0);
    });

    it('D2: JSON with a charset is accepted', async () => {
      const res = await app.call(newUser(), '/api/passkey/signup/start', {
        body: { email: 'a@example.com' },
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });

      expect(res.status).toBe(200);
    });

    describe('D3. body size', () => {
      // A signup body of exactly `bytes` characters, all ASCII.
      const signupBodyOf = (bytes: number) => {
        const empty = JSON.stringify({ email: 'a@example.com', name: '' });
        return JSON.stringify({ email: 'a@example.com', name: 'x'.repeat(bytes - empty.length) });
      };

      it('D3: a 40 KiB body with a Content-Length is answered with 413', async () => {
        const res = await app.call(newUser(), '/api/passkey/signup/start', { rawBody: signupBodyOf(40 * 1024) });

        expect(res.status).toBe(413);
        expect(res.json.status).toBe('invalid');
        answeredWithNoStore(res);
        expect(await requestsTo('/passkey/register')).toHaveLength(0);
      });

      it('D3: a streamed 40 KiB body without a Content-Length is answered with 413 too', async () => {
        const target = new URL(url('/'));

        const response = await new Promise<{ status: number; connection?: string }>((resolve, reject) => {
          const request = httpRequest(
            {
              host: target.hostname,
              port: target.port,
              path: '/api/passkey/signup/start',
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                origin,
                'x-forwarded-for': newUser().ip,
                'transfer-encoding': 'chunked',
              },
            },
            (res) => {
              res.resume();
              resolve({ status: res.statusCode ?? 0, connection: res.headers.connection });
            }
          );
          request.on('error', reject);
          for (let i = 0; i < 5; i++) request.write(Buffer.alloc(8 * 1024, 0x20));
          request.end();
        });

        expect(response.status).toBe(413);
        expect(response.connection).toBe('close'); // the rest of the body is not read, so the connection is not reused
        expect(await requestsTo('/passkey/register')).toHaveLength(0);
      });

      it('D3: a body of exactly 32 KiB passes the size check, and one byte more does not', async () => {
        const atTheLimit = await app.call(newUser(), '/api/passkey/signup/start', { rawBody: signupBodyOf(32 * 1024) });
        const oneMore = await app.call(newUser(), '/api/passkey/signup/start', {
          rawBody: signupBodyOf(32 * 1024 + 1),
        });

        expect(atTheLimit.status).toBe(400); // too long for `name`, which is a different answer than 413
        expect(atTheLimit.json.status).toBe('invalid');
        expect(atTheLimit.json.message).toContain('name must be text'); // the whole body was read and parsed
        expect(oneMore.status).toBe(413);
      });
    });

    it.each([
      ['malformed JSON', '{not json'],
      ['an empty body', ''],
      ['an array', '[]'],
      ['a string', '"text"'],
      ['null', 'null'],
      ['a number', '1'],
    ])('D4: %s is answered with 400 `invalid`', async (_label, rawBody) => {
      for (const path of ['/api/passkey/signup/start', '/api/passkey/complete']) {
        const res = await app.call(newUser(), path, { rawBody });

        expect(res.status, path).toBe(400);
        expect(res.json.status, path).toBe('invalid');
        answeredWithNoStore(res);
      }
    });

    it.each([
      ['an email without @', { email: 'nobody.example.com' }],
      ['an email with two @', { email: 'a@b@example.com' }],
      ['an email longer than 254 characters', { email: `${'a'.repeat(250)}@example.com` }],
      ['an email that is not text', { email: 42 }],
      ['a phone number that is not E.164', { phoneNumber: '4155550100' }],
      ['a phone number of 16 digits', { phoneNumber: '+1234567890123456' }],
      ['neither an email nor a phone number', { name: 'Nobody' }],
      ['no fields at all', {}],
      ['an empty name', { email: 'a@example.com', name: '' }],
      ['a name longer than 100 characters', { email: 'a@example.com', name: 'x'.repeat(101) }],
      ['an unknown delivery method', { email: 'a@example.com', phoneNumber: '+14155550100', deliveryMethod: 'pigeon' }],
    ])('D5: %s is answered with 400 `invalid` and a message, and Auth0 is not called', async (_label, body) => {
      const res = await app.call(newUser(), '/api/passkey/signup/start', { body });

      expect(res.status).toBe(400);
      expect(res.json.status).toBe('invalid');
      expect(res.json.message).toBeTruthy();
      expect(await requestsTo('/passkey/register')).toHaveLength(0);
    });

    it.each([
      ['a name of 100 characters', { email: 'a@example.com', name: 'x'.repeat(100) }],
      ['an email address of 254 characters', { email: `${'a'.repeat(242)}@example.com` }],
      ['a phone number of 15 digits', { phoneNumber: '+123456789012345' }],
    ])('D5: %s is accepted: the limits are inclusive', async (_label, body) => {
      const res = await app.call(newUser(), '/api/passkey/signup/start', { body });

      expect(res.status).toBe(200);
    });

    it('D5: fields the app did not ask for are dropped, and the realm comes from the settings', async () => {
      const body = {
        email: 'a@example.com',
        name: 'Alice',
        realm: 'Evil-Connection',
        organization: 'org_evil',
        userMetadata: { plan: 'free' },
        username: 'alice',
        picture: 'https://evil.example/x.png',
        givenName: 'A',
        unexpected: 1,
      };
      // A `__proto__` key must not smuggle anything in either.
      const rawBody = JSON.stringify(body).replace('{', '{"__proto__":{"organization":"org_proto"},');

      const res = await app.call(newUser(), '/api/passkey/signup/start', { rawBody });

      expect(res.status).toBe(200);
      const [register] = await requestsTo('/passkey/register');
      const sent = register?.body as Record<string, unknown>;
      expect(sent.realm).toBe('Username-Password-Authentication');
      expect(sent).not.toHaveProperty('organization');
      expect(sent).not.toHaveProperty('user_metadata');
      expect(Object.keys(sent.user_profile as object).sort()).toEqual(['email', 'name']);
    });

    describe('D6. the complete body', () => {
      const cases: Array<[string, (credential: PasskeyCredentialResponse) => unknown]> = [
        ['no credential', () => ({})],
        ['a credential that is a string', () => ({ credential: 'cred' })],
        ['a credential without an id', (c) => ({ credential: { ...c, id: undefined } })],
        ['an id that is not text', (c) => ({ credential: { ...c, id: 1 } })],
        ['a type other than public-key', (c) => ({ credential: { ...c, type: 'password' } })],
        ['a response that is not an object', (c) => ({ credential: { ...c, response: 'x' } })],
        [
          'no clientDataJSON',
          (c) => ({ credential: { ...c, response: { ...c.response, clientDataJSON: undefined } } }),
        ],
        ['an oversize id', (c) => ({ credential: { ...c, id: 'a'.repeat(8193) } })],
        [
          'an oversize attestationObject',
          (c) => ({ credential: { ...c, response: { ...c.response, attestationObject: 'a'.repeat(8193) } } }),
        ],
        [
          'clientExtensionResults that is not an object',
          (c) => ({ credential: { ...c, clientExtensionResults: 'x' } }),
        ],
        ['a verification that is not an object', (c) => ({ credential: c, verification: '123456' })],
        ['a code longer than 10 characters', (c) => ({ credential: c, verification: { email: '12345678901' } })],
        ['a code that is not text', (c) => ({ credential: c, verification: { email: 123456 } })],
      ];

      it.each(cases)('D6: %s is answered with 400 `invalid`, and Auth0 is not called', async (_label, mutate) => {
        const user = newUser();
        const { credential } = await startSignup(user);

        const res = await complete(user, mutate(credential));

        expect(res.status).toBe(400);
        expect(res.json.status).toBe('invalid');
        expect(await requestsTo('/oauth/token')).toHaveLength(0);
      });

      it.each([
        [
          'an id of 8192 characters',
          (c: PasskeyCredentialResponse) => ({ credential: { ...c, id: 'a'.repeat(8192) } }),
        ],
        [
          'an attestationObject of 8192 characters',
          (c: PasskeyCredentialResponse) => ({
            credential: { ...c, response: { ...c.response, attestationObject: 'a'.repeat(8192) } },
          }),
        ],
      ])('D6: %s is accepted: the limits are inclusive', async (_label, mutate) => {
        const user = newUser();
        const { credential } = await startSignup(user);

        const res = await complete(user, mutate(credential));

        expect(res.json).toEqual({ status: 'complete' });
      });

      it('D6: a code of 10 characters is accepted by the input check: Auth0 says it is wrong', async () => {
        await script({ verificationRequired: ['email'] });
        const user = newUser();
        const { credential } = await startSignup(user);

        const res = await complete(user, { credential, verification: { email: '1234567890' } });

        expect(res.json.status).toBe('retry'); // not `invalid`: that is the answer to 11 characters
      });

      it('D6: extra fields in the credential and the codes are dropped, and scope, audience and realm are not taken', async () => {
        await script({ verificationRequired: ['email'] });
        const user = newUser();
        const { credential } = await startSignup(user);
        const noisy = {
          ...credential,
          extra: { a: 1 },
          response: { ...credential.response, transports: ['internal'] },
        };

        const res = await complete(user, {
          credential: noisy,
          verification: { email: EMAIL_CODE, extra: 'x' },
          scope: 'admin',
          audience: 'https://evil.example',
          realm: 'Evil-Connection',
        });

        expect(res.json).toEqual({ status: 'complete' });
        const [token] = await requestsTo('/oauth/token');
        const sent = token?.body as Record<string, unknown>;
        expect(sent.authn_response).toEqual(credential);
        expect(sent.verification).toEqual({ email: EMAIL_CODE });
        expect(sent.audience).toBe('https://api.example.local');
        expect(String(sent.scope)).not.toContain('admin');
      });

      it.each([
        ['an empty verification object', {}],
        ['a verification with only unknown keys', { sms: '123456' }],
      ])('D6: %s is not sent to Auth0', async (_label, verification) => {
        const user = newUser();
        const { credential } = await startSignup(user); // no codes required

        const res = await complete(user, { credential, verification });

        expect(res.json).toEqual({ status: 'complete' });
        const [token] = await requestsTo('/oauth/token');
        expect(token?.body).not.toHaveProperty('verification');
      });
    });

    it('E2: a `realm` sent by the browser is ignored on a login start as well', async () => {
      await app.call(newUser(), '/api/passkey/login/start', { body: { realm: 'Evil-Connection' } });

      const [challenge] = await requestsTo('/passkey/challenge');
      expect((challenge?.body as { realm?: string }).realm).toBe('Username-Password-Authentication');
    });
  });
});
