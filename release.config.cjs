/**
 * semantic-release: publish launcher packages from:
 * - npm/poke-agents          (canonical: npx poke-agents@latest)
 * - npm/poke-agents-legacy   (compat: npx @leokok/poke-agents)
 *
 * Runs only on push to main (see .github/workflows/ci-release.yml).
 */
module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        pkgRoot: "npm/poke-agents",
      },
    ],
    [
      "@semantic-release/npm",
      {
        pkgRoot: "npm/poke-agents-legacy",
      },
    ],
    "@semantic-release/github",
    [
      "@semantic-release/git",
      {
        assets: [
          "npm/poke-agents/package.json",
          "npm/poke-agents-legacy/package.json",
          "CHANGELOG.md",
        ],
        message:
          "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
