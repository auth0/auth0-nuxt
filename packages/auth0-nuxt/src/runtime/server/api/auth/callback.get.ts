import { defineEventHandler, sendRedirect } from 'h3';
import { useAuth0 } from '../../composables/use-auth0';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const { appState } = await auth0Client.completeInteractiveLogin<
    { returnTo: string } | undefined
  >(new URL(event.node.req.url as string, auth0ClientOptions.appBaseUrl));

  sendRedirect(event, appState?.returnTo ?? auth0ClientOptions.appBaseUrl);
});