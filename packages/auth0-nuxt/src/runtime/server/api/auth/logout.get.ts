import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, sendRedirect } from 'h3';

export default defineEventHandler(async (event) => {
 const auth0Client = useAuth0(event);
 const auth0ClientOptions = event.context.auth0ClientOptions;

  const returnTo = auth0ClientOptions.appBaseUrl;
  const logoutUrl = await auth0Client.logout(
    { returnTo: returnTo.toString() },
  );

  sendRedirect(event, logoutUrl.href);
});