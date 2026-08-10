/**
 * Types the `auth0` key on Nitro route rules, so anything in this repo can write
 * `routeRules: { '<path>': { auth0: { ssrUser: false } } }` and have it typecheck.
 *
 * NOTE: this declaration does not reach consumers' `nuxt.config` type-checking. Nuxt does
 * not pull a module's exported types into the config's program. Consumers who want the key
 * typed can copy the `declare module` blocks below into a `.d.ts` in their own project; see
 * README section 5. The route rule is read at runtime whether or not it is typed.
 */
interface Auth0RouteRules {
  /**
   * Populate `useUser()` during server-side rendering for routes matching this rule.
   * Set to `false` to keep the route's HTML anonymous; the user is hydrated client-side
   * instead. Apply it to `/**` to opt out globally.
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
