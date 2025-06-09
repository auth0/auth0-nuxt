import { defineNuxtRouteMiddleware, useNuxtApp } from "#imports";
import { useSession } from "../composables/use-session";
/**
 * Middleware that ensures the useSession composable is populated with the current session.
 * This is necessary for server-side rendering to ensure the session is available
 * when rendering the page.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;
    const auth0Client = h3Event.context.auth0Client;

    const session = await auth0Client.getSession({ event: h3Event });

    useSession().value = session;
  }
});