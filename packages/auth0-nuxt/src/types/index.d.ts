declare module '#auth0-session-store' {
  export default function createSessionStore<TStoreOptions>(): SessionStore<StoreOptions>;
}