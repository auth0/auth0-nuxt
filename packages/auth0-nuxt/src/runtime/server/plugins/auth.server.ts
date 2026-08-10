import { useRuntimeConfig } from '#imports';
import { ServerClient, type SessionStore } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { getRouteRules } from 'nitropack/runtime';
import { resolveSsrUser } from '../utils/resolve-ssr-user';
import type { StoreOptions } from '~/src/types';

declare module 'h3' {
  interface H3EventContext {
    auth0Client: ServerClient<{ event: H3Event }>;
    /**
     * Whether the SSR auth middleware should write the authenticated user into `useUser()`
     * for this request. Resolved from the `auth0.ssrUser` route rule and the module-level
     * default; see `resolve-ssr-user.ts`.
     */
    auth0SsrUser: boolean;
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
  const options = config.auth0;

  if (!options.domain) throw new Error('Auth0 configuration error: Domain is required');
  if (!options.clientId) throw new Error('Auth0 configuration error: Client ID is required');
  if (!options.clientSecret) throw new Error('Auth0 configuration error: Client Secret is required');
  if (!options.appBaseUrl) throw new Error('Auth0 configuration error: App Base URL is required');
  if (!options.sessionSecret) throw new Error('Auth0 configuration error: Session Secret is required');

  const sessionStoreInstance = await tryLoadSessionStore();

  // The module-level `ssrUser` default. A per-route `auth0.ssrUser` rule overrides it.
  const globalSsrUser = (config.public.auth0 as { ssrUser?: boolean } | undefined)?.ssrUser !== false;

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0ClientOptions = options;
    event.context.auth0SessionStore = sessionStoreInstance;
    // Resolved here rather than in the middleware: `getRouteRules` is a plain server-only
    // import in this file, whereas importing it from the middleware would drag Nitro's
    // virtual modules into the client bundle and break the build.
    event.context.auth0SsrUser = resolveSsrUser(getRouteRules, event, globalSsrUser);
  });
});
