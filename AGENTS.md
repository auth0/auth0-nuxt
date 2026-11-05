# AI Agent Guidelines for auth0-nuxt

## Your Role

You are a TypeScript SDK engineer on the auth0-nuxt monorepo, the Auth0 authentication module for Nuxt applications. You write small, well-tested, framework-idiomatic code.

---

## Workspace Packages

This is a Turborepo + npm-workspaces monorepo. **Run build/test/lint with `-w <package>` (or from the package directory), not blindly at the repo root** — each package has its own manifest, test suite, and conventions.

| Package | Path | Purpose |
|---------|------|---------|
| `@auth0/auth0-nuxt` | `packages/auth0-nuxt` | Nuxt module for Auth0 authentication (published to npm) |
| `@auth0/lint-pr-title` | `packages/lint-pr-title` | Private GitHub Action that lints PR titles with commitlint |

`examples/*` are private sample Nuxt apps that are workspace members too. They consume `@auth0/auth0-nuxt` through its built `dist/`, so a change to the module can break them — build the package first. `lint-pr-title` is independent of the module.

Shared root config affects every package: `turbo.json` (task graph), `commitlint.config.mjs` (commit and PR-title rules), `vitest.workspace.js`, `.shiprc` (release tooling).

The one repo-wide command is `npm run build` (Turborepo: the package first, then the examples; this is what CI runs).

---

## Git Workflow

### Branch Naming

Release branches use the `release/*` prefix: `release.yml` publishes when a PR from a `release/*` branch is merged. Other branches have no enforced pattern.

### Commit Messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint (`commitlint.config.mjs`) in three places: the husky `commit-msg` hook, `npx commitlint --last` on pushes to `main`, and the `lint-pr-title` action on PR titles. When a scope is given it **must be** `auth0-nuxt` or `release` (`scope-enum`); a missing scope is not rejected, but always include one, e.g. `fix(auth0-nuxt): reject cross-origin returnTo`. `Release …` commits and `chore(release): <tag>` PRs come from the release tooling (`.shiprc`); don't create them by hand.

### Pull Requests

No local PR template — the [Auth0 org-level template](https://github.com/auth0/.github/blob/master/.github/PULL_REQUEST_TEMPLATE.md) applies. Fill in **Description**, **References**, **Testing**, and the **Checklist** (the PR adds test coverage, adds documentation for new/changed functionality, and targets the correct base branch). Write the description about **why** — the problem, motivation, trade-offs and risks a reviewer cannot read off the diff — not a file-by-file change list; in Testing, say how the change was verified and what was not.
