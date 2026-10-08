# Git Workflow

## Commit messages

- **Conventional Commits**, enforced by commitlint (`commitlint.config.mjs`, extends `@commitlint/config-conventional`).
- The commit **scope must be `auth0-nuxt`** (`scope-enum` rule). Example: `fix(auth0-nuxt): use a syntactically valid domain in middleware test`.
- Types follow the conventional set (`feat`, `fix`, `chore`, `ci`, `test`, `docs`, …).

## PR conventions

- **PR titles are linted** the same conventional way (`.github/workflows/lint-pr-title.yml`, via the internal `packages/lint-pr-title` composite action).
- **Commit messages are linted** in CI (`.github/workflows/lint-commit-message.yml`).
- Required CI checks before merge: **Build and Test** (Node 22 & 24 — build, `test:ci`, lint), **Build Examples**, PR-title lint, commit-message lint, and **sca_scan**.
- No `PULL_REQUEST_TEMPLATE.md` or `CONTRIBUTING.md` is committed; the README links Auth0's org-wide contribution and code-of-conduct guidelines.

## Branches & release

- **Release branches are named `release/*`.** Merging a merged PR whose head branch starts with `release/` triggers `.github/workflows/release.yml`, which publishes to npm (with `--provenance`) and creates the GitHub release. Releases are cut through this flow, not by hand.
- The version source of truth is the root `package.json` and `packages/auth0-nuxt/package.json` — keep them in sync (see Boundaries → Always Do). Do not paste the current version into prose or docs.
