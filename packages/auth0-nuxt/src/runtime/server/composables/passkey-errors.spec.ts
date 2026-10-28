// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as sdk from '@auth0/auth0-server-js';
import * as passkeyErrors from './passkey-errors';

describe('passkey-errors', () => {
  it('PE1: exports exactly the nine names the docs and the example use', () => {
    // Adding or removing a name is a conscious change: it widens or narrows what apps can use without an import.
    expect(Object.keys(passkeyErrors).sort()).toEqual([
      'InvalidConfigurationError',
      'MissingRequiredArgumentError',
      'MissingTransactionError',
      'OrganizationValidationError',
      'PasskeyChallengeError',
      'PasskeyGetTokenError',
      'PasskeyRegisterError',
      'SessionExpiredError',
      'isMfaRequiredError',
    ]);
  });

  it.each(Object.keys(passkeyErrors))('PE2: %s is the export of @auth0/auth0-server-js itself', (name) => {
    // `instanceof` in app code only works when the class is the one the SDK throws.
    expect((passkeyErrors as Record<string, unknown>)[name]).toBe((sdk as Record<string, unknown>)[name]);
  });
});
