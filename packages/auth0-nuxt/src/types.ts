import type { SessionConfiguration, SessionStore as GenericSessionStore } from '@auth0/auth0-server-js';
import { H3Event } from 'h3';

/**
 * Configuration for session management in Auth0.
 * This includes options for how sessions are stored and managed.
 * It can be used to define stateful or stateless sessions.
 */
export interface StoreOptions {
  event: H3Event;
}

/**
 * Generic session store type that can be used with the Auth0 SDK.
 * This type is used to define the session store implementation for stateful sessions.
 * It should implement the methods required by the Auth0 SDK.
 *
 * @example
 * ```typescript
 * export class MyRedisStore implements SessionStore {
 *  readonly #store: Storage<StateData>;
 *
 *  constructor(store: Storage<StateData>) {
 *    this.#store = store;
 *  }
 *  async delete(identifier: string): Promise<void> {
 *    await this.#store.removeItem(identifier);
 *  }
 *
 *  async set(identifier: string, stateData: StateData): Promise<void> {
 *    await this.#store.setItem(identifier, stateData);
 *  }
 *
 * async get(identifier: string): Promise<StateData | undefined> {
 *   const result = await this.#store.getItem<StateData>(identifier);
 *
 *   // As redis returns null if the key does not exist, we need to map it to undefined
 *   return result ?? undefined;
 * }
 *
 *  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
 *   // Implement your logic to delete by logout token
 *   // This is just a placeholder
 *   console.log('Deleting by logout token:', claims);
 *  }
 * }
 * ```
 */
export type SessionStore = GenericSessionStore<StoreOptions>;

/**
 * Options for configuring the Auth0 client.
 * These options are used to initialize the Auth0 client and define its behavior.
 */
export interface Auth0ClientOptions {
  /**
   * The Auth0 domain.
   * This is the domain where your Auth0 tenant is hosted.
   * It is used to construct the URLs for authentication endpoints.
   * @example 'your-domain.auth0.com'
   */
  domain: string;

  /**
   * The Auth0 client ID.
   * This is the unique identifier for your Auth0 application.
   * It is used to identify your application when making requests to Auth0.
   * @example 'your-client-id'
   */
  clientId: string;

  /**
   * The Auth0 client secret.
   * This is a secret key used to sign and verify tokens.
   * It is important to keep this secret and not expose it in client-side code.
   * @example 'your-client-secret'
   */
  clientSecret: string;

  /**
   * The base URL of your application.
   * This is the URL where your application is hosted.
   * It is used to construct redirect URIs for authentication flows.
   * @example 'http://localhost:3000'
   */
  appBaseUrl: string;

  /**
   * The secret used to sign session cookies.
   */
  sessionSecret: string;

  /**
   * The audience for a third-party API you want to interact with.
   * This is the identifier for the API you want to access.
   * It is used to request access tokens for the API.
   * @example 'https://api.your-domain.com'
   */
  audience?: string;

  /**
   * The configuration for session management.
   * This includes options for how sessions are stored and managed.
   */
  sessionConfiguration?: SessionConfiguration;
}

/**
 * Configuration for the Auth0 routes.
 * This allows you to customize the URLs used by the SDK.
 */
export interface RouteConfig {
  /**
   * The URL for the login route.
   * @example '/auth/login'
   */
  login?: string;

  /**
   * The URL for the callback route.
   * @example '/auth/callback'
   */
  callback?: string;

  /**
   * The URL for the logout route.
   * @example '/auth/logout'
   */
  logout?: string;

  /**
   * The URL for the backchannel logout route.
   * @example '/auth/backchannel-logout'
   */
  backchannelLogout?: string;
}
