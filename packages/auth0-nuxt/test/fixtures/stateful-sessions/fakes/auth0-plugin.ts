import { defineNitroPlugin } from 'nitropack/runtime';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { state } from './fake-state';

// A fake Auth0 for one host. It replaces `fetch` for that host only, so the real SDK code runs against it: discovery, the
// signing keys and the token endpoint. Files outside the server dir get no auto-imports, so everything is imported here.

const DOMAIN = 'example.auth0.local';
const ISSUER = `https://${DOMAIN}/`;
const CLIENT_ID = 'test-client-id';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default defineNitroPlugin(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const realFetch = globalThis.fetch;

  state.sign = async (claims) => {
    const now = Math.floor(Date.now() / 1000);
    return await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(CLIENT_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
  };

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname !== DOMAIN) return realFetch(input, init);

    if (url.pathname === '/.well-known/openid-configuration') {
      return json(200, {
        issuer: ISSUER,
        authorization_endpoint: `${ISSUER}authorize`,
        token_endpoint: `${ISSUER}oauth/token`,
        jwks_uri: `${ISSUER}.well-known/jwks.json`,
        end_session_endpoint: `${ISSUER}oidc/logout`,
        id_token_signing_alg_values_supported: ['RS256'],
        response_types_supported: ['code'],
        subject_types_supported: ['public'],
        token_endpoint_auth_methods_supported: ['client_secret_post', 'client_secret_basic'],
      });
    }
    if (url.pathname === '/.well-known/jwks.json') return json(200, { keys: [jwk] });

    if (url.pathname === '/oauth/token') {
      const idToken = await state.sign!({
        sub: 'auth0|user_123',
        name: 'Jane Doe',
        sid: 'sid_123',
      });
      return json(200, {
        access_token: 'opaque-access-token',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }

    return json(404, { error: 'not_found', path: url.pathname });
  }) as typeof fetch;
});
