import { defineEventHandler } from 'h3';
import { state } from './fake-state';

// Test-only: every request the fake Auth0 received since the last reset.
export default defineEventHandler(() => ({ log: state.log }));
