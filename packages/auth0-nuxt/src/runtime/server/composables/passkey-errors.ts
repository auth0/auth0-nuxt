// Nuxt auto-imports the exports of this folder in server code, so a route can use these classes without importing
// `@auth0/auth0-server-js`. They are the classes the SDK throws, so `instanceof` works.
export {
  PasskeyRegisterError,
  PasskeyChallengeError,
  PasskeyGetTokenError,
  MissingTransactionError,
  MissingRequiredArgumentError,
  SessionExpiredError,
  OrganizationValidationError,
  InvalidConfigurationError,
  isMfaRequiredError,
} from '@auth0/auth0-server-js';
