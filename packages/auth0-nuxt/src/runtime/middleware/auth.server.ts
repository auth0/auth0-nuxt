import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { useUser } from '../composables/use-user';
import { importMetaDev } from '../helpers/import-meta';
import { isRequestSharedCacheable } from '../server/utils/is-request-shared-cacheable';

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
  // A literal `import.meta.server` guard (not the `importMetaServer` helper) is required
  // here: Vite replaces `import.meta.server` with the literal `false` in the client bundle,
  // so this whole block is tree-shaken away — crucially stripping the server-only
  // `import('nitropack/runtime')` below, which resolves to Nitro virtual modules that
  // cannot be loaded in the client environment and would otherwise break `nuxt build`. The
  // branching cache-guard logic lives in `isRequestSharedCacheable` so it stays unit-testable
  // (this body is unreachable under Vitest, where the same guard folds to `false`).
  if (import.meta.server) {
    const app = useNuxtApp();
    const h3Event = app.ssrContext!.event;

    // Read the route rules Nitro resolved for this request via Nitro's supported
    // `getRouteRules` server util. We deliberately do NOT use Nuxt's app-level
    // `getRouteRules` composable: it reads a build-time manifest that omits bare
    // `Cache-Control` *header* route rules, so it would not detect the shared-cacheable
    // case this guard exists for.
    const { getRouteRules } = await import('nitropack/runtime');

    // Skip the SSR user write on shared-cacheable routes (hardened against the route-rule
    // case-sensitivity bypass, CVE-2026-53721). Fails closed if route rules are unavailable.
    if (isRequestSharedCacheable(getRouteRules, h3Event)) {
      maybeWarn(h3Event.path);
      return;
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
