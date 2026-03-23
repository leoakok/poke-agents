# Publishing `poke-agents` (+ legacy shim)

The **npm package** is only the thin launcher in **`npm/poke-agents/`** (like `poke-apple-music-mcp/npm/poke-apple-music/`). The rest of this repo is the implementation that gets cloned into `~/.local/share/poke-agents/repo`.

## Automated (default)

On every **`push` to `main`** after **CI** passes, [semantic-release](https://semantic-release.gitbook.io/) (see [`release.config.cjs`](../release.config.cjs)):

1. Bumps **`npm/poke-agents/package.json`** from [Conventional Commits](https://www.conventionalcommits.org/) on `main`.
2. Updates root **`CHANGELOG.md`**, commits with **`[skip ci]`**, tags **`vX.Y.Z`**, opens a **GitHub Release**.
3. Runs **`npm publish`** from **`npm/poke-agents/`**.

Workflow: [`.github/workflows/ci-release.yml`](../.github/workflows/ci-release.yml).  
Secret: **`NPM_TOKEN`** (publish access for **`poke-agents`** and **`@leokok/poke-agents`**).
Details: [`GITHUB_READINESS.md`](GITHUB_READINESS.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Manual (emergency only)

```bash
cd npm/poke-agents
npm login    # once
npm publish --access public
```

Avoid manual version bumps when automation is enabled—they can desync tags and npm.

## Monorepo note

If `agents/` lives inside a larger monorepo, move or copy **`.github/workflows/ci-release.yml`**, **`release.config.cjs`**, and adjust `pkgRoot` / paths as needed.
