import { defineNuxtPlugin, useRuntimeConfig } from '#imports';
import type { UserClaims } from '@auth0/auth0-server-js';
import { useUser } from '../composables/use-user';
import type { RouteConfig } from '../../types';

/** `sub` is the one claim every user has, so its presence is what separates claims from noise. */
const isClaims = (value: unknown): value is UserClaims =>
  typeof value === 'object' && value !== null && 'sub' in value && typeof value.sub === 'string';

/**
 * Names the shape of a non-claims response without echoing it: the body of an unmounted
 * route is a whole HTML page, and whatever else answers there is not ours to log.
 */
const describeResponse = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trimStart().startsWith('<') ? 'an HTML document' : 'a string';
  }
  if (Array.isArray(value)) {
    return 'an array';
  }
  if (typeof value === 'object') {
    return 'an object without a string `sub`';
  }
  return `a ${typeof value}`;
};

/** Reduces a fetch failure to its status code or error name; the message can carry the body. */
const describeError = (error: unknown): string => {
  const status = (error as { status?: unknown } | null)?.status;
  if (typeof status === 'number') {
    return `HTTP ${status}`;
  }
  return error instanceof Error ? error.name : 'an unknown error';
};

/**
 * Dev-only explanation for why `useUser()` stayed anonymous. The likely cause is the same in
 * every case: a `mountRoutes: false` app that never mounted the profile handler, which leaves
 * every opted-out route anonymous with no other signal.
 */
const warnAnonymous = (reason: string) => {
  if (import.meta.dev) {
    console.warn(
      `[auth0] ${reason}, so \`useUser()\` stays anonymous. ` +
        'If you set `mountRoutes: false`, mount the profile handler yourself.'
    );
  }
};

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
      const fetched = await $fetch<unknown>(routes.profile, {
        headers: { accept: 'application/json' },
        retry: false,
      });
      // Only claims may reach the ref. With `mountRoutes: false` and a catch-all page, Nuxt
      // answers this fetch with the page itself as 200 text/html, which ofetch resolves as a
      // string (`responseType: 'json'` does not change that), and a truthy string would render
      // every anonymous visitor as signed in. `null` or an empty body is the handler's "signed
      // out" and is not worth a warning.
      if (isClaims(fetched)) {
        user.value = fetched;
      } else if (fetched != null) {
        warnAnonymous(`\`${routes.profile}\` answered with ${describeResponse(fetched)} instead of user claims`);
      }
    } catch (error) {
      // Stay anonymous on failure; auth-dependent UI simply renders logged-out.
      warnAnonymous(`Fetching \`${routes.profile}\` failed with ${describeError(error)}`);
    }
  });
});
