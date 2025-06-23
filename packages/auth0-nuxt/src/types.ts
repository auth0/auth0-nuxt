import type { SessionStore as GenericSessionStore } from '@auth0/auth0-server-js';
import { H3Event } from 'h3';

export interface StoreOptions {
  event: H3Event
}

export type SessionStore = GenericSessionStore<StoreOptions>;