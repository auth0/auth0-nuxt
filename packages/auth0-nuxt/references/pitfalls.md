# Common Pitfalls

- **`.nuxt/tsconfig.json` must exist before building.** `tsconfig.json` extends `./.nuxt/tsconfig.json`, which `nuxt-module-build prepare` writes. `npm run build` runs it as `prebuild`; calling `nuxt-module-build build` directly on a fresh checkout fails with `EXTENDS_RESOLVE`.
- **Nuxt reads `~/.nuxtrc` on startup.** Loading a Nuxt config (build, `prepare`, vitest's `nuxt` environment) reads the global rc file; an environment that blocks that read fails with `EPERM` on `~/.nuxtrc`.
- **`packages/auth0-nuxt/.nuxtrc` is a test artifact.** The unit tests write it (it records the `@nuxt/test-utils` setup version). It shows up untracked and is not in `.gitignore`; don't commit it.
- **`build:watch` and `tsup.config.ts` are stale.** Both point at `src/index.ts`, which doesn't exist; the module is built by `nuxt-module-build`. Rebuild with `build`.
- **Examples consume `dist/`, e2e fixtures consume source.** An example resolves `@auth0/auth0-nuxt` to the built `dist/`, so rebuild the package before running or building one; the e2e fixtures load `src/module` directly.
- **`NUXT_*` variables override `runtimeConfig`.** Exported tenant credentials silently replace a fixture's fake settings unless the test calls `ignoreNuxtEnv()` first.
- **Playwright browsers.** `npm test` and `npm run test:ci` install them (`pretest` hooks); `npm run test:e2e` run directly does not, and the browser-based tests (`createPage`) then fail to launch.
