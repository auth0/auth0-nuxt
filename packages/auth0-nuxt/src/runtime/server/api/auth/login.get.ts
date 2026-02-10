import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, getQuery, sendRedirect } from 'h3';
import { toSafeRedirect } from './../../utils/url';

interface LoginParams {
  returnTo?: string;
}

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const query = getQuery<LoginParams>(event);
  const dangerousReturnTo = query.returnTo ?? auth0ClientOptions.appBaseUrl;

  const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, auth0ClientOptions.appBaseUrl);

  // Extract authorization parameters from query string
  const authorizationParams: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    // We exclude 'returnTo' as it's handled separately
    if (key !== 'returnTo') {
      authorizationParams[key] = value;
    }
  }

  const authorizationUrl = await auth0Client.startInteractiveLogin({
    pushedAuthorizationRequests: auth0ClientOptions.pushedAuthorizationRequests,
    appState: { returnTo: sanitizedReturnTo },
    authorizationParams: Object.keys(authorizationParams).length > 0 ? authorizationParams : undefined,
  });

  sendRedirect(event, authorizationUrl.href);
});
