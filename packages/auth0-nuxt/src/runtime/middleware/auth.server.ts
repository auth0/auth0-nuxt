import { defineNuxtRouteMiddleware, useNuxtApp } from "#imports";
import { useUser } from "../composables/use-user";
import { importMetaServer } from "../helpers/import-meta";

/**
 * Middleware that ensures the useUser composable is populated with the current user.
 * This is necessary for server-side rendering to ensure the user has a session when rendering the page.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (importMetaServer) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const user = await auth0Client.getUser();

    useUser().value = user;
  }
});