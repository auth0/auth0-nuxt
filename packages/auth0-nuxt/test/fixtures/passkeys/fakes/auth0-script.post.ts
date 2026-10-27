import { defineEventHandler, readBody } from 'h3';
import { resetState, state, type FakeScript } from './fake-state';

// Test-only control of the fake Auth0: reset it, script its next answers, choose what signups must verify.
export default defineEventHandler(async (event) => {
  const script = await readBody<FakeScript>(event);

  if (script.reset) resetState();
  if (script.verificationRequired) state.verificationRequired = script.verificationRequired;
  if (script.idTokenClaims) state.idTokenClaims = script.idTokenClaims;
  for (const endpoint of ['register', 'challenge', 'token'] as const) {
    state[endpoint].push(...(script[endpoint] ?? []));
  }

  return { ok: true };
});
