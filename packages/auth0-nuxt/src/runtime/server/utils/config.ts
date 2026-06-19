import { InvalidConfigurationError } from '@auth0/auth0-server-js';
import type { Auth0ClientOptions } from '~/src/types';
import { isUrl } from './app-base-url';

/**
 * Parses an appBaseUrl value coming from config or the environment.
 * A comma-separated string becomes an allow-list array; a single value
 * (or trailing-comma value) stays a string; falsy input becomes undefined.
 * @param value The raw appBaseUrl string (e.g. from NUXT_AUTH0_APP_BASE_URL).
 * @returns A string, an array of strings, or undefined.
 */
export function parseAppBaseUrl(value: string | undefined): string | string[] | undefined {
  if (!value) {
    return undefined;
  }
  if (value.includes(',')) {
    const entries = value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    return entries.length === 1 ? entries[0] : entries;
  }
  return value;
}

/**
 * Validates a (possibly parsed) appBaseUrl. `undefined` is valid (dynamic mode).
 * @param appBaseUrl The configured app base URL.
 * @throws {InvalidConfigurationError} When the configuration is invalid.
 */
export function validateAppBaseUrl(appBaseUrl: string | string[] | undefined): void {
  if (appBaseUrl === undefined) {
    return;
  }

  if (Array.isArray(appBaseUrl)) {
    if (appBaseUrl.length === 0) {
      throw new InvalidConfigurationError('appBaseUrl array configuration cannot be empty.');
    }
    const invalid = appBaseUrl.filter((url) => !isUrl(url));
    if (invalid.length > 0) {
      throw new InvalidConfigurationError(`appBaseUrl array contains invalid URLs: ${invalid.join(', ')}`);
    }
    return;
  }

  if (!isUrl(appBaseUrl)) {
    throw new InvalidConfigurationError(`appBaseUrl must be a valid http(s) URL: ${appBaseUrl}`);
  }
}

/**
 * In production dynamic/allow-list mode, secure session cookies are required.
 * Forces `sessionConfiguration.cookie.secure = true`, or throws if it was
 * explicitly set to `false`.
 * @param options The Auth0 client options, mutated in place.
 * @param isProduction Whether the app is running in production.
 * @throws {InvalidConfigurationError} When secure cookies are explicitly disabled.
 */
export function enforceSecureCookies(options: Auth0ClientOptions, isProduction: boolean): void {
  const isDynamic = typeof options.appBaseUrl !== 'string';

  if (!isProduction || !isDynamic) {
    return;
  }

  if (options.sessionConfiguration?.cookie?.secure === false) {
    throw new InvalidConfigurationError(
      'Secure cookies are required when relying on dynamic base URLs in production. ' +
        'Remove the explicit `sessionConfiguration.cookie.secure = false` or set a static appBaseUrl.'
    );
  }

  options.sessionConfiguration = {
    ...options.sessionConfiguration,
    cookie: {
      ...options.sessionConfiguration?.cookie,
      secure: true,
    },
  };
}
