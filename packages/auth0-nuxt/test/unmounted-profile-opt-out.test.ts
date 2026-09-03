// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { setup, createPage, url } from '@nuxt/test-utils';
import { rootDir, runtimeConfig, isProfile, hydratedUserState } from './unmounted-profile.shared';

/**
 * The unmounted-profile fixture with `hydrateUser: false`: the module leaves the client plugin
 * out, so the browser never asks for `/auth/profile` and the SSR-rendered anonymous state is
 * final. A separate file because `@nuxt/test-utils` holds one test context per file.
 */
describe('client hydration opted out with hydrateUser: false', async () => {
  // Module options are not in `NuxtConfig`'s type here, and a spread is not subject to the
  // excess-property check that a literal key would be.
  const auth0 = { auth0: { hydrateUser: false } };
  await setup({ rootDir, browser: true, nuxtConfig: { ...auth0, runtimeConfig } });

  it('makes no profile request', async () => {
    const page = await createPage();
    const requested: string[] = [];
    page.on('request', (request) => {
      if (isProfile(request.url())) {
        requested.push(request.url());
      }
    });

    await page.goto(url('/anything'), { waitUntil: 'hydration' });
    // With the plugin registered, its request goes out inside `app:suspense:resolve`, before
    // the page's own hook flips the marker. Waiting for the marker is what makes the empty
    // request list below meaningful rather than an early read.
    expect(await hydratedUserState(page)).toBe('anonymous');
    expect(requested).toEqual([]);

    await page.close();
  });
});
