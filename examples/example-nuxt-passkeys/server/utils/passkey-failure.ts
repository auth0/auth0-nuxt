import type { H3Event } from 'h3';
import type { PasskeyVerificationIdentifier } from '@auth0/auth0-nuxt';

export type PasskeyStatus =
  | 'complete'
  | 'mfa_required'
  | 'retry'
  | 'invalid'
  | 'wait'
  | 'session_expired'
  | 'restart'
  | 'failed'
  | 'rate_limited'
  | 'error'
  | 'forbidden';

/** What the routes answer. The browser acts on `status`. */
export interface PasskeyBody {
  status: PasskeyStatus;
  message?: string;
  verificationRequired?: PasskeyVerificationIdentifier[];
  retryAfterSeconds?: number;
}

/** An answer the guard or the input check gives instead of calling Auth0. */
export class PasskeyHttpError extends Error {
  statusCode: number;
  body: PasskeyBody;
  headers: Record<string, string>;

  constructor(statusCode: number, body: PasskeyBody, headers: Record<string, string> = {}) {
    super(`${statusCode} ${body.status}`);
    this.statusCode = statusCode;
    this.body = body;
    this.headers = headers;
  }
}

/**
 * A short description of an error that is safe to log: the Auth0 error description and code when there is one,
 * else the message. A server or network failure has no Auth0 error, so the reason comes from `cause.message` (for
 * example "fetch failed"). Never log or return the whole error: the `cause` of a passkey error can hold an `mfa_token`.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'Unknown error';
  }
  const { cause } = error as { cause?: Record<string, unknown> };
  const detail = [cause?.error, cause?.code, cause?.message].find(
    (value): value is string => typeof value === 'string' && value !== ''
  );
  const description =
    typeof cause?.error_description === 'string' && cause.error_description ? cause.error_description : error.message;
  return detail ? `${description} (${detail})` : description;
}

/** Sets the status and the headers of the answer, and returns its body. */
function reply(
  event: H3Event,
  statusCode: number,
  body: PasskeyBody,
  headers: Record<string, string> = {}
): PasskeyBody {
  setResponseStatus(event, statusCode);
  for (const [name, value] of Object.entries(headers)) {
    setResponseHeader(event, name, value);
  }
  return body;
}

/**
 * The seconds Auth0 asks us to wait, when its `Retry-After` header is a positive whole number of seconds (at most 5
 * digits). Else nothing. `Number()` would also take `1e3` and `0x10`, which are not seconds.
 */
function waitFor(error: { headers?: Headers }): { retryAfterSeconds?: number } {
  const header = error.headers?.get('retry-after') ?? '';
  const seconds = /^\d{1,5}$/.test(header) ? Number(header) : 0;
  return seconds > 0 ? { retryAfterSeconds: seconds } : {};
}

const retryAfterHeader = ({ retryAfterSeconds }: { retryAfterSeconds?: number }): Record<string, string> =>
  retryAfterSeconds ? { 'Retry-After': String(retryAfterSeconds) } : {};

/**
 * Answers an error from `startSignup()` or `startLogin()`. An error that is not a refusal by Auth0 (a bug, a failure of
 * your own store, a network failure) is thrown again, so that Nitro answers with `Server Error` and no details. Never
 * let an Auth0 refusal go through uncaught: Nitro takes the HTTP status from an error that has a `statusCode`, so a 401
 * for a wrong client secret would reach the browser as a 401 of your app.
 */
export function startFailure(event: H3Event, error: unknown): PasskeyBody {
  if (error instanceof PasskeyHttpError) {
    return reply(event, error.statusCode, error.body, error.headers);
  }
  if (error instanceof PasskeyRegisterError || error instanceof PasskeyChallengeError) {
    if (error.statusCode === 429) {
      const wait = waitFor(error);
      return reply(event, 429, { status: 'rate_limited', ...wait }, retryAfterHeader(wait));
    }
    // Auth0's description stays in the server log. It can name your settings (for example when the client secret is
    // wrong) or tell whether an address has an account, so the browser gets only the status and the page uses its own
    // sentence.
    console.warn('passkey start failed:', describeError(error));
    return reply(event, 400, { status: 'error' });
  }
  throw error;
}

/**
 * Answers an error from `passkey.complete()`. It follows the table in the "Login and Signup using Passkeys" section of
 * EXAMPLES.md. The SDK has already kept or cleared the flow.
 */
export function completeFailure(event: H3Event, error: unknown): PasskeyBody {
  if (error instanceof PasskeyHttpError) {
    return reply(event, error.statusCode, error.body, error.headers);
  }
  if (isMfaRequiredError(error)) {
    // The passkey (and the codes) were accepted, but the user must also complete MFA, which `useAuth0` cannot continue
    // yet. This route stops here. Never send `error.cause.mfa_token` to the browser.
    return reply(event, 200, { status: 'mfa_required' });
  }
  if (error instanceof SessionExpiredError) {
    // The passkey was accepted, but the ID token says the session has already expired, so no session was created and
    // the SDK has already deleted the flow. The user signs in again.
    return reply(event, 400, { status: 'session_expired' });
  }
  if (error instanceof PasskeyGetTokenError && error.isRetryable) {
    // A wrong code. Ask again for the identifiers still listed, and send the same credential.
    return reply(event, 400, { status: 'retry', verificationRequired: error.verificationRequired ?? [] });
  }
  if (error instanceof PasskeyGetTokenError && error.statusCode === 429) {
    // Auth0 checks its rate limit before it uses the attempt, so the same request can be sent again later.
    const wait = waitFor(error);
    return reply(event, 429, { status: 'wait', ...wait }, retryAfterHeader(wait));
  }
  if (
    error instanceof MissingRequiredArgumentError ||
    (error instanceof PasskeyGetTokenError && error.cause?.error === 'invalid_request')
  ) {
    // An incomplete or invalid request, for example a missing code. The flow is still open.
    console.warn('passkey.complete() request was invalid:', describeError(error));
    return reply(event, 400, { status: 'invalid' });
  }
  if (error instanceof MissingTransactionError) {
    // No flow to complete: none was started, it expired, or a newer start replaced it. Auth0 was not called.
    return reply(event, 400, { status: 'restart' });
  }
  if (error instanceof PasskeyGetTokenError) {
    // Usually the end of the attempt (too many wrong codes, the time ran out). After a server or network error the SDK
    // keeps the flow, so the browser sends the same request once more before it starts again.
    console.warn('passkey.complete() failed:', describeError(error));
    return reply(event, 400, { status: 'failed' });
  }
  throw error;
}
