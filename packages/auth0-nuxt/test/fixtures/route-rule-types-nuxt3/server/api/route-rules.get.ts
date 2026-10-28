import { defineEventHandler } from 'h3';
import { getRouteRules } from 'nitropack/runtime';

/**
 * Mirror of `../../../route-rule-types/server/api/route-rules.get.ts` for Nuxt 3.
 *
 * Reads the rule back the way a consuming app would, which only typechecks when the module
 * registers its declaration with the `nitro` context as well as `nuxt` and `node`.
 *
 * `defineEventHandler` is imported rather than auto-imported so this file also compiles in the
 * package's own tsconfig program, which sweeps up `test/**` and has no Nitro auto-imports.
 */
export default defineEventHandler((event) => {
  const ssrUser: boolean | undefined = getRouteRules(event).auth0?.ssrUser;
  return { ssrUser };
});
