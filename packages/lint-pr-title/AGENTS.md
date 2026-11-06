# AI Agent Guidelines for @auth0/lint-pr-title

## Project Structure

```
packages/lint-pr-title/
├── action.yml     # GitHub Action definition: runs src/index.js on node24
├── src/index.js   # CommonJS: reads the PR title, lints it with the repo's commitlint config, fails the check on errors
├── package.json   # private; @actions/* and @commitlint/* dependencies
└── README.md
```

Used by `.github/workflows/lint-pr-title.yml` as `uses: ./packages/lint-pr-title`, after `npm install` at the repo root — the action runs from source and relies on that install (there is no bundled `dist/`). It loads the rules from the repo-root `commitlint.config.mjs` through `@commitlint/load`; the package defines none of its own. It has no build, lint, or test scripts.

---

## Boundaries

### ✅ Always Do

- Make surgical changes — touch only what the request requires; don't refactor or reformat adjacent code that isn't broken.
- Keep the rules in the repo's `commitlint.config.mjs`; the action should keep loading them rather than duplicating them.
- Update `README.md` in the same PR when changing what the action checks or how it is used.

### ⚠️ Ask First

- **Any breaking change — always ask first.** Never break the behavior that workflows depend on on your own initiative.
- Adding new dependencies.
- Changing `action.yml` (runtime, inputs) or `.github/workflows/lint-pr-title.yml`.

### 🚫 Never Do

- Commit secrets, API keys, or tokens.
- Pass the PR title to a shell, `eval`, or any command — it is attacker-controlled input (see Security).
- Switch the invoking workflow from `pull_request` to `pull_request_target`.
- Hand-edit lock files or `node_modules/`.

---

## Security Considerations

- **Untrusted input:** the PR title comes from the PR author. The action only passes it to `@commitlint/lint` as data and prints the result through `@actions/core`; keep it that way.
- **Trigger:** the workflow runs on `pull_request`, so PRs from forks run without repository secrets. Don't add steps here that need secrets.

---

## Docs Update Rules

`README.md` is the only doc (it describes the action); there is no `EXAMPLES.md` for this internal action. A PR that changes what the action checks, its inputs, or how workflows use it is not complete until `README.md` reflects it.
