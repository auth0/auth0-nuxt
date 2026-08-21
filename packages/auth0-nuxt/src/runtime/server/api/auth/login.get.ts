import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, getQuery, sendRedirect } from 'h3';
import { useRuntimeConfig } from '#imports';
import { createRouteUrl, toSafeRedirect } from './../../utils/url';
import { resolveAppBaseUrl } from './../../utils/app-base-url';
import type { Auth0PublicConfig } from '../../composables/use-auth0';

interface LoginParams {
  returnTo?: string;
}

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const runtimeConfig = useRuntimeConfig();
  const publicConfig = runtimeConfig.public.auth0 as Auth0PublicConfig;

  const appBaseUrl = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);
  const callbackPath = publicConfig.routes?.callback ?? '/auth/callback';
  const redirectUri = createRouteUrl(callbackPath, appBaseUrl);

  const query = getQuery<LoginParams>(event);
  const dangerousReturnTo = query.returnTo ?? appBaseUrl;
  const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, appBaseUrl);

  const authorizationUrl = await auth0Client.startInteractiveLogin({
    appState: { returnTo: sanitizedReturnTo },
    authorizationParams: { redirect_uri: redirectUri.toString() },
  });

  sendRedirect(event, authorizationUrl.href);
});
