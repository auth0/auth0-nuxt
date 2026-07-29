import { defineNitroPlugin, getRouteRules } from 'nitropack/runtime';
import { isRequestSharedCacheable } from '../utils/is-request-shared-cacheable';

declare module 'h3' {
  interface H3EventContext {
    /** Set by cache-detection plugin; read by auth middleware to skip SSR user write on shared-cacheable routes. */
    isSharedCacheable?: boolean;
  }
}

/**
 * Detects whether each incoming SSR request is shared-cacheable (will produce HTML cached
 * by CDN / s-maxage / swr / isr) and sets a flag on the event context for the auth middleware
 * to read.
 *
 * Runs in the 'request' hook — the earliest point in the lifecycle, before route middleware —
 * so the check completes before the auth middleware needs it.
 *
 * This plugin imports `nitropack/runtime` directly (safe because Nitro plugins are never bundled
 * for the client), avoiding the need for the middleware to dynamically import it (which could
 * cause bundler issues in some configurations).
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    // Only check for SSR requests (not API routes or static assets)
    // The middleware will only run on page renders anyway, but this avoids unnecessary work
    event.context.isSharedCacheable = isRequestSharedCacheable(getRouteRules, event);
  });
});
