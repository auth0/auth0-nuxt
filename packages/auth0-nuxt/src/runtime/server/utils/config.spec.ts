import { describe, it, expect } from 'vitest';
import { InvalidConfigurationError } from '@auth0/auth0-server-js';
import { parseAppBaseUrl, validateAppBaseUrl, enforceSecureCookies } from './config';
import type { Auth0ClientOptions } from '~/src/types';

describe('parseAppBaseUrl', () => {
  it('returns undefined for falsy input', () => {
    expect(parseAppBaseUrl(undefined)).toBeUndefined();
    expect(parseAppBaseUrl('')).toBeUndefined();
  });

  it('keeps a single URL as a string', () => {
    expect(parseAppBaseUrl('https://app.example.com')).toBe('https://app.example.com');
  });

  it('splits a comma-separated value into an array', () => {
    expect(parseAppBaseUrl('https://a.com, https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ]);
  });

  it('collapses a trailing-comma value to a string', () => {
    expect(parseAppBaseUrl('https://a.com,')).toBe('https://a.com');
  });
});

describe('validateAppBaseUrl', () => {
  it('allows undefined (dynamic mode)', () => {
    expect(() => validateAppBaseUrl(undefined)).not.toThrow();
  });

  it('throws on an invalid static URL', () => {
    expect(() => validateAppBaseUrl('not-a-url')).toThrow(InvalidConfigurationError);
  });

  it('throws on an empty array', () => {
    expect(() => validateAppBaseUrl([])).toThrow(InvalidConfigurationError);
  });

  it('throws when an array contains an invalid URL, naming the entry', () => {
    expect(() => validateAppBaseUrl(['https://a.com', 'nope'])).toThrow(/nope/);
  });

  it('passes for a valid array', () => {
    expect(() => validateAppBaseUrl(['https://a.com', 'https://b.com'])).not.toThrow();
  });
});

describe('enforceSecureCookies', () => {
  it('forces secure=true in production dynamic mode', () => {
    const options = { appBaseUrl: undefined } as Auth0ClientOptions;
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration?.cookie?.secure).toBe(true);
  });

  it('forces secure=true in production allow-list mode', () => {
    const options = { appBaseUrl: ['https://a.com'] } as Auth0ClientOptions;
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration?.cookie?.secure).toBe(true);
  });

  it('throws when secure is explicitly false in production dynamic mode', () => {
    const options = {
      appBaseUrl: undefined,
      sessionConfiguration: { cookie: { secure: false } },
    } as Auth0ClientOptions;
    expect(() => enforceSecureCookies(options, true)).toThrow(InvalidConfigurationError);
  });

  it('does not touch secure for a static appBaseUrl in production', () => {
    const options = { appBaseUrl: 'https://app.example.com' } as Auth0ClientOptions;
    enforceSecureCookies(options, true);
    expect(options.sessionConfiguration?.cookie?.secure).toBeUndefined();
  });

  it('does not touch secure outside production', () => {
    const options = { appBaseUrl: undefined } as Auth0ClientOptions;
    enforceSecureCookies(options, false);
    expect(options.sessionConfiguration?.cookie?.secure).toBeUndefined();
  });
});
