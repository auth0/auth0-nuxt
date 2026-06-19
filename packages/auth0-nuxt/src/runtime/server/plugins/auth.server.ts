import { useRuntimeConfig } from '#imports';
import { ServerClient, type SessionStore } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import type { Auth0ClientOptions, StoreOptions } from '~/src/types';
import { parseAppBaseUrl, validateAppBaseUrl, enforceSecureCookies } from '../utils/config';

declare module 'h3' {
  interface H3EventContext {
    auth0Client: ServerClient<{ event: H3Event }>;
  }
}

async function tryLoadSessionStore(): Promise<SessionStore<StoreOptions> | undefined> {
  try {
    const factoryModule = await import('#auth0-session-store');
    return factoryModule.default();
  } catch {
    return undefined;
  }
}

export default defineNitroPlugin(async (nitroApp) => {
  const config = useRuntimeConfig();
  const options = config.auth0 as Auth0ClientOptions;

  if (!options.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!options.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!options.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!options.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  // Normalize a comma-separated appBaseUrl (from env or config) into an allow-list,
  // then validate and (in production dynamic mode) enforce secure cookies.
  // Omitting appBaseUrl entirely enables dynamic, per-request resolution.
  if (typeof options.appBaseUrl === 'string') {
    options.appBaseUrl = parseAppBaseUrl(options.appBaseUrl);
  }
  validateAppBaseUrl(options.appBaseUrl);
  enforceSecureCookies(options, process.env.NODE_ENV === 'production');

  const sessionStoreInstance = await tryLoadSessionStore();

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0ClientOptions = options;
    event.context.auth0SessionStore = sessionStoreInstance;
  });
});
