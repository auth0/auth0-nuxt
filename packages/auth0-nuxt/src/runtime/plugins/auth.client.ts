import { defineNuxtPlugin, useRuntimeConfig } from '#imports';
import type { UserClaims } from '@auth0/auth0-server-js';
import { useUser } from '../composables/use-user';
import type { RouteConfig } from '../../types';

/**
 * Client-side hydration of the authenticated user.
 *
 * When server-side rendering did not populate `useUser()` — because the route opted out with
 * `auth0: { ssrUser: false }`, or because it is client-rendered (`ssr: false`) — fetch the
 * user from the `no-store` profile endpoint once the app suspense resolves. Deferring to
 * `app:suspense:resolve` avoids a hydration mismatch.
 *
 * On a route that did render the user, the early return below makes this a no-op and no
 * request is made.
 */
export default defineNuxtPlugin(async (nuxtApp) => {
  const user = useUser();

  if (user.value) {
    return;
  }

  const routes = (useRuntimeConfig().public.auth0 as { routes: Required<RouteConfig> }).routes;

  nuxtApp.hook('app:suspense:resolve', async () => {
    try {
      const fetched = await $fetch<UserClaims | null>(routes.profile, {
        headers: { accept: 'application/json' },
        retry: false,
      });
      user.value = fetched ?? undefined;
    } catch (error) {
      // Stay anonymous on failure; auth-dependent UI simply renders logged-out. Warn in dev,
      // because the most likely cause is a `mountRoutes: false` app that never mounted the
      // profile handler — which leaves every opted-out route anonymous with no other signal.
      if (import.meta.dev) {
        console.warn(
          `[auth0] Could not fetch \`${routes.profile}\`, so \`useUser()\` stays anonymous. ` +
            'If you set `mountRoutes: false`, mount the profile handler yourself.',
          error
        );
      }
    }
  });
});
