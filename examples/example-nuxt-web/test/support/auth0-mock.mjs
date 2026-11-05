// A fake Auth0 for the tests. It is preloaded into the example's own process (`node --import`, see app.ts), so MSW
// answers the requests the SDK sends to Auth0: discovery, the signing keys and the token endpoint. The browser side of
// the login (/authorize, the approval, the redirect back) is played by the tests themselves.
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

const issuer = `https://${process.env.NUXT_AUTH0_DOMAIN}/`;
const clientId = process.env.NUXT_AUTH0_CLIENT_ID;
const user = JSON.parse(process.env.MOCK_AUTH0_USER);

const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };

const tokenError = (error, description) =>
  HttpResponse.json({ error, error_description: description }, { status: 400 });

setupServer(
  http.get(`${issuer}.well-known/openid-configuration`, () =>
    HttpResponse.json({
      issuer,
      authorization_endpoint: `${issuer}authorize`,
      token_endpoint: `${issuer}oauth/token`,
      jwks_uri: `${issuer}.well-known/jwks.json`,
      end_session_endpoint: `${issuer}oidc/logout`,
      id_token_signing_alg_values_supported: ['RS256'],
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
    }),
  ),

  http.get(`${issuer}.well-known/jwks.json`, () => HttpResponse.json({ keys: [jwk] })),

  http.post(`${issuer}oauth/token`, async ({ request }) => {
    const form = new URLSearchParams(await request.text());
    if (form.get('grant_type') !== 'authorization_code') {
      return tokenError('unsupported_grant_type', `the test mock only handles authorization_code, got ${form.get('grant_type')}`);
    }
    if (!form.get('code_verifier')) return tokenError('invalid_grant', 'PKCE code_verifier is missing');

    const idToken = await new SignJWT({ ...user, sid: 'test-session' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer(issuer)
      .setAudience(clientId)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(privateKey);

    return HttpResponse.json({
      access_token: 'test-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'openid profile email',
      id_token: idToken,
      refresh_token: 'test-refresh-token',
    });
  }),
  // Any other request to Auth0 fails loudly, so a change in what the SDK calls shows up as a test failure.
).listen({ onUnhandledRequest: 'error' });
