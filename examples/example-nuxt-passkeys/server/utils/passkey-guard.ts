import { isIP } from 'node:net';
import type { H3Event } from 'h3';

export interface GuardOptions {
  /** The name of the route, so each route counts on its own. */
  name: string;
  /** How many requests one client may make to this route per minute. */
  limit: number;
}

/**
 * The checks every passkey route starts with: the answer is never cached, the request must come from the app's own
 * page, and one client may only call the route so often. It throws a PasskeyHttpError when a check fails.
 */
export function guardPasskeyRequest(event: H3Event, { name, limit }: GuardOptions): void {
  setResponseHeader(event, 'Cache-Control', 'no-store');

  // These routes write cookies, so a POST from another site (a form, for example) must not get through. `fetch()` always
  // sends `Origin` with a POST, and a page on another site cannot fake it.
  const appOrigin = new URL(useRuntimeConfig(event).auth0.appBaseUrl).origin;
  if (getRequestHeader(event, 'origin') !== appOrigin) {
    throw new PasskeyHttpError(403, { status: 'forbidden' });
  }

  const { allowed, retryAfterSeconds } = rateLimit(`${name}:${rateLimitKey(clientIp(event))}`, limit);
  if (!allowed) {
    throw new PasskeyHttpError(
      429,
      { status: 'rate_limited', retryAfterSeconds },
      { 'Retry-After': String(retryAfterSeconds) }
    );
  }
}

/**
 * The IP address of the client. By default it is the address of the connection. If `runtimeConfig.passkey.clientIpHeader`
 * names a header that a proxy you control sets or appends to, the LAST entry of that header is used when it is a valid IP
 * address (a value with a port is not): it is the address that proxy saw. The first entry is whatever the client sent, so never use it.
 */
export function clientIp(event: H3Event): string | undefined {
  const header = useRuntimeConfig(event).passkey.clientIpHeader;
  if (header) {
    const entries = (getRequestHeader(event, header) ?? '').split(',');
    const last = entries[entries.length - 1]?.trim();
    if (last && isIP(last)) {
      return last;
    }
  }
  return getRequestIP(event);
}

/** The request options that tell Auth0 the address of the user. See "Securing the routes" in EXAMPLES.md. */
export function forwardedFor(event: H3Event): { headers: Record<string, string> } | undefined {
  const ip = clientIp(event);
  return ip ? { headers: { 'auth0-forwarded-for': ip } } : undefined;
}
