import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startApp, clientId, domain, user, type App } from './support/app';
import { Client } from './support/client';

/** /auth/profile answers `null` for a signed-out visitor, which h3 sends as an empty 204. */
const SIGNED_OUT = 204;

describe('example-nuxt-web', () => {
  let app: App;

  beforeAll(async () => {
    app = await startApp();
  });
  afterAll(() => app?.stop());

  it('sends /auth/login to Auth0 with an authorization code + PKCE request', async () => {
    const response = await new Client(app.origin).get('/auth/login');

    expect(response.status).toBe(302);
    const authorize = new URL(response.headers.get('location')!);
    expect(authorize.origin + authorize.pathname).toBe(`https://${domain}/authorize`);
    expect(Object.fromEntries(authorize.searchParams)).toMatchObject({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: `${app.origin}/auth/callback`,
      code_challenge_method: 'S256',
    });
    expect(authorize.searchParams.get('code_challenge')).toBeTruthy();
    expect(authorize.searchParams.get('scope')).toContain('openid');
  });

  it('exposes the user from /auth/profile after login', async () => {
    const client = new Client(app.origin);

    const { callback } = await client.login();

    expect(callback.status).toBe(302);
    expect(new URL(callback.headers.get('location')!, app.origin).pathname).toBe('/');
    const profile = await client.get('/auth/profile');
    expect(profile.status).toBe(200);
    expect(await profile.json()).toMatchObject(user);
  });

  it('renders the logged-in user on the server', async () => {
    const client = new Client(app.origin);
    await client.login();

    const html = await (await client.get('/')).text();

    expect(html).toContain(`Log out (${user.name})`);
  });

  it('sends the user back to returnTo after login', async () => {
    const client = new Client(app.origin);

    const { callback } = await client.login('/private');

    expect(new URL(callback.headers.get('location')!, app.origin).pathname).toBe('/private');
    const page = await client.get('/private');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('This is a private page.');
  });

  it('redirects an anonymous visit to /private to login', async () => {
    const response = await new Client(app.origin).get('/private');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/login?returnTo=/private');
  });

  it('redirects an anonymous visit to /private-route-middleware to login', async () => {
    const response = await new Client(app.origin).get('/private-route-middleware');

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('/auth/login?returnTo=/private-route-middleware');
  });

  it('does not create a session when Auth0 reports an error', async () => {
    const client = new Client(app.origin);

    await client.get('/auth/callback?error=access_denied&error_description=The+user+denied+access');

    expect((await client.get('/auth/profile')).status).toBe(SIGNED_OUT);
  });

  it('logs out through Auth0 and clears the session', async () => {
    const client = new Client(app.origin);
    await client.login();
    expect((await client.get('/auth/profile')).status).toBe(200);

    const logout = await client.get('/auth/logout');

    expect(logout.status).toBe(302);
    const endSession = new URL(logout.headers.get('location')!);
    expect(endSession.origin + endSession.pathname).toBe(`https://${domain}/oidc/logout`);
    expect(endSession.searchParams.get('post_logout_redirect_uri')).toContain(app.origin);
    expect((await client.get('/auth/profile')).status).toBe(SIGNED_OUT);
  });
});
