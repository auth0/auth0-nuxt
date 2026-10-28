// An in-process fixed-window rate limiter for the passkey routes.
//
// It counts in this process only. With several instances, limit at the edge (a WAF or your proxy) or use a shared
// store, because each instance counts on its own. The keys come from the client, so the map is capped: it holds at most
// MAX_KEYS clients, and a new client past that makes the oldest one forgotten, so that client may start over early.

const MAX_KEYS = 10_000;

interface Counter {
  count: number;
  resetAt: number;
}

const counters = new Map<string, Counter>();

export interface RateLimitResult {
  /** False when this request is over the limit. */
  allowed: boolean;
  /** Seconds until the window of this key ends. */
  retryAfterSeconds: number;
}

/** Counts one request for `key` and says whether it is within `limit` requests per window. */
export function rateLimit(key: string, limit: number, windowSeconds = 60): RateLimitResult {
  const now = Date.now();
  let counter = counters.get(key);

  if (!counter || counter.resetAt <= now) {
    // A new window goes to the end of the map, so that the first key of the map is always the oldest window.
    counters.delete(key);
    if (counters.size >= MAX_KEYS) forgetOldest();
    counter = { count: 0, resetAt: now + windowSeconds * 1000 };
    counters.set(key, counter);
  }

  counter.count += 1;
  return {
    allowed: counter.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((counter.resetAt - now) / 1000)),
  };
}

/**
 * Forgets the key with the oldest window. A flood of distinct keys can only push the oldest clients out one by one:
 * clearing the whole map would reset the limit of every client at once.
 */
function forgetOldest(): void {
  const oldest = counters.keys().next();
  if (!oldest.done) counters.delete(oldest.value);
}

/**
 * The key a client is counted under. IPv6 addresses are grouped by /64: one subscriber usually owns a whole /64 and can
 * use any address in it, so counting full addresses would let one client dodge the limit by changing address. An
 * IPv4-mapped IPv6 address counts as its IPv4 address. `unknown` is for a request without an address.
 */
export function rateLimitKey(ip: string | undefined): string {
  if (!ip) return 'unknown';
  if (!ip.includes(':')) return ip;

  const groups = expandIPv6(ip);
  if (!groups) return ip;

  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
    return `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  }
  return `${[g0, g1, g2, g3].map((group) => group.toString(16)).join(':')}::/64`;
}

/** The eight 16-bit groups of an IPv6 address, or undefined if it is not one. */
function expandIPv6(address: string): number[] | undefined {
  let text = address.split('%')[0] ?? ''; // a zone id (fe80::1%eth0) is not part of the address

  // An IPv4 tail (::ffff:203.0.113.9) is two groups.
  const embedded = /(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (embedded) {
    const [a = 0, b = 0, c = 0, d = 0] = embedded.slice(1).map(Number);
    text = `${text.slice(0, embedded.index)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = text.split('::');
  if (halves.length > 2) return undefined;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return undefined;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return undefined;
  return groups.map((group) => parseInt(group, 16));
}
