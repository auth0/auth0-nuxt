import type { H3Event } from 'h3';
import type {
  AccessTokenForConnectionOptions,
  ConnectionTokenSet,
  LoginBackchannelOptions,
  LoginBackchannelResult,
  LogoutOptions,
  ServerClient,
  StartInteractiveLoginOptions,
  TokenSet,
} from '@auth0/auth0-server-js';
import type { AuthorizationDetails } from '@auth0/auth0-auth-js';

export interface Auth0Client<TAppState = any> {
  startInteractiveLogin: (options?: StartInteractiveLoginOptions) => Promise<URL>;
  completeInteractiveLogin: (url: URL) => Promise<{
    appState?: TAppState;
    authorizationDetails?: AuthorizationDetails[];
  }>;
  getUser: () => Promise<any>;
  getSession: () => Promise<any>;
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
    completeInteractiveLogin: (url: URL) => serverClient?.completeInteractiveLogin(url, { event }),
    getUser: () => serverClient?.getUser({ event }),
    getSession: () => serverClient?.getSession({ event }),
    getAccessToken: () => serverClient?.getAccessToken({ event }),
    getAccessTokenForConnection: (options: AccessTokenForConnectionOptions) =>
      serverClient?.getAccessTokenForConnection(options, { event }),
    loginBackchannel: (options: LoginBackchannelOptions) => serverClient?.loginBackchannel(options, { event }),
    logout: (options: LogoutOptions) => serverClient?.logout(options, { event }),
    handleBackchannelLogout: (logoutToken: string) =>
      serverClient?.handleBackchannelLogout(logoutToken, { event }),
  };
}

export const useAuth0 = (event: H3Event) => {
  if (!event) {
    throw new Error('useAuth0() can not be called without passing an H3Event instance.');
  }

  instance ??= toNuxtInstance(event.context.auth0Client, event);

  return instance;
};
