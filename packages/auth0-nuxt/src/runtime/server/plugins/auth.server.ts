import { useRuntimeConfig } from '#imports';
import { setCookie, deleteCookie, getCookie, parseCookies } from 'h3';
import { ServerClient } from '@auth0/auth0-server-js';
import { defineNitroPlugin } from 'nitropack/dist/runtime/plugin';
import { CookieTransactionStore } from '../../../store/cookie-transaction-store';
import { StatelessStateStore } from '../../../store/stateless-state-store';
import type { CookieHandler, CookieSerializeOptions } from '~/src/store/cookie-handler';
import type { StoreOptions } from '~/src/types';

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

export class NuxtCookieHandler implements CookieHandler {
  setCookie(storeOptions: StoreOptions, name: string, value: string, options?: CookieSerializeOptions): void {
    return setCookie(storeOptions.event, name, value, options);
  }
  getCookie(storeOptions: StoreOptions, name: string): string | undefined {
    return getCookie(storeOptions.event, name);
  }
  getCookies(storeOptions: StoreOptions): Record<string, string> {
    return parseCookies(storeOptions.event);
  }
  deleteCookie(storeOptions: StoreOptions, name: string): void {
    return deleteCookie(storeOptions.event, name);
  }
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
      audience: options.audience,
      redirect_uri: redirectUri.toString(),
    },
    transactionStore: new CookieTransactionStore(new NuxtCookieHandler()),
    stateStore: new StatelessStateStore(
      {
        secret: options.sessionSecret,
      },
      new NuxtCookieHandler()
    ),
  });

  nitroApp.hooks.hook('request', async (event) => {
    event.context.auth0Client = auth0Client;
    event.context.auth0ClientOptions = {
      appBaseUrl: options.appBaseUrl,
    };
  });
});
