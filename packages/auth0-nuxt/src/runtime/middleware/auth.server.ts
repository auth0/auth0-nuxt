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

    // Read the route rules Nitro resolved for this request. We deliberately use the
    // Nitro server context rather than Nuxt's app-level `getRouteRules` composable:
    // the latter reads a build-time manifest that omits bare `Cache-Control` *header*
    // route rules, so it would not detect the shared-cacheable case this guard exists
    // for. `isSharedCacheable` fails closed when this is unavailable.
    const routeRules = h3Event.context._nitro?.routeRules;
    if (isSharedCacheable(routeRules)) {
      if (importMetaDev && !warnedPaths.has(h3Event.path)) {
        warnedPaths.add(h3Event.path);
        console.warn(
          `[auth0-nuxt] Route "${h3Event.path}" is shared-cacheable; skipping the SSR user write to keep cached HTML anonymous. ` +
            `The user will be hydrated client-side from the profile endpoint.`
        );
      }
      return;
    }

    // As we can only import this composable on the server, we need to dynamically import it.
    const { useAuth0 } = await import('../server/composables/use-auth0');
    const auth0Client = useAuth0(h3Event);

    const user = await auth0Client.getUser();

    useUser().value = user;
  }
});
