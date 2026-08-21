import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, sendRedirect } from 'h3';
import { resolveAppBaseUrl } from './../../utils/app-base-url';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;

  const returnTo = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);
  const logoutUrl = await auth0Client.logout({ returnTo });

  sendRedirect(event, logoutUrl.href);
});
