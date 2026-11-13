import { defineEventHandler } from 'h3';
import { sessionStore } from '../../../../../../examples/example-nuxt-stateful-sessions/server/utils/session-store';

// Test-only: the sessions the in-memory store of the example holds, as [identifier, state] pairs.
export default defineEventHandler(() => ({ sessions: sessionStore.entries() }));
