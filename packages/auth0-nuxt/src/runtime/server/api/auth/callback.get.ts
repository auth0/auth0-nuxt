import { defineEventHandler, sendRedirect } from 'h3';
import { useAuth0 } from '../../composables/use-auth0';
import { toSafeRedirect } from './../../utils/url';
import { resolveAppBaseUrl } from './../../utils/app-base-url';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;

  const appBaseUrl = resolveAppBaseUrl(auth0ClientOptions.appBaseUrl, event);

  const { appState } = await auth0Client.completeInteractiveLogin<{ returnTo: string } | undefined>(
    new URL(event.node.req.url as string, appBaseUrl)
  );

  const safeReturnTo = appState?.returnTo ? toSafeRedirect(appState.returnTo, appBaseUrl) : appBaseUrl;

  sendRedirect(event, safeReturnTo ?? appBaseUrl);
});
