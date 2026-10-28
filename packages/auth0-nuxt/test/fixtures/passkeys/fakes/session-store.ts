import type { StateData } from '@auth0/auth0-server-js';
import type { SessionStore } from '../../../../src/types';

/** The sessions of the stateful test, read back through GET /__fake/session-store. */
export const sessions = new Map<string, StateData>();

/** A session store in memory. The module loads this default export through `sessionStoreFactoryPath`. */
export default function createSessionStore(): SessionStore {
  return {
    async get(identifier) {
      return sessions.get(identifier);
    },
    async set(identifier, stateData) {
      sessions.set(identifier, stateData);
    },
    async delete(identifier) {
      sessions.delete(identifier);
    },
    async deleteByLogoutToken() {
      // Not used by these tests.
    },
  };
}
