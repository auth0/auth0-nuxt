/**
 * Types the `auth0` key on Nitro route rules so this package's own sources and test
 * fixtures can use `routeRules: { '<path>': { auth0: { ssrUser: false } } }`.
 *
 * NOTE: this declaration is internal to this repository — it is not shipped in a way that
 * reaches consumers' `nuxt.config` type-checking (Nuxt does not pull a module's exported
 * types into the config's program). Consumers who want the `auth0` route-rule key typed can
 * copy the `declare module 'nitropack'` block below into a `.d.ts` in their own project; see
 * the README. The middleware reads the key at runtime regardless of whether it is typed.
 */
interface Auth0RouteRules {
  /**
   * Populate `useUser()` during server-side rendering for routes matching this rule.
   * Set to `false` to skip the SSR user write so the route's HTML stays anonymous; the
   * user is hydrated client-side instead. Apply it to `/**` to opt out globally.
   * @default true
   */
  ssrUser?: boolean;
}

declare module 'nitropack' {
  interface NitroRouteConfig {
    auth0?: Auth0RouteRules;
  }
}

declare module 'nitropack/types' {
  interface NitroRouteConfig {
    auth0?: Auth0RouteRules;
  }
}

export {};
