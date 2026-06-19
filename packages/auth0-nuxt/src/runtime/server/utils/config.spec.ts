import { describe, it, expect } from 'vitest';
import { InvalidConfigurationError } from '@auth0/auth0-server-js';
import {
  parseAppBaseUrl,
  validateAppBaseUrl,
  enforceSecureCookies,
  resolveAuth0Options,
} from './config';
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
    const result = enforceSecureCookies(undefined, undefined, true);
    expect(result?.cookie?.secure).toBe(true);
  });

  it('forces secure=true in production allow-list mode', () => {
    const result = enforceSecureCookies(['https://a.com'], undefined, true);
    expect(result?.cookie?.secure).toBe(true);
  });

  it('throws when secure is explicitly false in production dynamic mode', () => {
    expect(() => enforceSecureCookies(undefined, { cookie: { secure: false } }, true)).toThrow(
      InvalidConfigurationError
    );
  });

  it('does not touch secure for a static appBaseUrl in production', () => {
    const result = enforceSecureCookies('https://app.example.com', undefined, true);
    expect(result?.cookie?.secure).toBeUndefined();
  });

  it('does not touch secure outside production', () => {
    const result = enforceSecureCookies(undefined, undefined, false);
    expect(result?.cookie?.secure).toBeUndefined();
  });

  it('does not mutate the provided session configuration', () => {
    const sessionConfiguration = { cookie: {} };
    const result = enforceSecureCookies(undefined, sessionConfiguration, true);
    expect(result).not.toBe(sessionConfiguration);
    expect(sessionConfiguration.cookie).toEqual({});
  });
});

describe('resolveAuth0Options', () => {
  it('parses a comma-separated appBaseUrl into an allow-list', () => {
    const options = {
      domain: 'd',
      clientId: 'c',
      clientSecret: 's',
      sessionSecret: 'ss',
      appBaseUrl: 'https://a.com, https://b.com',
    } as Auth0ClientOptions;

    const result = resolveAuth0Options(options, false);

    expect(result.appBaseUrl).toEqual(['https://a.com', 'https://b.com']);
  });

  it('returns a new object without mutating a frozen input (runtime config)', () => {
    const options = Object.freeze({
      domain: 'd',
      clientId: 'c',
      clientSecret: 's',
      sessionSecret: 'ss',
      appBaseUrl: 'https://a.com, https://b.com',
    }) as Auth0ClientOptions;

    // Must not throw on the frozen object.
    const result = resolveAuth0Options(options, true);

    expect(result).not.toBe(options);
    expect(options.appBaseUrl).toBe('https://a.com, https://b.com');
    expect(result.appBaseUrl).toEqual(['https://a.com', 'https://b.com']);
    expect(result.sessionConfiguration?.cookie?.secure).toBe(true);
  });

  it('throws when the resolved appBaseUrl is invalid', () => {
    const options = {
      domain: 'd',
      clientId: 'c',
      clientSecret: 's',
      sessionSecret: 'ss',
      appBaseUrl: 'not-a-url',
    } as Auth0ClientOptions;

    expect(() => resolveAuth0Options(options, false)).toThrow(InvalidConfigurationError);
  });
});
