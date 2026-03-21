# GitHub readiness checklist

Use this when making the repo public or handing off maintenance. Check boxes as you go.

## Repository metadata (GitHub UI)

- [ ] **Description** and **website** set on the repo home page.
- [ ] **Topics** added (e.g. `mcp`, `cursor`, `model-context-protocol`, `poke`, `nextjs`, `agents`).
- [ ] **Default branch** is `main` (or document if different).
- [ ] **Branch protection** on `main`: require PR before merge, require **CI** status checks (`verify`), optional reviews.

## Legal / licensing

- [ ] Root **`LICENSE`** (MIT) matches [`package.json`](../package.json) `license`.
- [ ] **[`NOTICE`](../NOTICE)** is accurate for [`vendor/session-editors/`](../vendor/session-editors/).

## Secrets and automation

- [ ] **`NPM_TOKEN`** — [npm automation token](https://www.npmjs.com/settings/~/tokens) with publish access to **`@leokok/poke-agents`**, stored as a GitHub Actions **secret** on this repo.
- [ ] **`GITHUB_TOKEN`** — default; release workflow uses **`contents: write`** for tags/releases and semantic-release’s version commit (no extra secret unless branch rules block the bot; then use a PAT).

## CI vs CD (what runs when)

| | When | What |
|---|------|------|
| **CI** | Every **`pull_request`** and **`push`** on **any branch** | `typecheck`, `npm test`, `npm run build` |
| **CD** | **`push` to `main` only** (after CI passes) | **semantic-release**: bump [`npm/poke-agents/package.json`](../npm/poke-agents/package.json), tag, GitHub Release, **`npm publish`** |

- Feature branches and PRs: **CI only** — nothing is published to npm.
- **Conventional Commits** on `main` drive semver: `fix:` → patch, `feat:` → minor, `BREAKING CHANGE` / `feat!:` → major. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Local verification (before / after changes)

- [ ] `npm install` at repo root succeeds.
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes ([MCP smoke tests](../src/smoke/mcp-tools-smoke.test.ts)).
- [ ] `npm run build` passes (MCP + `web`).
- [ ] No secrets in git (`.env` is gitignored).

## Documentation

- [ ] [`README.md`](../README.md) — install / build / test / run paths stay correct.
- [ ] [`docs/MCP_TOOLS.md`](MCP_TOOLS.md) — tool list matches [`EXPECTED_MCP_TOOL_NAMES`](../src/smoke/mcp-tools-smoke.test.ts) when tools change.

## First-time semantic-release / npm alignment

If **`@leokok/poke-agents`** on npm is already ahead of git tags, add a matching **`vX.Y.Z`** tag on `main` before relying on automated releases so semantic-release does not re-publish or mis-version. After that, routine releases need **no manual** version edits in `npm/poke-agents/package.json`.

## Optional follow-ups

- [ ] Issue / PR templates under `.github/ISSUE_TEMPLATE/`.
- [ ] **commitlint** + **husky** to enforce conventional commits locally.
