import { useRuntimeConfig } from '#imports';
import { ServerClient, type SessionStore } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import type { Auth0ClientOptions, StoreOptions } from '~/src/types';
import { resolveAuth0Options } from '../utils/config';

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
  const rawOptions = config.auth0 as Auth0ClientOptions;

  if (!rawOptions.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!rawOptions.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!rawOptions.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!rawOptions.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  // Normalize a comma-separated appBaseUrl (from env or config) into an allow-list,
  // validate it, and (in production dynamic mode) enforce secure cookies. This
  // returns a new object — the Nuxt runtime config is frozen and must not be
  // mutated. Omitting appBaseUrl entirely enables dynamic, per-request resolution.
  const options = resolveAuth0Options(rawOptions, process.env.NODE_ENV === 'production');

  const sessionStoreInstance = await tryLoadSessionStore();

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0ClientOptions = options;
    event.context.auth0SessionStore = sessionStoreInstance;
  });
});
