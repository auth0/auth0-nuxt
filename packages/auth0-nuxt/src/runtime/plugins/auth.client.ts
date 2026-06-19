import { defineNuxtPlugin, useRuntimeConfig } from '#imports';
import type { UserClaims } from '@auth0/auth0-server-js';
import { useUser } from '../composables/use-user';
import type { RouteConfig } from '../../types';

/**
 * Client-side hydration of the authenticated user.
 *
 * When SSR did not populate `useUser()` — because the route is shared-cacheable
 * (the server middleware skipped the write) or because the route is client-rendered
 * (`ssr: false`) — fetch the user from the `no-store` profile endpoint after the app
 * suspense resolves. Deferring to `app:suspense:resolve` avoids a hydration mismatch.
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
    } catch {
      // Stay anonymous on failure; auth-dependent UI simply renders logged-out.
    }
  });
});
