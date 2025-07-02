import { useRuntimeConfig } from '#imports';
import { ServerClient } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';

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
  audience?: string;
}

export default defineNitroPlugin((nitroApp) => {
  const config = useRuntimeConfig();
  const options = config.auth0 as Auth0ClientOptions;

  if (!options.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!options.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!options.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!options.appBaseUrl) throw new Error('Auth0 configuration error: App Base URL is required');
  if (!options.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0ClientOptions = options;
  });
});
