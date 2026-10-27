import type { H3Event } from 'h3';
import {
  CookieTransactionStore,
  ServerClient,
  StatefulStateStore,
  StatelessStateStore,
  type AccessTokenForConnectionOptions,
  type ConnectionTokenSet,
  type LoginBackchannelOptions,
  type LoginBackchannelResult,
  type LogoutOptions,
  type PasskeyChallengeOptions,
  type PasskeyCompleteOptions,
  type PasskeyGetTokenResult,
  type PasskeyRegisterOptions,
  type PasskeyStartLoginResult,
  type PasskeyStartSignupResult,
  type RequestOptions,
  type StartInteractiveLoginOptions,
  type SessionData,
  type TokenSet,
  type UserClaims,
} from '@auth0/auth0-server-js';
import type { AuthorizationDetails } from '@auth0/auth0-auth-js';
import { NuxtCookieHandler } from '../utils/cookie-handler';
import type { Auth0ClientOptions, RouteConfig, SessionStore } from '~/src/types';
import { useRuntimeConfig } from '#imports';
import { importMetaClient } from '../../helpers/import-meta';
import { createRouteUrl } from '../utils/url';

/**
 * Passkey signup and login for server routes.
 *
 * A passkey flow takes two requests, because the WebAuthn calls only run in the browser. `startSignup()` or
 * `startLogin()` returns the options for `navigator.credentials.create()` or `navigator.credentials.get()` and keeps
 * the flow in the encrypted `__a0_passkey_tx` cookie. `complete()` exchanges the credential the browser made for
 * tokens and writes the session, which is the same as after an OIDC login. The Auth0 `authSession` never reaches your
 * code or the browser.
 *
 * Call these from server routes only: they read and write the cookies of the current request. The module mounts no
 * passkey routes, so your own validation, rate limits and bot checks sit in front of them.
 */
export interface Auth0PasskeyClient {
  /**
   * Starts a passkey signup. When the connection verifies the email address or the phone number, Auth0 sends the
   * one-time codes during this call, and the result lists the identifiers to verify in `verificationRequired`. Pass the
   * codes to `complete()`.
   *
   * Every call starts a new flow and, when verification is required, sends new codes. Rate limit the route that calls
   * this method yourself, per client IP address and per email address or phone number: anyone who can reach it can
   * make Auth0 send messages. Validate the options first: the browser must not be able to choose `organization`,
   * `userMetadata` or the `realm`.
   *
   * @param options The user's profile, the connection (`realm`) and `deliveryMethod` for the phone code.
   * @param requestOptions Per-request options. `headers` is where `auth0-forwarded-for` goes, with the user's IP address.
   * @throws {PasskeyRegisterError} When Auth0 refuses the request. `statusCode` is its HTTP status (429 when rate limited). Nothing is stored then.
   * @throws {InvalidConfigurationError} When `stateIdentifier` or `transactionIdentifier` is a prefix of `__a0_passkey_tx`, or the reverse. Auth0 is not called.
   */
  startSignup: (options: PasskeyRegisterOptions, requestOptions?: RequestOptions) => Promise<PasskeyStartSignupResult>;

  /**
   * Starts a passkey login for an existing user.
   *
   * @param options The connection (`realm`). Without one, Auth0 uses the tenant's Default Directory.
   * @param requestOptions Per-request options. `headers` is where `auth0-forwarded-for` goes, with the user's IP address.
   * @throws {PasskeyChallengeError} When Auth0 refuses the request. `statusCode` is its HTTP status (429 when rate limited). Nothing is stored then.
   * @throws {InvalidConfigurationError} When `stateIdentifier` or `transactionIdentifier` is a prefix of `__a0_passkey_tx`, or the reverse. Auth0 is not called.
   */
  startLogin: (options?: PasskeyChallengeOptions, requestOptions?: RequestOptions) => Promise<PasskeyStartLoginResult>;

  /**
   * Completes a signup or a login that `startSignup()` or `startLogin()` began in the same browser: exchanges the
   * credential for tokens and writes the session. The flow, including the `authSession`, is read from the cookie, never
   * from the request.
   *
   * @param options The credential the browser made, and one code for every identifier that still needs one.
   * @param requestOptions Per-request options. `headers` is where `auth0-forwarded-for` goes, with the user's IP address.
   * @throws {MissingTransactionError} When there is no flow, it expired, or a newer start replaced it. Auth0 is not called.
   * @throws {MissingRequiredArgumentError} When the credential is missing or unreadable. Auth0 is not called and the flow is kept.
   * @throws {PasskeyGetTokenError} When the exchange fails. `isRetryable` is true for a wrong code: ask again for `verificationRequired`
   *   and send the same credential. Use `isMfaRequiredError(error)` for an MFA requirement, and never send `error.cause.mfa_token` to the browser.
   * @throws {OrganizationValidationError} When the flow started with an `organization` and the organization claim of the ID token is missing or does not match. The flow is gone and no session is created. The class is from `@auth0/auth0-server-js` and is not auto-imported: check `error.name` if you do not import it.
   * @throws {SessionExpiredError} When the ID token says the session has already expired. No session is created.
   * @throws {InvalidConfigurationError} When `stateIdentifier` or `transactionIdentifier` is a prefix of `__a0_passkey_tx`, or the reverse. Auth0 is not called.
   */
  complete: (options: PasskeyCompleteOptions, requestOptions?: RequestOptions) => Promise<PasskeyGetTokenResult>;
}

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
  /** Passkey signup and login. See {@link Auth0PasskeyClient}. */
  passkey: Auth0PasskeyClient;
}

let instance: Auth0Client | undefined;

/**
 * @ignore
 */
export interface Auth0PublicConfig {
  routes?: RouteConfig;
}

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
    passkey: {
      // `serverClient.passkey` is read when a method is called, so apps that do not use passkeys pay nothing.
      startSignup: (options, requestOptions) => serverClient?.passkey.startSignup(options, { event }, requestOptions),
      startLogin: (options, requestOptions) => serverClient?.passkey.startLogin(options, { event }, requestOptions),
      complete: (options, requestOptions) => serverClient?.passkey.complete(options, { event }, requestOptions),
    },
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
function createServerClientInstance(
  options: Auth0ClientOptions,
  publicConfig: Auth0PublicConfig,
  sessionStore?: SessionStore
): ServerClient {
  const callbackPath = publicConfig.routes?.callback ?? '/auth/callback';
  const redirectUri = createRouteUrl(callbackPath, options.appBaseUrl);

  return new ServerClient({
    domain: options.domain,
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorizationParams: {
      audience: options.audience,
      redirect_uri: redirectUri.toString(),
    },
    stateIdentifier: options.stateIdentifier,
    transactionIdentifier: options.transactionIdentifier,
    transactionStore: new CookieTransactionStore(
      {
        secret: options.sessionSecret,
      },
      new NuxtCookieHandler()
    ),
    stateStore: sessionStore
      ? new StatefulStateStore(
          {
            ...options.sessionConfiguration,
            secret: options.sessionSecret,
            store: sessionStore,
          },
          new NuxtCookieHandler()
        )
      : new StatelessStateStore(
          {
            ...options.sessionConfiguration,
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
  if (importMetaClient) {
    throw new Error('The `useAuth0` composable should only be used on the server.');
  }

  if (!event) {
    throw new Error('useAuth0() can not be called without passing an H3Event instance.');
  }

  const runtimeConfig = useRuntimeConfig();

  event.context.auth0Client ??= createServerClientInstance(
    event.context.auth0ClientOptions,
    runtimeConfig.public.auth0 as Auth0PublicConfig,
    event.context.auth0SessionStore
  );

  // We need to recreate the nuxt instance every time, because the event context might change.
  instance = toNuxtInstance(event.context.auth0Client, event);

  return instance;
};
