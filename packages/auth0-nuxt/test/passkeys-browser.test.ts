// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPage, setup } from '@nuxt/test-utils';
import type { Page } from 'playwright-core';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { EMAIL_CODE, PHONE_CODE, auth0Config, freePort, requestsTo, script } from './passkeys.shared';

// WebAuthn needs a secure context and an RP ID that fits the origin. `localhost` is both, so the page runs on
// http://localhost:<port>, and the fake Auth0 uses the RP ID `localhost`. Chromium only: the virtual authenticator is a
// Chrome DevTools feature.
const port = await freePort();
const origin = `http://localhost:${port}`;

describe('passkeys example: in a browser', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/passkeys', import.meta.url)),
    port,
    browser: true,
    nuxtConfig: { runtimeConfig: { auth0: auth0Config(origin) } },
  });

  const pages: Page[] = [];
  let tests = 0;

  beforeEach(async () => {
    await script({ reset: true });
  });

  afterEach(async () => {
    await Promise.all(pages.splice(0).map((page) => page.close()));
  });

  /** A page with a virtual authenticator: a platform authenticator with a resident key and user verification. */
  async function openApp(beforeLoad?: (page: Page) => Promise<void>) {
    const page = await createPage();
    pages.push(page);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    // Every test is another client for the rate limit of the app.
    tests += 1;
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': `198.51.100.${tests}` });
    await beforeLoad?.(page);
    await page.goto(origin, { waitUntil: 'hydration' });

    const credentials = async () => (await cdp.send('WebAuthn.getCredentials', { authenticatorId })).credentials;

    /** Puts a discoverable passkey for `localhost` into the authenticator, as if an earlier signup had made it. */
    const addPasskey = async () => {
      const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
      await cdp.send('WebAuthn.addCredential', {
        authenticatorId,
        credential: {
          credentialId: randomBytes(16).toString('base64'),
          isResidentCredential: true,
          rpId: 'localhost',
          privateKey: privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
          userHandle: randomBytes(16).toString('base64'),
          signCount: 0,
        },
      });
    };
    return { page, credentials, addPasskey };
  }

  /** The text of an element, once it is there. */
  async function textOf(page: Page, testId: string) {
    const element = page.getByTestId(testId);
    await element.waitFor({ timeout: 10_000 });
    return await element.textContent();
  }

  /**
   * The text of an element, once it contains `expected`. The status line changes while a flow runs ("Starting the
   * signup...", then the result), so a test waits for the line it means instead of reading the first one.
   */
  async function textContaining(page: Page, testId: string, expected: string) {
    await page.getByTestId(testId).filter({ hasText: expected }).waitFor({ timeout: 10_000 });
    return await page.getByTestId(testId).textContent();
  }

  async function fillSignup(page: Page, fields: { email?: string; phone?: string }) {
    await page.getByTestId('signup').click();
    if (fields.email) await page.getByTestId('signup-email').fill(fields.email);
    if (fields.phone) await page.getByTestId('signup-phone').fill(fields.phone);
    await page.getByTestId('signup-submit').click();
  }

  it('G1: a signup updates the page without a reload, then a login uses the passkey, and a reload renders the user on the server', async () => {
    const { page, credentials } = await openApp();
    await page.evaluate(() => Object.assign(window, { marker: 1 }));

    await fillSignup(page, { email: 'new@example.com' });

    expect(await textOf(page, 'user')).toBe('new@example.com');
    expect(await textOf(page, 'status')).toBe('Your account and passkey are ready.');
    expect(await page.evaluate(() => 'marker' in window)).toBe(true); // no reload
    const made = await credentials();
    expect(made).toHaveLength(1);
    expect(made[0]?.rpId).toBe('localhost');

    // A fresh browser session, the same authenticator.
    await page.context().clearCookies();
    await page.goto(origin, { waitUntil: 'hydration' });
    expect(await page.getByTestId('user').count()).toBe(0);
    await page.getByTestId('login').click();
    expect(await textOf(page, 'user')).toBe('login@example.com');

    await page.reload();
    expect(await textOf(page, 'user')).toBe('login@example.com');
    const html = await (await page.context().request.get(origin)).text();
    expect(html).toContain('login@example.com');
  }, 60_000);

  it('G2: the codes come before the passkey, and after a wrong phone code only the phone input returns', async () => {
    await script({ verificationRequired: ['email', 'phone'] });
    const { page, credentials } = await openApp();

    await fillSignup(page, { email: 'new@example.com', phone: '+14155550100' });

    await page.getByTestId('codes-form').waitFor({ timeout: 10_000 });
    expect(await credentials()).toHaveLength(0); // no passkey before the codes
    await page.getByTestId('code-email').fill(EMAIL_CODE);
    await page.getByTestId('code-phone').fill('000000');
    await page.getByTestId('codes-submit').click();

    await page.getByTestId('code-email').waitFor({ state: 'detached', timeout: 10_000 });
    await page.getByTestId('code-phone').waitFor({ timeout: 10_000 });
    expect(await page.getByTestId('code-phone').inputValue()).toBe(''); // the wrong code is cleared
    const created = await credentials();
    expect(created).toHaveLength(1);

    await page.getByTestId('code-phone').fill(PHONE_CODE);
    await page.getByTestId('codes-submit').click();

    expect(await textOf(page, 'user')).toBe('new@example.com');
    // The same passkey was sent again. A second create() for the same user replaces the first passkey with a new id.
    const finished = await credentials();
    expect(finished).toHaveLength(1);
    expect(finished[0]?.credentialId).toBe(created[0]?.credentialId);
  }, 60_000);

  it('G3: a refused passkey prompt shows its own sentence, and the page stays usable', async () => {
    const { page } = await openApp(async (p) => {
      await p.addInitScript(() => {
        navigator.credentials.create = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));
      });
    });

    await fillSignup(page, { email: 'new@example.com' });

    expect(await textContaining(page, 'status', 'closed or timed out')).toContain('closed or timed out');
    expect(await page.getByTestId('signup-submit').isEnabled()).toBe(true);
  }, 60_000);

  it('G4: MFA after the passkey is explained, with a link to Universal Login and without the mfa token', async () => {
    await script({
      token: [
        { status: 403, json: { error: 'mfa_required', error_description: 'MFA', mfa_token: 'MFA-TOKEN-SECRET' } },
      ],
    });
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'MFA')).toContain('MFA');
    expect(await page.getByTestId('mfa-login').getAttribute('href')).toBe('/auth/login');
    expect(await page.content()).not.toContain('MFA-TOKEN-SECRET');
  }, 60_000);

  it('G5: a start that is rate limited shows the wait and offers to try again', async () => {
    await script({
      challenge: [
        {
          status: 429,
          json: { error: 'too_many_requests', error_description: 'slow down' },
          headers: { 'retry-after': '5' },
        },
      ],
    });
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'Try again in 5 seconds')).toContain('Try again in 5 seconds');
    await page.getByTestId('retry').click(); // the script is used up: the next start works
    expect(await textOf(page, 'user')).toBe('login@example.com');
  }, 60_000);

  it('G6: "Send new codes" starts the signup again, and the page stays on the code step', async () => {
    await script({ verificationRequired: ['email'] });
    const { page, credentials } = await openApp();
    await fillSignup(page, { email: 'new@example.com' });
    await page.getByTestId('codes-form').waitFor({ timeout: 10_000 });

    await page.getByTestId('resend').click();
    await page.waitForFunction(() =>
      document.querySelector('[data-testid=status]')?.textContent?.includes('New codes sent')
    );

    expect(await requestsTo('/passkey/register')).toHaveLength(2);
    expect(await page.getByTestId('codes-form').isVisible()).toBe(true);
    expect(await credentials()).toHaveLength(0);

    await page.getByTestId('code-email').fill(EMAIL_CODE);
    await page.getByTestId('codes-submit').click();
    expect(await textOf(page, 'user')).toBe('new@example.com');
  }, 60_000);

  it('G7: two clicks in the same tick run one flow', async () => {
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').evaluate((button: HTMLElement) => {
      button.click();
      button.click();
    });

    expect(await textOf(page, 'user')).toBe('login@example.com');
    expect(await requestsTo('/passkey/challenge')).toHaveLength(1);
  }, 60_000);

  it('G8: after five wrong codes the page stops asking', async () => {
    await script({ verificationRequired: ['email'] });
    const { page } = await openApp();
    await fillSignup(page, { email: 'new@example.com' });
    await page.getByTestId('codes-form').waitFor({ timeout: 10_000 });

    for (let attempt = 1; attempt <= 4; attempt++) {
      await page.getByTestId('code-email').fill('000000');
      await page.getByTestId('codes-submit').click();
      await vi.waitFor(async () => expect(await requestsTo('/oauth/token')).toHaveLength(attempt), { timeout: 10_000 });
      await page.getByTestId('code-email').waitFor({ timeout: 10_000 }); // asked again
    }

    await page.getByTestId('code-email').fill('000000'); // the fifth wrong code
    await page.getByTestId('codes-submit').click();

    expect(await textContaining(page, 'status', 'Too many wrong codes')).toContain('Too many wrong codes');
    expect(await page.getByTestId('codes-form').count()).toBe(0);
    expect(await requestsTo('/oauth/token')).toHaveLength(5);
  }, 60_000);

  it('G9: a server error on complete is sent once more, and the login still succeeds', async () => {
    await script({ token: [{ status: 500, json: { error: 'server_error', error_description: 'boom' } }] });
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').click();

    expect(await textOf(page, 'user')).toBe('login@example.com');
    expect(await requestsTo('/oauth/token')).toHaveLength(2); // the first one was answered with the 500
  }, 60_000);

  it('G10: a server error that repeats keeps the passkey: "Try again" sends it again, and no second passkey is made', async () => {
    const boom = { status: 500, json: { error: 'server_error', error_description: 'boom' } };
    await script({ token: [boom, boom] });
    const { page, credentials } = await openApp();

    await fillSignup(page, { email: 'new@example.com' });

    expect(await textContaining(page, 'status', 'Try again')).toContain('The passkey could not be used');
    const made = await credentials();
    expect(made).toHaveLength(1);
    await page.getByTestId('retry').click();

    expect(await textOf(page, 'user')).toBe('new@example.com');
    expect((await credentials())[0]?.credentialId).toBe(made[0]?.credentialId);
    expect(await requestsTo('/passkey/register')).toHaveLength(1);
    expect(await requestsTo('/oauth/token')).toHaveLength(3);
  }, 60_000);

  it('G11: a failure that ends the flow shows its reason once and offers no retry', async () => {
    await script({
      token: [{ status: 400, json: { error: 'invalid_grant', error_description: 'The passkey was already used.' } }],
    });
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'already used')).toContain('Start again');
    expect(await page.getByTestId('retry').count()).toBe(0);
    expect(await requestsTo('/oauth/token')).toHaveLength(1); // the second request found no flow: Auth0 was not called
  }, 60_000);

  it('G12: Auth0 rate limiting on complete shows the wait, and "Try again" sends the same request', async () => {
    await script({
      token: [
        {
          status: 429,
          json: { error: 'too_many_requests', error_description: 'slow down' },
          headers: { 'retry-after': '3' },
        },
      ],
    });
    const { page, addPasskey } = await openApp();
    await addPasskey();

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'Try again in 3 seconds')).toContain('Auth0 is rate limiting');
    await page.getByTestId('retry').click();

    expect(await textOf(page, 'user')).toBe('login@example.com');
    expect(await requestsTo('/oauth/token')).toHaveLength(2);
  }, 60_000);

  it('G13: a flow that is gone is explained, and the page offers a clean start', async () => {
    const { page, addPasskey } = await openApp();
    await addPasskey();
    // The flow cookie goes away between the start and the complete request, as if it had expired or another tab had
    // replaced it.
    await page.route('**/api/passkey/complete', async (route) => {
      await page.context().clearCookies({ name: '__a0_passkey_tx' });
      await route.continue();
    });

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'This login is over')).toContain('Start again');
    await page.getByTestId('login').waitFor({ timeout: 10_000 });
    expect(await requestsTo('/oauth/token')).toHaveLength(0);
  }, 60_000);

  it('G14: a network failure on complete is sent once more, and "Try again" works when the network is back', async () => {
    const { page, addPasskey } = await openApp();
    await addPasskey();
    let offline = true;
    await page.route('**/api/passkey/complete', (route) => (offline ? route.abort() : route.continue()));

    await page.getByTestId('login').click();

    expect(await textContaining(page, 'status', 'did not answer')).toContain('Try again');
    offline = false;
    await page.getByTestId('retry').click();

    expect(await textOf(page, 'user')).toBe('login@example.com');
    expect(await requestsTo('/oauth/token')).toHaveLength(1);
  }, 60_000);
});
