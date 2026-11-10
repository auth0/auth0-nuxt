# Code Style

## Enforced

- ESLint flat config (`eslint.config.mjs`): `@eslint/js` recommended + `typescript-eslint` recommended; ignores `dist/*` and `**/.nuxt/**`. `npm run lint` fails CI.
- `.prettierrc`: single quotes, `printWidth` 120, `arrowParens: always`, `trailingComma: es5`. No Prettier script or dependency exists, so nothing enforces it — match it by hand.

## Naming and layout

- Files are kebab-case. Handlers are named after the route and method: `login.get.ts`, `backchannel-logout.post.ts`; specs sit next to them (`login.get.spec.ts`).
- One `export default defineEventHandler(...)` per handler file. Types and classes are PascalCase, functions camelCase.
- Shared types are imported from `~/src/types`; relative imports have no extension.
- Everything exported publicly carries JSDoc (TypeDoc builds `docs/` from `src/module.ts`).

## Patterns

- Handlers get the auth client with `useAuth0(event)` and the options from `event.context.auth0ClientOptions`.
- Redirect targets are validated with `toSafeRedirect` before use.
- Module options are declared on `ModuleOptions` in `src/module.ts` with JSDoc and `@default`; runtime pieces are registered in `setup()`.

## Examples

✅ Validate a user-controlled redirect (from `runtime/server/api/auth/login.get.ts`):

```ts
const dangerousReturnTo = query.returnTo ?? auth0ClientOptions.appBaseUrl;
const sanitizedReturnTo = toSafeRedirect(dangerousReturnTo as string, auth0ClientOptions.appBaseUrl);
```

❌ Using the value directly:

```ts
sendRedirect(event, String(query.returnTo)); // open redirect
```

Avoid `any`, unchecked `as` casts and non-null assertions (`!`) in `src/`; prefer `unknown` plus narrowing.
