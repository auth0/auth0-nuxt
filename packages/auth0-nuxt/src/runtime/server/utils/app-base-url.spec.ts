import { describe, it, expect } from 'vitest';
import type { H3Event } from 'h3';
import { isUrl, inferBaseUrlFromRequest, resolveAppBaseUrl } from './app-base-url';

// Build a minimal event whose headers drive h3's getRequestHost/getRequestProtocol.
function makeEvent(headers: Record<string, string>): H3Event {
  return {
    node: {
      req: { headers, socket: {} },
    },
  } as unknown as H3Event;
}

describe('isUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isUrl('http://a.com')).toBe(true);
    expect(isUrl('https://a.com:3000')).toBe(true);
  });

  it('rejects non-http(s) and invalid values', () => {
    expect(isUrl('not-a-url')).toBe(false);
    expect(isUrl('ftp://a.com')).toBe(false);
    expect(isUrl('')).toBe(false);
  });
});

describe('inferBaseUrlFromRequest', () => {
  it('infers from host header', () => {
    const event = makeEvent({ host: 'app1.localhost:3000' });
    expect(inferBaseUrlFromRequest(event)).toBe('http://app1.localhost:3000');
  });

  it('prefers x-forwarded-host and x-forwarded-proto', () => {
    const event = makeEvent({
      host: 'internal:8080',
      'x-forwarded-host': 'app.example.com',
      'x-forwarded-proto': 'https',
    });
    expect(inferBaseUrlFromRequest(event)).toBe('https://app.example.com');
  });

  it('falls back to localhost when no host header is present (h3 default)', () => {
    const event = makeEvent({});
    expect(inferBaseUrlFromRequest(event)).toBe('http://localhost');
  });

  it('returns null when the host cannot form a valid origin', () => {
    const event = makeEvent({ host: 'bad host name' });
    expect(inferBaseUrlFromRequest(event)).toBeNull();
  });
});

describe('resolveAppBaseUrl', () => {
  it('returns a static string as-is without an event', () => {
    expect(resolveAppBaseUrl('https://app.example.com')).toBe('https://app.example.com');
  });

  it('throws when dynamic and no event is provided', () => {
    expect(() => resolveAppBaseUrl(undefined)).toThrow();
  });

  it('infers the origin in dynamic mode', () => {
    const event = makeEvent({ host: 'app1.localhost:3000' });
    expect(resolveAppBaseUrl(undefined, event)).toBe('http://app1.localhost:3000');
  });

  it('returns the matching allow-list entry', () => {
    const event = makeEvent({ host: 'app2.localhost:3000' });
    const result = resolveAppBaseUrl(
      ['http://app1.localhost:3000', 'http://app2.localhost:3000'],
      event
    );
    expect(result).toBe('http://app2.localhost:3000');
  });

  it('throws when the request origin is not in the allow-list', () => {
    const event = makeEvent({ host: 'evil.localhost:3000' });
    expect(() => resolveAppBaseUrl(['http://app1.localhost:3000'], event)).toThrow();
  });
});
