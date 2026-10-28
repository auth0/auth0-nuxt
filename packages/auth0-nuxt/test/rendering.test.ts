// @vitest-environment node
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { setup, createPage } from '@nuxt/test-utils';
import { randomUUID } from 'uncrypto';

describe('ssr', async () => {
  await setup({
    rootDir: fileURLToPath(new URL('./fixtures/basic', import.meta.url)),
    port: 3000,
    nuxtConfig: {
      runtimeConfig: {
        auth0: {
          domain: process.env.NUXT_AUTH0_DOMAIN!,
          clientId: process.env.NUXT_AUTH0_CLIENT_ID!,
          clientSecret: process.env.NUXT_AUTH0_CLIENT_SECRET!,
          sessionSecret: randomUUID(),
          appBaseUrl: 'http://127.0.0.1:3000',
        }
      },
    },
  });

  it('renders logged out by default', async () => {
    const page = await createPage('/');
    const loginLink = await page.getByTestId('login-link');
    expect(await loginLink.isVisible()).toBe(true);
  });

  it('should end up being logged in when clicking log in and logged out when clicking log out', async () => {
    console.log('Logging Domain and Username');
    console.log(process.env.NUXT_AUTH0_DOMAIN);
    console.log(`Username: ${process.env.NUXT_AUTH0_TEST_USERNAME}`);

    const page = await createPage('/');
    const loginLink = page.getByTestId('login-link');
    await loginLink.click();

    // Login at Auth0
    expect(await page.locator('input[name=username]').isVisible()).toBe(true);
    expect(await page.locator('input[name=password]').isVisible()).toBe(true);
    expect(await page.locator('button[type=submit][name=action]').isVisible()).toBe(true);

    const usernameInput = page.locator('input[name=username]');
    const passwordInput = page.locator('input[name=password]');
    const submitButton = page.locator('button[type=submit][name=action]');

    await usernameInput.fill(process.env.NUXT_AUTH0_TEST_USERNAME!);
    await passwordInput.fill(process.env.NUXT_AUTH0_TEST_PASSWORD!);
    await submitButton.click();

    await page.waitForURL('http://127.0.0.1:3000/');

    // Expect the logout link to be visible after logging in
    const logoutLink = page.getByTestId('logout-link');
    expect(await logoutLink.isVisible()).toBe(true);

    // Logout
    await logoutLink.click();

    const logoutPageUrl = await page.url();

    // When the oidc logout endpoint is hit, it will redirect to a confirmation page unless the tenant is configured to skip it.
    // We need to handle this case by clicking the confirm button.
    if (logoutPageUrl.includes('oidc/logout/confirm')) {
      const confirmButton = page.locator('button[type=submit][value=accept]');
      await confirmButton.click();
    }

    await page.waitForURL('http://127.0.0.1:3000/');

    // Expect the login link to be visible after logging out
    expect(await loginLink.isVisible()).toBe(true);
  });
});
