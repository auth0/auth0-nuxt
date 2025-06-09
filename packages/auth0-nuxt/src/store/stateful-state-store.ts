import type { CookieSerializeOptions } from 'cookie-es';
import type { EncryptedStoreOptions, LogoutTokenClaims, StateData } from '@auth0/auth0-server-js';
import type { SessionConfiguration, SessionCookieOptions, SessionStore, StoreOptions } from '../types.js';
import { AbstractSessionStore } from './abstract-session-store.js';
import { setCookie, deleteCookie, getCookie } from 'h3';

export interface StatefulStateStoreOptions extends EncryptedStoreOptions {
  store: SessionStore;
}

const generateId = () => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

export class StatefulStateStore extends AbstractSessionStore {
  readonly #store: SessionStore;
  readonly #cookieOptions: SessionCookieOptions | undefined;

  constructor(options: StatefulStateStoreOptions & SessionConfiguration) {
    super(options);

    this.#store = options.store;
    this.#cookieOptions = options.cookie;
  }

  async set(
    identifier: string,
    stateData: StateData,
    removeIfExists?: boolean,
    options?: StoreOptions | undefined
  ): Promise<void> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!options) {
      throw new Error('StoreOptions not provided');
    }

    let sessionId = await this.getSessionId(identifier, options);

    // if this is a new session created by a new login we need to remove the old session
    // from the store and regenerate the session ID to prevent session fixation.
    if (sessionId && removeIfExists) {
      await this.#store.delete(sessionId);
      sessionId = generateId();
    }

    sessionId ??= generateId();

    const maxAge = this.calculateMaxAge(stateData.internal.createdAt);
    const cookieOpts: CookieSerializeOptions = {
      httpOnly: true,
      sameSite: this.#cookieOptions?.sameSite ?? 'lax',
      path: '/',
      secure: this.#cookieOptions?.secure,
      maxAge,
    };
    const expiration = Date.now() / 1000 + maxAge;
    const encryptedStateData = await this.encrypt<{ id: string }>(
      identifier,
      {
        id: sessionId,
      },
      expiration
    );

    await this.#store.set(sessionId, stateData);

    setCookie(options.event, identifier, encryptedStateData, cookieOpts);
  }

  async get(identifier: string, options?: StoreOptions | undefined): Promise<StateData | undefined> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!options) {
      throw new Error('StoreOptions not provided');
    }

    const sessionId = await this.getSessionId(identifier, options);

    if (sessionId) {
      const stateData = await this.#store.get(sessionId);

      // If we have a session cookie, but no `stateData`, we should remove the cookie.
      if (!stateData) {
        deleteCookie(options.event, identifier);
      }

      return stateData;
    }
  }

  async delete(identifier: string, options?: StoreOptions | undefined): Promise<void> {
    // We can not handle cookies in Fastify when the `StoreOptions` are not provided.
    if (!options) {
      throw new Error('StoreOptions not provided');
    }

    const sessionId = await this.getSessionId(identifier, options);

    if (sessionId) {
      await this.#store.delete(sessionId);
    }

    deleteCookie(options.event, identifier);
  }

  private async getSessionId(identifier: string, options: StoreOptions) {
    const cookieValue = getCookie(options.event, identifier);
    if (cookieValue) {
      const sessionCookie = await this.decrypt<{ id: string }>(identifier, cookieValue);
      return sessionCookie.id;
    }
  }

  deleteByLogoutToken(claims: LogoutTokenClaims, options?: StoreOptions | undefined): Promise<void> {
    return this.#store.deleteByLogoutToken(claims, options);
  }
}
