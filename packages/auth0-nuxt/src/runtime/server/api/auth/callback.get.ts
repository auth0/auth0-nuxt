import { defineEventHandler, sendRedirect } from 'h3';

export default defineEventHandler(async (event) => {
  const auth0Client = event.context.auth0Client;
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const { appState } = await auth0Client.completeInteractiveLogin<
    { returnTo: string } | undefined
  >(new URL(event.node.req.url as string, auth0ClientOptions.appBaseUrl), { event });

  sendRedirect(event, appState?.returnTo ?? auth0ClientOptions.appBaseUrl);
});