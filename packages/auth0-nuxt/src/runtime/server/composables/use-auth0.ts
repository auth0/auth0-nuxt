import type { H3Event, SessionData } from 'h3';
import {
  CookieTransactionStore,
  ServerClient,
  StatelessStateStore,
  type AccessTokenForConnectionOptions,
  type ConnectionTokenSet,
  type LoginBackchannelOptions,
  type LoginBackchannelResult,
  type LogoutOptions,
  type StartInteractiveLoginOptions,
  type TokenSet,
  type UserClaims,
} from '@auth0/auth0-server-js';
import type { AuthorizationDetails } from '@auth0/auth0-auth-js';
import { NuxtCookieHandler } from '../utils/cookie-handler';
import type { Auth0ClientOptions } from '../plugins/auth.server';

export interface Auth0Client {
  startInteractiveLogin: (options?: StartInteractiveLoginOptions) => Promise<URL>;
  completeInteractiveLogin: <TAppState = unknown>(
    url: URL
  ) => Promise<{
    appState?: TAppState;
    authorizationDetails?: AuthorizationDetails[];
  }>;
  getUser: () => Promise<UserClaims | undefined>;
  getSession: () => Promise<SessionData | undefined>;
  getAccessToken: () => Promise<TokenSet>;
  getAccessTokenForConnection: (options: AccessTokenForConnectionOptions) => Promise<ConnectionTokenSet>;
  loginBackchannel: (options: LoginBackchannelOptions) => Promise<LoginBackchannelResult>;
  logout: (options: LogoutOptions) => Promise<URL>;
  handleBackchannelLogout: (logoutToken: string) => Promise<void>;
}

let instance: Auth0Client | undefined;

/**
 * Wraps the Auth0 server client instance to provide a Nuxt-specific interface, without the need to pass an H3 event instance to every method.
 * This allows the Auth0 client to be used in a Nuxt context, such as in server-side middleware or API routes.
 * @param serverClient The Auth0 server client instance
 * @param event The h3 event instance
 * @returns
 */
function toNuxtInstance(serverClient: ServerClient<{ event: H3Event }>, event: H3Event): Auth0Client {
  return {
    startInteractiveLogin: (options?: StartInteractiveLoginOptions) =>
      serverClient?.startInteractiveLogin(options, { event }),
    completeInteractiveLogin: <TAppState>(url: URL) =>
      serverClient?.completeInteractiveLogin<TAppState>(url, { event }),
    getUser: () => serverClient?.getUser({ event }),
    getSession: () => serverClient?.getSession({ event }),
    getAccessToken: () => serverClient?.getAccessToken({ event }),
    getAccessTokenForConnection: (options: AccessTokenForConnectionOptions) =>
      serverClient?.getAccessTokenForConnection(options, { event }),
    loginBackchannel: (options: LoginBackchannelOptions) => serverClient?.loginBackchannel(options, { event }),
    logout: (options: LogoutOptions) => serverClient?.logout(options, { event }),
    handleBackchannelLogout: (logoutToken: string) => serverClient?.handleBackchannelLogout(logoutToken, { event }),
  };
}

/**
 * Creates a new Auth0 server client instance with the provided options.
 * This function is used to create the Auth0 client instance that will be used in the Nuxt context.
 * It initializes the client with the necessary configuration, such as domain, client ID,
 * client secret, and other parameters required for authentication.
 * @param options The options to configure the Auth0 client instance.
 * @returns A new instance of the Auth0 server client configured for server-side use in a Nuxt application.
 */
function createServerClientInstance(options: Auth0ClientOptions): ServerClient {
  const callbackPath = '/auth/callback';
  const redirectUri = new URL(callbackPath, options.appBaseUrl);

  return new ServerClient({
    domain: options.domain,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationParams: {
      audience: options.audience,
      redirect_uri: redirectUri.toString(),
    },
    transactionStore: new CookieTransactionStore(
      {
        secret: options.sessionSecret,
      },
      new NuxtCookieHandler()
    ),
    stateStore: new StatelessStateStore(
      {
        secret: options.sessionSecret,
      },
      new NuxtCookieHandler()
    ),
  });
}

/**
 * A composable function that provides access to the Auth0 client instance in a Nuxt application.
 * It allows you to interact with the Auth0Client without needing to pass the H3 event instance to every method.
 * This is particularly useful in server-side middleware or API routes where you want to perform authentication operations.
 * @param event The H3 event instance to use for the Auth0 client.
 * @returns An instance of the Auth0Client that can be used to perform authentication operations.
 * @throws Error if the event instance is not provided.
 */
export const useAuth0 = (event: H3Event) => {
  if (!event) {
    throw new Error('useAuth0() can not be called without passing an H3Event instance.');
  }

  // If the instance is already created, do not override it.
  event.context.auth0Client ??= createServerClientInstance(event.context.auth0ClientOptions);

  // We need to recreate the nuxt instance every time, because the event context might change.
  instance = toNuxtInstance(event.context.auth0Client, event);

  return instance;
};
