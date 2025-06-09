import { useRuntimeConfig } from '#imports';
import { ServerClient } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { CookieTransactionStore } from '../../../store/cookie-transaction-store';
import { StatelessStateStore } from '../../../store/stateless-state-store';

declare module 'h3' {
  interface H3EventContext {
    auth0Client: ServerClient<{ event: H3Event }>;
  }
}

export interface Auth0ClientOptions {
  domain: string;
  clientId: string;
  clientSecret: string;
  appBaseUrl: string;
  sessionSecret: string;
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();
  const options = config.auth0 as Auth0ClientOptions;

  if (!options.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!options.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!options.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!options.appBaseUrl) throw new Error('Auth0 configuration error: App Base URL is required');
  if (!options.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  const callbackPath = '/auth/callback';
  const redirectUri = new URL(callbackPath, options.appBaseUrl);

  const auth0Client = new ServerClient({
    domain: options.domain,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationParams: {
      redirect_uri: redirectUri.toString(),
    },
    transactionStore: new CookieTransactionStore(),
    stateStore: new StatelessStateStore({
      secret: options.sessionSecret,
    }),
  });

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0Client = auth0Client;
    event.context.auth0ClientOptions = {
        appBaseUrl: options.appBaseUrl,
    };
  });
});