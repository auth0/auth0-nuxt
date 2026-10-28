import type { H3Event } from 'h3';
import type {
  PasskeyCredentialResponse,
  PasskeyDeliveryMethod,
  PasskeyRegisterOptions,
  PasskeyVerificationCodes,
} from '@auth0/auth0-nuxt';

// What the browser may send. These checks copy only the fields the routes pass on, so the browser can never choose the
// `realm`, the `organization`, `userMetadata`, the scopes, the audience or any other option of the SDK, and Auth0 never
// receives a credential field it rejects.

/** A credential is a few KB. A larger body is not a passkey. */
const MAX_BODY_BYTES = 32 * 1024;
/** The longest text field of a credential. */
const MAX_FIELD_LENGTH = 8192;
/** Auth0 rejects a one-time code longer than this. */
const MAX_CODE_LENGTH = 10;
/** The client extension results that are passed on. The browser returns only the extensions the start options asked for. */
const EXTENSION_RESULTS = ['appid', 'credProps', 'largeBlob', 'prf'];
/** Levels of arrays and objects in an extension result. `prf` is the deepest: `{ results: { first } }`. */
const MAX_EXTENSION_DEPTH = 4;

export interface CompleteInput {
  credential: PasskeyCredentialResponse;
  verification?: PasskeyVerificationCodes;
}

type Json = Record<string, unknown>;

const invalid = (message: string) => new PasskeyHttpError(400, { status: 'invalid', message });

function object(value: unknown, name: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw invalid(`${name} must be an object.`);
  }
  return value as Json;
}

/** The text in `value`, or undefined when it is absent. Throws when it is not text of the allowed length. */
function text(value: unknown, name: string, min: number, max: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.length < min || value.length > max) {
    throw invalid(`${name} must be text of ${min} to ${max} characters.`);
  }
  return value;
}

function requiredText(value: unknown, name: string): string {
  const result = text(value, name, 1, MAX_FIELD_LENGTH);
  if (result === undefined) throw invalid(`${name} is required.`);
  return result;
}

/**
 * Reads the JSON body of a request: `application/json` only (else 415) and at most 32 KiB (else 413), also when the
 * length is not announced. Malformed JSON is a 400.
 */
export async function readJsonBody(event: H3Event): Promise<unknown> {
  if (!/^application\/json\s*(;|$)/i.test(getRequestHeader(event, 'content-type') ?? '')) {
    throw new PasskeyHttpError(415, { status: 'invalid', message: 'Send the body as application/json.' });
  }

  // `Connection: close`: the rest of an oversize body is not read, so the connection must not be reused.
  const tooLarge = () =>
    new PasskeyHttpError(
      413,
      { status: 'invalid', message: 'The request body is too large.' },
      { Connection: 'close' }
    );
  if (Number(getRequestHeader(event, 'content-length')) > MAX_BODY_BYTES) {
    throw tooLarge();
  }

  const chunks: Buffer[] = [];
  let size = 0;
  // `destroyOnReturn: false`: leaving the loop early does not destroy the request, so the 413 can be sent first. (A client
  // that is still sending a very large body can still see its connection reset.)
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false }) as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw tooLarge();
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw invalid('The body is not valid JSON.');
  }
}

/** The profile for `startSignup()`: only the fields below, each checked. */
export async function readSignupBody(event: H3Event): Promise<PasskeyRegisterOptions> {
  const body = object(await readJsonBody(event), 'The body');

  const email = text(body.email, 'email', 3, 254);
  if (email !== undefined && email.split('@').length !== 2) {
    throw invalid('email must contain one @.');
  }
  const phoneNumber = text(body.phoneNumber, 'phoneNumber', 1, 16);
  if (phoneNumber !== undefined && !/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
    throw invalid('phoneNumber must be in E.164 format, for example +14155550100.');
  }
  const name = text(body.name, 'name', 1, 100);
  const deliveryMethod = text(body.deliveryMethod, 'deliveryMethod', 1, 10) as PasskeyDeliveryMethod | undefined;
  if (deliveryMethod !== undefined && deliveryMethod !== 'text' && deliveryMethod !== 'voice') {
    throw invalid('deliveryMethod must be "text" or "voice".');
  }

  if (email !== undefined) return { email, phoneNumber, name, deliveryMethod };
  if (phoneNumber !== undefined) return { phoneNumber, name, deliveryMethod };
  throw invalid('Send an email address or a phone number.');
}

/** The credential and the codes for `complete()`: only the fields below, each checked. */
export async function readCompleteBody(event: H3Event): Promise<CompleteInput> {
  const body = object(await readJsonBody(event), 'The body');
  return { credential: readCredential(body.credential), verification: readVerification(body.verification) };
}

function readCredential(value: unknown): PasskeyCredentialResponse {
  const credential = object(value, 'credential');
  const raw = object(credential.response, 'credential.response');
  if (credential.type !== 'public-key') {
    throw invalid('credential.type must be "public-key".');
  }

  const response: PasskeyCredentialResponse['response'] = {
    clientDataJSON: requiredText(raw.clientDataJSON, 'credential.response.clientDataJSON'),
  };
  for (const key of ['attestationObject', 'authenticatorData', 'signature', 'userHandle'] as const) {
    const part = text(raw[key], `credential.response.${key}`, 0, MAX_FIELD_LENGTH);
    if (part !== undefined) response[key] = part;
  }

  const result: PasskeyCredentialResponse = {
    id: requiredText(credential.id, 'credential.id'),
    rawId: requiredText(credential.rawId, 'credential.rawId'),
    type: 'public-key',
    response,
  };
  const attachment = text(credential.authenticatorAttachment, 'credential.authenticatorAttachment', 1, 32);
  if (attachment !== undefined) result.authenticatorAttachment = attachment;
  if (credential.clientExtensionResults !== undefined) {
    result.clientExtensionResults = readExtensionResults(credential.clientExtensionResults);
  }
  return result;
}

/**
 * Only the extension results in EXTENSION_RESULTS, each at most MAX_EXTENSION_DEPTH levels deep. The SDK turns the credential
 * into JSON for Auth0, and `JSON.stringify` throws on a value that is nested a few thousand levels deep, which fits in the
 * 32 KiB of a body.
 */
function readExtensionResults(value: unknown): Json {
  const results = object(value, 'credential.clientExtensionResults');

  const result: Json = {};
  for (const name of EXTENSION_RESULTS) {
    if (results[name] === undefined) continue;
    if (!isShallow(results[name], MAX_EXTENSION_DEPTH)) {
      throw invalid(`credential.clientExtensionResults.${name} is nested too deeply.`);
    }
    result[name] = results[name];
  }
  return result;
}

/** Whether `value` has at most `depth` levels of arrays and objects. It stops at the limit, so a deep value costs no stack. */
function isShallow(value: unknown, depth: number): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return depth > 0 && Object.values(value).every((item) => isShallow(item, depth - 1));
}

function readVerification(value: unknown): PasskeyVerificationCodes | undefined {
  if (value === undefined) return undefined;
  const codes = object(value, 'verification');

  const result: PasskeyVerificationCodes = {};
  for (const key of ['email', 'phone'] as const) {
    const code = text(codes[key], `verification.${key}`, 1, MAX_CODE_LENGTH);
    if (code !== undefined) result[key] = code;
  }
  // The SDK says to omit `verification` when there is nothing to verify, never to send an empty object.
  return Object.keys(result).length > 0 ? result : undefined;
}
