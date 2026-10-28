// The state of the fake Auth0. The plugin changes it, the test-only routes read and script it.

export type Identifier = 'email' | 'phone';

/** A scripted answer. The next call to that endpoint gets it instead of the normal behavior. */
export interface ScriptedResponse {
  status: number;
  json?: unknown;
  text?: string;
  headers?: Record<string, string>;
  /** Throw this as a network error (a TypeError, like `fetch` does) instead of answering. */
  networkError?: string;
}

/** A request the fake received. */
export interface FakeRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeSession {
  kind: 'signup' | 'login';
  verificationRequired: Identifier[];
  email?: string;
}

export interface FakeState {
  log: FakeRequest[];
  register: ScriptedResponse[];
  challenge: ScriptedResponse[];
  token: ScriptedResponse[];
  /** What the next signups ask the user to verify. */
  verificationRequired: Identifier[];
  /** Claims added to the ID token of the next token response, for example `session_expiry`. */
  idTokenClaims: Record<string, unknown>;
  sessions: Map<string, FakeSession>;
  counter: number;
}

/** The body of POST /__fake/script. Everything is optional. */
export interface FakeScript {
  reset?: boolean;
  verificationRequired?: Identifier[];
  idTokenClaims?: Record<string, unknown>;
  register?: ScriptedResponse[];
  challenge?: ScriptedResponse[];
  token?: ScriptedResponse[];
}

function emptyState(): FakeState {
  return {
    log: [],
    register: [],
    challenge: [],
    token: [],
    verificationRequired: [],
    idTokenClaims: {},
    sessions: new Map(),
    counter: 0,
  };
}

export const state: FakeState = emptyState();

/** Clears the log and the script. The counter keeps counting, so the ids of sessions stay unique. */
export function resetState(): void {
  Object.assign(state, emptyState(), { counter: state.counter });
}
