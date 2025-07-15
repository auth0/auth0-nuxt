import type { Auth0ClientOptions } from '../types';

declare module 'nuxt/schema' {
  interface RuntimeConfig {
    auth0: Auth0ClientOptions;
  }
}
