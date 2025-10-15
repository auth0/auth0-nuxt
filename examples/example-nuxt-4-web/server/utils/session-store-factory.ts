import type { SessionStore, StateData, StoreOptions } from '@auth0/auth0-nuxt';
import type { Storage } from "unstorage";

export class MyRedisStore implements SessionStore {
  readonly #store: Storage<StateData>;

  constructor(store: Storage<StateData>) {
    this.#store = store;
  }
  async delete(identifier: string): Promise<void> {
    await this.#store.removeItem(identifier);
  }

  async set(identifier: string, stateData: StateData): Promise<void> {
    await this.#store.setItem(identifier, stateData);
  }

  async get(identifier: string): Promise<StateData | undefined> {
    const result = await this.#store.getItem<StateData>(identifier);

    // As redis returns null if the key does not exist, we need to map it to undefined
    return result ?? undefined;
  }

  async deleteByLogoutToken(claims: any, options?: StoreOptions): Promise<void> {
    // Implement your logic to delete by logout token
    // This is just a placeholder
    console.log('Deleting by logout token:', claims);
  }
}

export default function getSessionStoreInstance() {
  const storage = useStorage<StateData>('redis');
  return new MyRedisStore(storage);
}