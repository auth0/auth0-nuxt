import type { SessionConfiguration, SessionStore as GenericSessionStore } from '@auth0/auth0-server-js';
import { H3Event } from 'h3';

export interface StoreOptions {
  event: H3Event;
}

export type SessionStore = GenericSessionStore<StoreOptions>;

export interface Auth0ClientOptions {
  domain: string;
  clientId: string;
  clientSecret: string;
  appBaseUrl: string;
  sessionSecret: string;
  audience?: string;
  sessionConfiguration?: SessionConfiguration;
}

export interface Auth0PublicConfig {
  routes?: RouteConfig;
}

export interface RouteConfig {
  login?: string;
  callback?: string;
  logout?: string;
  backchannelLogout?: string;
}
