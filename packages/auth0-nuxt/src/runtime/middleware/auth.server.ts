import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { useUser } from '../composables/use-user';
import { importMetaServer } from '../helpers/import-meta';

/**
 * Middleware that ensures the useUser composable is populated with the current user.
 * This is necessary for server-side rendering to ensure the user has a session when rendering the page.
 *
 * Routes can opt out with the `auth0: { ssrUser: false }` route rule (or the module-level
 * `ssrUser: false` default), which keeps the user out of the `__NUXT__` payload embedded in
 * the rendered HTML — important when that HTML is served from a shared cache. The
 * `auth.server` Nitro plugin resolves that decision into `event.context.auth0SsrUser`, and
 * the `auth.client` plugin hydrates the user in the browser instead.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (importMetaServer) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    if (!h3Event.context.auth0SsrUser) {
      return;
    }

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const user = await auth0Client.getUser();

    useUser().value = user;
  }
});