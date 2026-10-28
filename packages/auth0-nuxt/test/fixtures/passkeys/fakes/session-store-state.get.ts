import { defineEventHandler } from 'h3';
import { sessions } from './session-store';

// Test-only: the sessions the in-memory store holds, as [identifier, state] pairs.
export default defineEventHandler(() => ({ sessions: [...sessions] }));
