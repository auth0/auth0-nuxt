import { defineNuxtRouteMiddleware, useNuxtApp } from "#imports";
import { useSession } from "../composables/use-session";
import { importMetaServer } from "../helpers/import-meta";

/**
 * Middleware that ensures the useSession composable is populated with the current session.
 * This is necessary for server-side rendering to ensure the session is available
 * when rendering the page.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (importMetaServer) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const session = await auth0Client.getSession();

    useSession().value = session;
  }
});