import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, getQuery, sendRedirect } from 'h3';
import { toSafeRedirect } from './../../utils/url';

interface LoginParams {
  returnTo?: string;
}

const DENIED_KEYS = new Set([
  ...Object.getOwnPropertyNames(Object.prototype),
  '__proto__',
  'constructor',
  'prototype',
]);

const RESERVED_OAUTH_PARAMS = new Set([
  'response_type',
  'state',
  'code_challenge',
  'code_challenge_method',
  'client_id',
  'redirect_uri',
  'nonce',
  'scope',
  'audience',
]);

function filterAuthorizationParams(
  params: Record<string, unknown>,
  disallowed: string[]
): Record<string, unknown> | undefined {
  const filtered: Record<string, unknown> = Object.create(null);

  for (const [key, value] of Object.entries(params)) {
    if (!DENIED_KEYS.has(key) && !disallowed.includes(key) && !RESERVED_OAUTH_PARAMS.has(key)) {
      filtered[key] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const auth0ClientOptions = event.context.auth0ClientOptions;
  const query = getQuery<LoginParams>(event);
  const dangerousReturnTo = query.returnTo ?? auth0ClientOptions.appBaseUrl;

  const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, auth0ClientOptions.appBaseUrl);

  const authorizationUrl = await auth0Client.startInteractiveLogin({
    appState: { returnTo: sanitizedReturnTo },
    authorizationParams: filterAuthorizationParams(query, ['returnTo']),
  });

  sendRedirect(event, authorizationUrl.href);
});
