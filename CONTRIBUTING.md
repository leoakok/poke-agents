# Contributing

## Local setup

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

- **Lint** runs ESLint on the Next.js dashboard (`web/`).
- **Smoke tests** exercise every MCP tool in-process ([`src/smoke/mcp-tools-smoke.test.ts`](src/smoke/mcp-tools-smoke.test.ts)).
- **Full stack:** [`docs/LOCAL_TEST.md`](docs/LOCAL_TEST.md).

## Commits and releases (Conventional Commits)

Releases of **`poke-agents`** on npm are automated from **`main`** via [semantic-release](https://semantic-release.gitbook.io/) when CI passes. Use [Conventional Commits](https://www.conventionalcommits.org/) so versions are computed correctly:

| Commit type | Semver bump |
|-------------|-------------|
| `fix: …` | patch |
| `feat: …` | minor |
| `feat!: …` or footer `BREAKING CHANGE:` | major |
| `docs:`, `chore:`, `ci:`, etc. | no release (unless using custom rules) |

Examples:

- `fix: handle empty session list in adapters`
- `feat: add control_run_status tool`
- `feat!: rename MCP tool ids` (major)

Merge to **`main`** via PR when possible so **CI** runs on the branch first.

## Maintainer secrets

Publishing requires the **`NPM_TOKEN`** GitHub Actions secret. See [`docs/GITHUB_READINESS.md`](docs/GITHUB_READINESS.md).

## Vendored code

Third-party editor readers live under [`vendor/session-editors/`](vendor/session-editors/). See [`NOTICE`](NOTICE) for license and attribution.
