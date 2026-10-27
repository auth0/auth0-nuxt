import { createServer, type AddressInfo } from 'node:net';
import { fetch as appFetch } from '@nuxt/test-utils';
import type { PasskeyCredentialResponse, StateData } from '@auth0/auth0-server-js';
import { decrypt } from './encryption';
import type { Auth0ClientOptions } from '../src/types';
import type { FakeRequest, FakeScript } from './fixtures/passkeys/fakes/fake-state';

/** Must equal `runtimeConfig.auth0.sessionSecret` in fixtures/passkeys/nuxt.config.ts. */
export const SESSION_SECRET = 'a-very-long-secret-for-tests-1234567890';

/**
 * `runtimeConfig.auth0` of the fixture, with the app URL of one test file. Every test file picks a free port first and
 * passes its URL here, because the Origin check compares with it. The other values equal the fixture's own config.
 */
export function auth0Config(appBaseUrl: string): Auth0ClientOptions {
  return {
    domain: 'example.auth0.local',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    sessionSecret: SESSION_SECRET,
    appBaseUrl,
    audience: 'https://api.example.local',
  };
}
/** The cookie that holds the passkey flow between the start and the complete request. */
export const FLOW_COOKIE = '__a0_passkey_tx';
/** The one-time codes the fake Auth0 accepts. */
export const EMAIL_CODE = '123456';
export const PHONE_CODE = '654321';

/** What the routes of the example answer. A field is there only for the statuses that use it. */
export interface PasskeyAnswer {
  status?: string;
  message?: string;
  verificationRequired?: string[];
  retryAfterSeconds?: number;
  authnParamsPublicKey?: { challenge: string; [key: string]: unknown };
}

/** A free TCP port. The Origin check compares with the base URL of the app, so the port is needed up front. */
export async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/** Cookies the way a browser keeps them: `Max-Age=0`, a past `Expires` or an empty value delete the cookie. */
export class CookieJar {
  readonly #cookies = new Map<string, string>();

  names(): string[] {
    return [...this.#cookies.keys()];
  }

  get(name: string): string | undefined {
    return this.#cookies.get(name);
  }

  has(name: string): boolean {
    return this.#cookies.has(name);
  }

  header(): string {
    return [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  /** Applies the Set-Cookie headers of a response and returns them. */
  absorb(headers: Headers): string[] {
    const setCookies = headers.getSetCookie();
    for (const setCookie of setCookies) {
      const [pair = '', ...attributes] = setCookie.split(';').map((part) => part.trim());
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);
      const maxAge = attributes.find((attribute) => /^max-age=/i.test(attribute));
      const expires = attributes.find((attribute) => /^expires=/i.test(attribute));
      const gone =
        value === '' ||
        (maxAge !== undefined && Number(maxAge.split('=')[1]) <= 0) ||
        (expires !== undefined && Date.parse(expires.slice('expires='.length)) <= Date.now());
      if (gone) this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
    return setCookies;
  }
}

export interface User {
  jar: CookieJar;
  /** The client IP the app sees in `X-Forwarded-For`. Every user has its own, so rate-limit buckets never collide. */
  ip: string;
}

let users = 0;

export function newUser(): User {
  users += 1;
  return { jar: new CookieJar(), ip: `203.0.${113 + Math.floor(users / 250)}.${(users % 250) + 1}` };
}

/** A user whose address header is `ip`. The value can also be a list, like `1.2.3.4, 5.6.7.8`. */
export function userAt(ip: string): User {
  return { jar: new CookieJar(), ip };
}

export interface CallInit {
  method?: string;
  /** Sent as JSON. */
  body?: unknown;
  /** Sent as it is, instead of `body`. */
  rawBody?: string;
  /** Sets a header, replacing the default; `null` removes a default header. */
  headers?: Record<string, string | null>;
}

export interface CallResult<T> {
  status: number;
  json: T;
  text: string;
  headers: Headers;
  /** The Set-Cookie headers of this response. */
  setCookie: string[];
}

/** A client of the app. `origin` is what a browser on the app's own page sends. */
export function createClient(origin: string) {
  return {
    /** One request as `user`: JSON, the app's Origin and the user's own address by default. */
    async call<T = PasskeyAnswer>(user: User, path: string, init: CallInit = {}): Promise<CallResult<T>> {
      const headers = new Headers({ 'content-type': 'application/json', origin, 'x-forwarded-for': user.ip });
      if (user.jar.header()) headers.set('cookie', user.jar.header());
      for (const [name, value] of Object.entries(init.headers ?? {})) {
        if (value === null) headers.delete(name);
        else headers.set(name, value);
      }
      const payload = init.rawBody ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined);

      const response = await appFetch(path, {
        method: init.method ?? (payload !== undefined ? 'POST' : 'GET'),
        headers,
        body: payload,
        redirect: 'manual',
      });
      const setCookie = user.jar.absorb(response.headers);
      const text = await response.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = undefined;
      }
      return { status: response.status, json: parsed as T, text, headers: response.headers, setCookie };
    },
  };
}

// ─── The fake Auth0 ──────────────────────────────────────────────────────────

/** Scripts the fake Auth0 (see FakeScript). `{ reset: true }` clears its log and its script. */
export async function script(body: FakeScript): Promise<void> {
  await appFetch('/__fake/script', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Every request the fake Auth0 received since the last reset. */
export async function fakeLog(): Promise<FakeRequest[]> {
  const response = await appFetch('/__fake/state');
  return ((await response.json()) as { log: FakeRequest[] }).log;
}

/** The requests the fake received on one path, for example '/passkey/register'. */
export async function requestsTo(path: string): Promise<FakeRequest[]> {
  return (await fakeLog()).filter((request) => request.path === path);
}

/** The sessions that the in-memory store of the stateful fixture holds, as [identifier, state] pairs. */
export async function storedSessions(): Promise<Array<[string, StateData]>> {
  const response = await appFetch('/__fake/session-store');
  return ((await response.json()) as { sessions: Array<[string, StateData]> }).sessions;
}

// ─── Credentials and cookies ─────────────────────────────────────────────────

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

/**
 * The credential `serialize()` makes after `navigator.credentials.create()`. The fake does not check signatures. The
 * SDK only checks that `clientDataJSON` names the challenge it stored.
 */
export function signupCredential(challenge: string): PasskeyCredentialResponse {
  return {
    id: 'cred-1',
    rawId: 'cred-1',
    type: 'public-key',
    authenticatorAttachment: 'platform',
    response: {
      clientDataJSON: encode({ type: 'webauthn.create', challenge, origin: 'http://localhost' }),
      attestationObject: 'AA',
    },
    clientExtensionResults: {},
  };
}

/** The credential after `navigator.credentials.get()`. */
export function loginCredential(challenge: string): PasskeyCredentialResponse {
  return {
    id: 'cred-1',
    rawId: 'cred-1',
    type: 'public-key',
    authenticatorAttachment: 'platform',
    response: {
      clientDataJSON: encode({ type: 'webauthn.get', challenge, origin: 'http://localhost' }),
      authenticatorData: 'AA',
      signature: 'AA',
      userHandle: 'AA',
    },
    clientExtensionResults: {},
  };
}

/** What the SDK keeps in the encrypted flow cookie. */
export interface FlowPayload {
  authSession: string;
  challenge: string;
  domain: string;
  expiresAt: number;
  realm?: string;
  verificationRequired?: string[];
}

/** Decrypts the flow cookie of `user` (the SDK encrypts it with the session secret and the cookie name as salt). */
export async function readFlow(user: User): Promise<FlowPayload> {
  const value = user.jar.get(FLOW_COOKIE);
  if (!value) throw new Error(`${FLOW_COOKIE} is not set`);
  return await decrypt<FlowPayload>(value, SESSION_SECRET, FLOW_COOKIE);
}

/** Whether `user` holds a session cookie. */
export function hasSession(user: User): boolean {
  return user.jar.names().some((name) => name.startsWith('__a0_session'));
}
