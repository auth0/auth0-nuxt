import { getRequestHost, getRequestProtocol, type H3Event } from 'h3';
import { InvalidConfigurationError } from '@auth0/auth0-server-js';

const HTTP_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Checks if a string is a valid HTTP or HTTPS URL.
 * @param value The value to check.
 * @returns True when the value is a valid http(s) URL.
 */
export function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return HTTP_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Infers the application base URL (origin) from the incoming request.
 *
 * Honors `x-forwarded-host` / `x-forwarded-proto` (set by proxies/CDNs),
 * falling back to the raw `Host` header and request protocol. Returns null
 * when a valid origin cannot be built.
 * @param event The h3 event for the current request.
 * @returns The inferred origin (e.g. `https://app.example.com`) or null.
 */
export function inferBaseUrlFromRequest(event: H3Event): string | null {
  const host = getRequestHost(event, { xForwardedHost: true });
  const proto = getRequestProtocol(event, { xForwardedProto: true });

  if (!host || !proto) {
    return null;
  }

  const candidate = `${proto}://${host}`;
  return isUrl(candidate) ? candidate : null;
}

/**
 * Resolves the application base URL for the current request.
 *
 * - `string`: used as-is (static configuration).
 * - `undefined`: inferred from the request host (dynamic mode).
 * - `string[]`: the request origin is matched against the allow-list; the
 *   matching configured entry is returned, otherwise an error is thrown.
 *
 * @param appBaseUrl The configured app base URL (static, allow-list or omitted).
 * @param event The h3 event for the current request (required unless static).
 * @returns The resolved application base URL.
 * @throws {InvalidConfigurationError} When the base URL cannot be resolved.
 */
export function resolveAppBaseUrl(
  appBaseUrl: string | string[] | undefined,
  event?: H3Event
): string {
  if (typeof appBaseUrl === 'string') {
    return appBaseUrl;
  }

  if (!event) {
    throw new InvalidConfigurationError(
      'appBaseUrl is not configured as a static string, and a request context is not available.'
    );
  }

  const inferred = inferBaseUrlFromRequest(event);
  if (!inferred) {
    throw new InvalidConfigurationError(
      'appBaseUrl is not configured as a static string, and the request origin could not be determined from the request context.'
    );
  }

  if (!appBaseUrl) {
    // undefined → pure dynamic mode
    return inferred;
  }

  const requestOrigin = new URL(inferred).origin;
  const matchedEntry = appBaseUrl.find((allowedUrl) => {
    try {
      return new URL(allowedUrl).origin === requestOrigin;
    } catch {
      return false;
    }
  });

  if (matchedEntry !== undefined) {
    return matchedEntry;
  }

  throw new InvalidConfigurationError(
    'appBaseUrl is configured as an allow-list, but it does not contain a match for the current request origin.'
  );
}
