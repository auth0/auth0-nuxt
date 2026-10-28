// The WebAuthn steps every passkey page needs. They only convert data, so they are easy to test and to copy.
import type { PasskeyCreationOptions, PasskeyCredentialResponse, PasskeyRequestOptions } from '@auth0/auth0-nuxt';

/** A credential descriptor as Auth0 sends it: the id is base64url. */
interface DescriptorJson {
  type: string;
  id: string;
  transports?: string[];
}

// Auth0 can send more than the SDK types list, for example the ids of credentials to exclude or to allow.
type CreationJson = PasskeyCreationOptions & { excludeCredentials?: DescriptorJson[] };
type RequestJson = PasskeyRequestOptions & { allowCredentials?: DescriptorJson[] };

// Auth0 sends binary values as base64url strings. The WebAuthn API wants ArrayBuffers.
export function fromBase64url(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
}

export function toBase64url(buffer: ArrayBuffer): string {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const decodeIds = (descriptors: DescriptorJson[]) =>
  descriptors.map((descriptor) => ({ ...descriptor, id: fromBase64url(descriptor.id) }));

// `authnParamsPublicKey` from the signup start route, ready for `navigator.credentials.create({ publicKey })`.
export function creationOptions(options: CreationJson): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: fromBase64url(options.challenge),
    user: { ...options.user, id: fromBase64url(options.user.id) },
    ...(options.excludeCredentials && { excludeCredentials: decodeIds(options.excludeCredentials) }),
  } as PublicKeyCredentialCreationOptions;
}

// `authnParamsPublicKey` from the login start route, ready for `navigator.credentials.get({ publicKey })`.
export function requestOptions(options: RequestJson): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: fromBase64url(options.challenge),
    ...(options.allowCredentials && { allowCredentials: decodeIds(options.allowCredentials) }),
  } as PublicKeyCredentialRequestOptions;
}

// The credential the browser made, as the JSON the complete route takes. Send only these fields: do not send
// `credential.toJSON()`, because Auth0 rejects its extra fields.
export function serialize(credential: PublicKeyCredential): PasskeyCredentialResponse {
  const raw = credential.response as Partial<AuthenticatorAttestationResponse & AuthenticatorAssertionResponse> & {
    clientDataJSON: ArrayBuffer;
  };
  const response: PasskeyCredentialResponse['response'] = { clientDataJSON: toBase64url(raw.clientDataJSON) };
  if (raw.attestationObject) response.attestationObject = toBase64url(raw.attestationObject);
  if (raw.authenticatorData) response.authenticatorData = toBase64url(raw.authenticatorData);
  if (raw.signature) response.signature = toBase64url(raw.signature);
  if (raw.userHandle) response.userHandle = toBase64url(raw.userHandle);

  return {
    id: credential.id,
    rawId: toBase64url(credential.rawId),
    type: credential.type,
    ...(credential.authenticatorAttachment && { authenticatorAttachment: credential.authenticatorAttachment }),
    response,
    clientExtensionResults: credential.getClientExtensionResults() as Record<string, unknown>,
  };
}

// A sentence for an error that `navigator.credentials.create()` or `.get()` threw.
export function webauthnMessage(error: unknown): string {
  const { name, message } = (error ?? {}) as { name?: string; message?: string };
  switch (name) {
    case 'NotAllowedError':
      return 'The passkey prompt was closed or timed out.';
    case 'InvalidStateError':
      return 'This device already has a passkey for this account.';
    case 'SecurityError':
      return 'The browser refused the passkey: the page origin does not fit its RP ID (your custom domain).';
    default:
      return `The passkey prompt failed: ${message ?? String(error)}`;
  }
}
