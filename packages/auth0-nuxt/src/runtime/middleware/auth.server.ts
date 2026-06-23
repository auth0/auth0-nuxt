import { defineNuxtRouteMiddleware, useNuxtApp } from '#imports';
import { useUser } from '../composables/use-user';
import { importMetaDev } from '../helpers/import-meta';
import { shouldSkipSsrUserWrite } from '../server/utils/should-skip-ssr-user-write';

const warnedPaths = new Set<string>();

/**
 * Middleware that ensures the useUser composable is populated with the current user
 * during server-side rendering.
 *
 * The user is NOT written into the SSR payload (which Nuxt serializes into the `__NUXT__`
 * HTML) when either:
 *   - the route opts out explicitly via the `auth0: { ssrUser: false }` route rule
 *     (set it on `/**` to opt out globally, or on specific paths for per-route control), or
 *   - the route is shared-cacheable, so cached HTML stays anonymous.
 *
 * In those cases the user is hydrated client-side instead by the `auth.client` plugin.
 * Fails closed: if route rules are unavailable, the SSR write is skipped and the client hydrates.
 */
export default defineNuxtRouteMiddleware(async () => {
  // A literal `import.meta.server` guard (not the `importMetaServer` helper) is required
  // here: Vite replaces `import.meta.server` with the literal `false` in the client bundle,
  // so this whole block is tree-shaken away — crucially stripping the server-only
  // `import('nitropack/runtime')` below, which resolves to Nitro virtual modules that
  // cannot be loaded in the client environment and would otherwise break `nuxt build`. The
  // branching skip logic lives in `shouldSkipSsrUserWrite` so it stays unit-testable
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

    // Skip the SSR user write when the route opts out (`auth0: { ssrUser: false }`) or is
    // shared-cacheable (hardened against the route-rule case-sensitivity bypass,
    // CVE-2026-53721). Fails closed if route rules are unavailable.
    if (shouldSkipSsrUserWrite(getRouteRules, h3Event)) {
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
      `[auth0-nuxt] Route "${path}" is shared-cacheable or opted out; skipping the SSR user write to keep the HTML anonymous. ` +
        `The user will be hydrated client-side from the profile endpoint.`
    );
  }
}
