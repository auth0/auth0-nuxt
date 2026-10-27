// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest';
import {
  creationOptions,
  fromBase64url,
  requestOptions,
  serialize,
  toBase64url,
  webauthnMessage,
} from '../../../examples/example-nuxt-passkeys/app/utils/webauthn';

type RateLimitModule = typeof import('../../../examples/example-nuxt-passkeys/server/utils/rate-limit');

describe('rate limiter', () => {
  let limiter: RateLimitModule;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
    vi.resetModules(); // a fresh map for every test
    limiter = await import('../../../examples/example-nuxt-passkeys/server/utils/rate-limit');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows `limit` requests in a window and refuses the next one', () => {
    for (let i = 0; i < 5; i++) expect(limiter.rateLimit('a', 5).allowed).toBe(true);

    expect(limiter.rateLimit('a', 5).allowed).toBe(false);
    expect(limiter.rateLimit('a', 5).allowed).toBe(false);
  });

  it('counts every key on its own', () => {
    expect(limiter.rateLimit('a', 1).allowed).toBe(true);
    expect(limiter.rateLimit('a', 1).allowed).toBe(false);

    expect(limiter.rateLimit('b', 1).allowed).toBe(true);
  });

  it('reports the seconds left in the window, rounded up', () => {
    expect(limiter.rateLimit('a', 1).retryAfterSeconds).toBe(60);

    vi.advanceTimersByTime(10_500);

    expect(limiter.rateLimit('a', 1).retryAfterSeconds).toBe(50);
  });

  it('starts a new window when the old one has ended', () => {
    limiter.rateLimit('a', 1);
    expect(limiter.rateLimit('a', 1).allowed).toBe(false);

    vi.advanceTimersByTime(59_999);
    expect(limiter.rateLimit('a', 1).allowed).toBe(false);

    vi.advanceTimersByTime(1);
    expect(limiter.rateLimit('a', 1).allowed).toBe(true);
  });

  it('uses the window length it is given', () => {
    limiter.rateLimit('a', 1, 10);

    vi.advanceTimersByTime(10_000);

    expect(limiter.rateLimit('a', 1, 10).allowed).toBe(true);
  });

  it('drops only the expired keys when the map is full', () => {
    limiter.rateLimit('old', 1);
    vi.advanceTimersByTime(30_000);
    for (let i = 0; i < 9_999; i++) limiter.rateLimit(`k${i}`, 1); // with `old`, the map now holds 10,000 keys
    limiter.rateLimit('k0', 1);
    expect(limiter.rateLimit('k0', 1).allowed).toBe(false);

    vi.advanceTimersByTime(31_000); // `old` has expired, the others have not
    expect(limiter.rateLimit('fresh', 1).allowed).toBe(true);

    expect(limiter.rateLimit('k0', 1).allowed).toBe(false); // still counted: only `old` was dropped
  });

  it('starts over when the map is full of live keys (the price of a flood of distinct keys)', () => {
    for (let i = 0; i < 10_000; i++) limiter.rateLimit(`k${i}`, 1);
    expect(limiter.rateLimit('k0', 1).allowed).toBe(false);

    expect(limiter.rateLimit('new', 1).allowed).toBe(true);

    expect(limiter.rateLimit('k0', 1).allowed).toBe(true); // forgotten with all the others
  });

  describe('rateLimitKey', () => {
    it('keeps an IPv4 address as it is', () => {
      expect(limiter.rateLimitKey('203.0.113.9')).toBe('203.0.113.9');
    });

    it('uses `unknown` for a request without an address', () => {
      expect(limiter.rateLimitKey(undefined)).toBe('unknown');
      expect(limiter.rateLimitKey('')).toBe('unknown');
    });

    it('groups IPv6 addresses by /64, whatever the notation', () => {
      const key = limiter.rateLimitKey('2001:db8:1:2::1');

      expect(key).toBe('2001:db8:1:2::/64');
      expect(limiter.rateLimitKey('2001:db8:1:2:ffff::5')).toBe(key);
      expect(limiter.rateLimitKey('2001:0DB8:0001:0002:0000:0000:0000:0001')).toBe(key);
      expect(limiter.rateLimitKey('2001:db8:1:3::1')).not.toBe(key);
    });

    it('counts an IPv4-mapped IPv6 address as its IPv4 address', () => {
      expect(limiter.rateLimitKey('::ffff:203.0.113.9')).toBe('203.0.113.9');
      expect(limiter.rateLimitKey('::ffff:cb00:7109')).toBe('203.0.113.9');
    });

    it('handles the loopback address, a zone id and the unspecified address', () => {
      expect(limiter.rateLimitKey('::1')).toBe('0:0:0:0::/64');
      expect(limiter.rateLimitKey('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
      expect(limiter.rateLimitKey('::')).toBe('0:0:0:0::/64');
    });

    it('returns something that is not an IPv6 address as it is', () => {
      expect(limiter.rateLimitKey('not:an:ip')).toBe('not:an:ip');
    });
  });
});

// ─── WebAuthn helpers ────────────────────────────────────────────────────────

const bytes = (...values: number[]) => new Uint8Array(values).buffer;
const toArray = (buffer: BufferSource) => [...new Uint8Array(buffer as ArrayBuffer)];

describe('base64url', () => {
  it('round trips bytes, including the characters that differ from base64', () => {
    const data = bytes(251, 255, 190, 0, 1, 2, 3);
    const encoded = toBase64url(data);

    expect(encoded).toBe('-_--AAECAw'); // "+/++" becomes "-_--", and there is no "=" padding
    expect(toArray(fromBase64url(encoded))).toEqual(toArray(data));
  });

  it('decodes values with and without padding', () => {
    expect(toArray(fromBase64url('YQ'))).toEqual([97]);
    expect(toArray(fromBase64url('YWI'))).toEqual([97, 98]);
    expect(toArray(fromBase64url('YWJj'))).toEqual([97, 98, 99]);
  });
});

describe('creationOptions', () => {
  it('decodes the challenge, the user id and the excluded credential ids', () => {
    const options = creationOptions({
      challenge: 'YWJj',
      rp: { id: 'login.example.com', name: 'Example' },
      user: { id: 'dXNlcg', name: 'jane', displayName: 'Jane' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ type: 'public-key', id: 'YQ' }],
      timeout: 60000,
    });

    expect(toArray(options.challenge)).toEqual([97, 98, 99]);
    expect(toArray(options.user.id)).toEqual([117, 115, 101, 114]);
    expect(toArray(options.excludeCredentials![0]!.id)).toEqual([97]);
    expect(options.rp).toEqual({ id: 'login.example.com', name: 'Example' });
    expect(options.timeout).toBe(60000);
  });

  it('does not add excludeCredentials when Auth0 sends none', () => {
    const options = creationOptions({
      challenge: 'YQ',
      rp: { id: 'login.example.com', name: 'Example' },
      user: { id: 'YQ', name: 'a', displayName: 'a' },
      pubKeyCredParams: [],
    });

    expect(options).not.toHaveProperty('excludeCredentials');
  });
});

describe('requestOptions', () => {
  it('decodes the challenge and the allowed credential ids', () => {
    const options = requestOptions({
      challenge: 'YWJj',
      rpId: 'login.example.com',
      allowCredentials: [{ type: 'public-key', id: 'YQ' }],
    });

    expect(toArray(options.challenge)).toEqual([97, 98, 99]);
    expect(toArray(options.allowCredentials![0]!.id)).toEqual([97]);
    expect(options.rpId).toBe('login.example.com');
  });

  it('does not add allowCredentials for a discoverable login', () => {
    expect(requestOptions({ challenge: 'YQ', rpId: 'login.example.com' })).not.toHaveProperty('allowCredentials');
  });
});

describe('serialize', () => {
  const credential = (response: Record<string, ArrayBuffer | null>, extra: Record<string, unknown> = {}) =>
    ({
      id: 'cred-id',
      rawId: bytes(1, 2, 3),
      type: 'public-key',
      response,
      getClientExtensionResults: () => ({ credProps: { rk: true } }),
      toJSON: () => ({ id: 'cred-id', extra: 'Auth0 rejects this' }),
      ...extra,
    }) as unknown as PublicKeyCredential;

  it('a signup credential has the attestation and nothing else', () => {
    const serialized = serialize(
      credential(
        { clientDataJSON: bytes(123, 125), attestationObject: bytes(4, 5) },
        { authenticatorAttachment: 'platform' }
      )
    );

    expect(serialized).toEqual({
      id: 'cred-id',
      rawId: 'AQID',
      type: 'public-key',
      authenticatorAttachment: 'platform',
      response: { clientDataJSON: 'e30', attestationObject: 'BAU' },
      clientExtensionResults: { credProps: { rk: true } },
    });
  });

  it('a login credential has the assertion fields, and leaves out a null userHandle', () => {
    const serialized = serialize(
      credential({
        clientDataJSON: bytes(123, 125),
        authenticatorData: bytes(1),
        signature: bytes(2),
        userHandle: null,
      })
    );

    expect(serialized.response).toEqual({ clientDataJSON: 'e30', authenticatorData: 'AQ', signature: 'Ag' });
    expect(serialized).not.toHaveProperty('authenticatorAttachment');
  });

  it('never copies credential.toJSON() or other extra fields', () => {
    const serialized = serialize(credential({ clientDataJSON: bytes(123, 125), attestationObject: bytes(4, 5) }));

    expect(Object.keys(serialized).sort()).toEqual(['clientExtensionResults', 'id', 'rawId', 'response', 'type']);
  });
});

describe('webauthnMessage', () => {
  test.each([
    ['NotAllowedError', /closed or timed out/],
    ['InvalidStateError', /already has a passkey/],
    ['SecurityError', /RP ID/],
    ['SomethingElse', /failed: boom/],
  ])('explains %s', (name, expected) => {
    expect(webauthnMessage({ name, message: 'boom' })).toMatch(expected);
  });

  it('copes with a thrown value that is not an Error', () => {
    expect(webauthnMessage(undefined)).toMatch(/failed: undefined/);
    expect(webauthnMessage('plain text')).toMatch(/failed: plain text/);
  });
});
