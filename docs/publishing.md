# Publishing `@leokok/poke-agents`

The **npm package** is only the thin launcher in **`npm/poke-agents/`** (like `poke-apple-music-mcp/npm/poke-apple-music/`). The rest of this repo is the implementation that gets cloned into `~/.local/share/poke-agents/repo`.

```bash
cd npm/poke-agents
npm login    # once
npm publish --access public
```

Bump **`version`** in `npm/poke-agents/package.json` before each release.

## GitHub Actions

If this repository’s **root** is the `poke-agents` project, the workflow at [`.github/workflows/release.yml`](../.github/workflows/release.yml) publishes when the version is new on npm. Set the **`NPM_TOKEN`** secret (granular token scoped to **`@leokok/poke-agents`**).

If `agents/` lives inside a larger monorepo, move or copy that workflow to the monorepo’s `.github/workflows/` and adjust paths (e.g. `working-directory: agents/npm/poke-agents`).
