import { defineEventHandler, sendRedirect } from 'h3';

export default defineEventHandler(async (event) => {
 const auth0Client = event.context.auth0Client;
 const auth0ClientOptions = event.context.auth0ClientOptions;

  const returnTo = auth0ClientOptions.appBaseUrl;
  const logoutUrl = await auth0Client.logout(
    { returnTo: returnTo.toString() },
    { event }
  );

  sendRedirect(event, logoutUrl.href);
});