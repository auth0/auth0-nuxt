import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, getQuery, sendRedirect } from 'h3';
import { toSafeRedirect } from './utils';

interface LoginParams {
  returnTo?: string;
}

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const query = getQuery<LoginParams>(event);
  const dangerousReturnTo = query.returnTo ?? auth0ClientOptions.appBaseUrl;

  const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, auth0ClientOptions.appBaseUrl);

  const authorizationUrl = await auth0Client.startInteractiveLogin({
    appState: { returnTo: sanitizedReturnTo },
  });

  sendRedirect(event, authorizationUrl.href);
});
