import { expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import type { Page } from 'playwright-core';

/** Shared by the two suites that build `fixtures/unmounted-profile`, one per module option. */
export const rootDir = fileURLToPath(new URL('./fixtures/unmounted-profile', import.meta.url));

export const runtimeConfig = {
  auth0: {
    domain: 'example.auth0.local',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    sessionSecret: 'a-sufficiently-long-session-secret-value-1234567890',
    appBaseUrl: 'http://127.0.0.1:3003',
  },
};

export const isProfile = (target: string) => new URL(target).pathname === '/auth/profile';

/**
 * Waits until the fixture page reports that `app:suspense:resolve` has run through, which
 * with the client plugin registered means its fetch has settled and `useUser()` holds its
 * final value. Only then is the rendered user state worth reading.
 */
export async function hydratedUserState(page: Page): Promise<string | null> {
  await expect.poll(() => page.getByTestId('hydration').textContent(), { timeout: 5_000 }).toBe('settled');
  return page.getByTestId('user-state').textContent();
}
