import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { useUser } from '../composables/use-user';
import { importMetaServer, importMetaDev } from '../helpers/import-meta';
import { isSharedCacheable } from '../server/utils/is-shared-cacheable';

const warnedPaths = new Set<string>();

/**
 * Middleware that ensures the useUser composable is populated with the current user
 * during server-side rendering.
 *
 * On shared-cacheable routes the user is NOT written into the SSR payload (which Nuxt
 * serializes into the `__NUXT__` HTML), so cached HTML stays anonymous. The user is
 * hydrated client-side instead by the `auth.client` plugin. Fails closed: if route
 * rules are unavailable, the SSR write is skipped and the client hydrates.
 */
export default defineNuxtRouteMiddleware(async () => {
  if (importMetaServer) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    // Read the route rules Nitro resolved for this request via Nitro's supported
    // `getRouteRules` server util. We deliberately do NOT use Nuxt's app-level
    // `getRouteRules` composable: it reads a build-time manifest that omits bare
    // `Cache-Control` *header* route rules, so it would not detect the shared-cacheable
    // case this guard exists for. Imported dynamically (server-only) to keep it out of
    // the client bundle; `isSharedCacheable` fails closed if it is unavailable.
    const { getRouteRules } = await import('nitropack/runtime');

    // First check the rules for the request path as-is.
    if (isSharedCacheable(getRouteRules(h3Event))) {
      maybeWarn(h3Event.path);
      return;
    }

    // Then re-check against the lowercased path. Nitro's route-rule matcher is
    // case-sensitive, but vue-router matches routes case-insensitively, so a request like
    // `/Cacheable` renders the `/cacheable` page while dodging its route rule
    // (CVE-2026-53721). We resolve the rules for the lowercased path too — via a synthetic
    // event with a fresh context so `getRouteRules` recomputes rather than returning the
    // cached result — so the cache guard cannot be bypassed by casing.
    const lowerPath = h3Event.path.toLowerCase();
    if (lowerPath !== h3Event.path) {
      const lowerEvent = { ...h3Event, path: lowerPath, context: {} } as typeof h3Event;
      if (isSharedCacheable(getRouteRules(lowerEvent))) {
        maybeWarn(h3Event.path);
        return;
      }
    }

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const user = await auth0Client.getUser();

    useUser().value = user;
  }
});

function maybeWarn(path: string): void {
  if (importMetaDev && !warnedPaths.has(path)) {
    warnedPaths.add(path);
    console.warn(
      `[auth0-nuxt] Route "${path}" is shared-cacheable; skipping the SSR user write to keep cached HTML anonymous. ` +
        `The user will be hydrated client-side from the profile endpoint.`
    );
  }
}
