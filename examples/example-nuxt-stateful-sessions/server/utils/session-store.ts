import type { SessionStore, StateData } from '@auth0/auth0-nuxt';

type LogoutTokenClaims = Parameters<SessionStore['deleteByLogoutToken']>[0];

/**
 * A custom, server-side session store.
 *
 * By default the SDK uses a *stateless* session: the entire session is encrypted into the cookie.
 * Providing a session store (see `sessionStoreFactoryPath` in `nuxt.config.ts`) switches the SDK
 * to a *stateful* session: the cookie then only holds an encrypted session ID, and the session
 * data (`StateData`) is persisted here, server-side.
 *
 * This implementation keeps everything in a `Map` for illustration. In production you would back
 * it with a shared, durable store such as Redis or a database, so sessions survive restarts and
 * are shared across instances. See `examples/example-nuxt-web` for a Redis-backed store.
 *
 * The `SessionStore` interface requires `get`, `set`, `delete` and `deleteByLogoutToken`.
 */
export class InMemorySessionStore implements SessionStore {
  private readonly store = new Map<string, StateData>();

  async get(identifier: string): Promise<StateData | undefined> {
    return this.store.get(identifier);
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    this.store.set(identifier, stateData);
  }

  async delete(identifier: string): Promise<void> {
    this.store.delete(identifier);
  }

  /**
   * Called when a Back-Channel Logout token is received. Removes every stored session whose
   * `internal.sid` or `user.sub` matches the claims of the logout token.
   */
  async deleteByLogoutToken(claims: LogoutTokenClaims): Promise<void> {
    for (const [identifier, state] of this.store) {
      const matchesSid = claims.sid !== undefined && state.internal?.sid === claims.sid;
      const matchesSub = claims.sub !== undefined && state.user?.sub === claims.sub;
      if (matchesSid || matchesSub) {
        this.store.delete(identifier);
      }
    }
  }

  /** Inspection helper: the stored sessions as [identifier, state] pairs. */
  entries(): [string, StateData][] {
    return [...this.store];
  }
}

// One instance for the lifetime of the server, shared by every request.
export const sessionStore = new InMemorySessionStore();

export default function createSessionStore(): SessionStore {
  return sessionStore;
}
