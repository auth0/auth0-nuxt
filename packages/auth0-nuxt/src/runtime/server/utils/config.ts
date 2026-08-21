import { InvalidConfigurationError, type SessionConfiguration } from '@auth0/auth0-server-js';
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
 * Returns a `sessionConfiguration` with `cookie.secure = true` enforced, or the
 * original configuration unchanged when enforcement does not apply.
 *
 * Does not mutate its input — the Nuxt runtime config is frozen.
 * @param appBaseUrl The resolved app base URL (static, allow-list or omitted).
 * @param sessionConfiguration The configured session configuration, if any.
 * @param isProduction Whether the app is running in production.
 * @returns The (possibly new) session configuration to use.
 * @throws {InvalidConfigurationError} When secure cookies are explicitly disabled.
 */
export function enforceSecureCookies(
  appBaseUrl: string | string[] | undefined,
  sessionConfiguration: SessionConfiguration | undefined,
  isProduction: boolean
): SessionConfiguration | undefined {
  const isDynamic = typeof appBaseUrl !== 'string';

  if (!isProduction || !isDynamic) {
    return sessionConfiguration;
  }

  if (sessionConfiguration?.cookie?.secure === false) {
    throw new InvalidConfigurationError(
      'Secure cookies are required when relying on dynamic base URLs in production. ' +
        'Remove the explicit `sessionConfiguration.cookie.secure = false` or set a static appBaseUrl.'
    );
  }

  return {
    ...sessionConfiguration,
    cookie: {
      ...sessionConfiguration?.cookie,
      secure: true,
    },
  };
}

/**
 * Resolves and validates the Auth0 client options derived from the (frozen)
 * Nuxt runtime config. Returns a new options object — the input is not mutated.
 * @param options The raw Auth0 client options from runtime config.
 * @param isProduction Whether the app is running in production.
 * @returns A new, validated options object.
 * @throws {InvalidConfigurationError} When the configuration is invalid.
 */
export function resolveAuth0Options(options: Auth0ClientOptions, isProduction: boolean): Auth0ClientOptions {
  const appBaseUrl =
    typeof options.appBaseUrl === 'string' ? parseAppBaseUrl(options.appBaseUrl) : options.appBaseUrl;

  validateAppBaseUrl(appBaseUrl);

  const sessionConfiguration = enforceSecureCookies(appBaseUrl, options.sessionConfiguration, isProduction);

  return {
    ...options,
    appBaseUrl,
    sessionConfiguration,
  };
}
