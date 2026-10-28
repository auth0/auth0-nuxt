import { defineNitroPlugin } from 'nitropack/runtime';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { state, type Identifier, type ScriptedResponse } from './fake-state';

// A fake Auth0 for one host. It replaces `fetch` for that host only, so the real SDK code runs against it: discovery,
// the signing keys, the passkey endpoints and the token endpoint. Files outside the server dir get no auto-imports,
// so everything is imported here.

const DOMAIN = 'example.auth0.local';
const ISSUER = `https://${DOMAIN}/`;
const CLIENT_ID = 'test-client-id';
const GRANT = 'urn:okta:params:oauth:grant-type:webauthn';
const CODES: Record<Identifier, string> = { email: '123456', phone: '654321' };

const base64url = (text: string) => Buffer.from(text).toString('base64url');
const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

function scripted(response: ScriptedResponse): Response {
  if (response.networkError) throw new TypeError(response.networkError);
  return response.json !== undefined
    ? json(response.status, response.json, response.headers)
    : new Response(response.text ?? '', { status: response.status, headers: response.headers });
}

export default defineNitroPlugin(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const realFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== DOMAIN) return realFetch(input, init);

    const text = await request.text();
    const contentType = request.headers.get('content-type') ?? '';
    let body: unknown = text;
    if (contentType.includes('json')) body = text ? JSON.parse(text) : {};
    else if (contentType.includes('urlencoded')) body = Object.fromEntries(new URLSearchParams(text));
    state.log.push({
      method: request.method,
      path: url.pathname,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    });

    if (url.pathname === '/.well-known/openid-configuration') {
      return json(200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}authorize`,
        token_endpoint: `${ISSUER}oauth/token`,
        jwks_uri: `${ISSUER}.well-known/jwks.json`,
        end_session_endpoint: `${ISSUER}oidc/logout`,
        userinfo_endpoint: `${ISSUER}userinfo`,
        id_token_signing_alg_values_supported: ['RS256'],
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      });
    }
    if (url.pathname === '/.well-known/jwks.json') return json(200, { keys: [jwk] });

    if (url.pathname === '/passkey/register' || url.pathname === '/passkey/challenge') {
      const isRegister = url.pathname === '/passkey/register';
      const next = (isRegister ? state.register : state.challenge).shift();
      if (next) return scripted(next);

      const sessionId = `AS-${++state.counter}`;
      const required = isRegister ? [...state.verificationRequired] : [];
      const email = record(record(body).user_profile).email;
      state.sessions.set(sessionId, {
        kind: isRegister ? 'signup' : 'login',
        verificationRequired: required,
        email: typeof email === 'string' ? email : undefined,
      });

      const challenge = base64url(`challenge-${sessionId}`);
      const authnParamsPublicKey = isRegister
        ? {
            rp: { id: 'localhost', name: 'Fake' },
            user: { id: base64url(sessionId), name: typeof email === 'string' ? email : 'user', displayName: 'User' },
            challenge,
            pubKeyCredParams: [
              { type: 'public-key', alg: -7 },
              { type: 'public-key', alg: -257 },
            ],
            authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
            timeout: required.length ? 900000 : 60000,
            attestation: 'none',
          }
        : { rpId: 'localhost', challenge, timeout: 60000, userVerification: 'preferred' };
      return json(200, {
        auth_session: sessionId,
        authn_params_public_key: authnParamsPublicKey,
        ...(required.length ? { verification_required: required } : {}),
      });
    }

    if (url.pathname === '/oauth/token') {
      const next = state.token.shift();
      if (next) return scripted(next);

      const params = record(body);
      if (params.grant_type !== GRANT) {
        return json(400, {
          error: 'unsupported_grant_type',
          error_description: `unexpected ${String(params.grant_type)}`,
        });
      }
      const sessionId = String(params.auth_session);
      const session = state.sessions.get(sessionId);
      if (!session) return json(400, { error: 'invalid_grant', error_description: 'unknown auth_session' });

      const codes = record(params.verification);
      const wrong = session.verificationRequired.filter((identifier) => codes[identifier] !== CODES[identifier]);
      if (wrong.length) {
        session.verificationRequired = wrong;
        return json(400, {
          error: 'invalid_grant',
          error_description: 'Wrong or expired verification code',
          auth_session: sessionId,
          verification_required: wrong,
        });
      }

      state.sessions.delete(sessionId);
      const now = Math.floor(Date.now() / 1000);
      const idToken = await new SignJWT({
        sub: session.kind === 'signup' ? 'auth0|signup-user' : 'auth0|login-user',
        email: session.email ?? 'login@example.com',
        name: 'Passkey User',
        sid: 'sid-1',
        ...state.idTokenClaims,
      })
        .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
        .setIssuer(ISSUER)
        .setAudience(CLIENT_ID)
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);
      state.idTokenClaims = {};
      return json(200, {
        access_token: `at-${++state.counter}`,
        refresh_token: `rt-${state.counter}`,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 86400,
        scope: String(params.scope ?? 'openid'),
      });
    }

    return json(404, { error: 'not_found', path: url.pathname });
  }) as typeof fetch;
});
