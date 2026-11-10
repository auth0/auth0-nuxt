# AI Agent Guidelines for examples

Each directory under `examples/` is a standalone, **private** Nuxt app that people copy from. Because it is copied, it must model secure, idiomatic usage of `@auth0/auth0-nuxt` — an unsafe shortcut here ends up in users' production apps.

---

## Project Structure

```
examples/
└── example-nuxt-*/           # One app per scenario; the `name` in its package.json is the workspace name
    ├── nuxt.config.ts        # Registers @auth0/auth0-nuxt and the runtimeConfig.auth0 keys
    ├── .env.example          # Every environment variable the app reads (never .env)
    ├── README.md             # Setup and behavior of this example
    └── pages/ · middleware/ · server/   # Root-level layout, or app/ + server/ (the Nuxt 4 `app/` directory layout)
```

Check the layout of the example you are editing; they are not all the same (for example `example-nuxt-passkeys` uses the Nuxt 4 `app/` directory). Dependencies on the module are declared as `"@auth0/auth0-nuxt": "*"`, which npm workspaces link to `packages/auth0-nuxt`; the examples consume its built `dist/`, so build the package first.

Some examples are also built by the package's own tests. `packages/auth0-nuxt/test/` references `examples/example-nuxt-passkeys` (fixture config, `global-setup.ts`, `passkeys-*.test.ts`), so a change to it can break those tests.

---

## Boundaries

### ✅ Always Do

- Make surgical changes — touch only what the request requires.
- Configure the app through environment variables (`NUXT_AUTH0_DOMAIN`, `NUXT_AUTH0_CLIENT_ID`, `NUXT_AUTH0_CLIENT_SECRET`, `NUXT_AUTH0_SESSION_SECRET`, `NUXT_AUTH0_APP_BASE_URL`, plus whatever the example adds) and keep `.env.example` in sync when you add one.
- Update the example's `README.md` when its setup or behavior changes, and the matching recipe in `packages/auth0-nuxt/EXAMPLES.md` when the pattern is shown there.
- Build the examples after a change: `npx turbo run build --filter="{./examples/*}"` (what the Build Examples CI job runs).
- When you change an example that the package tests reference, run those tests (see Project Structure).

### ⚠️ Ask First

- Adding dependencies to an example, or changing its Nuxt major version.
- Changing a pattern that `packages/auth0-nuxt/EXAMPLES.md` or the package `README.md` shows — those docs link to the examples.

### 🚫 Never Do

- Hardcode or commit secrets, `.env` files, or tenant credentials.
- Put secrets in `runtimeConfig.public` or in code that runs in the browser.
- Weaken what an example demonstrates for convenience: skipping redirect validation, relaxing cookie settings, or removing the Origin check, rate limit or `no-store` handling from the passkeys routes.
- Hand-edit generated output (`.nuxt/`, `.output/`).

---

## Security Considerations

- Treat every example as production-bound code: it shows the safe default, not a shortcut.
- Secrets (client secret, session secret) are read from environment variables into the private `runtimeConfig.auth0`; each example ignores `.env` through its own `.gitignore`.
- Where an example persists sessions (a custom session store) or accepts user input (the passkeys routes), keep the guards that are already there.

---

## Commands

```bash
npm run build                                     # repo root: the package first, then every example
npx turbo run build --filter="{./examples/*}"     # only the examples (the Build Examples CI job)
npm run dev -w <example-name>                     # run one example; needs a filled-in .env
```
