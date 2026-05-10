Use this workflow to ship `xno-skills` changes to production.

1. Review the worktree before doing anything:
Run `git status`.
Run `git diff`.
If there are staged changes, also run `git diff --staged`.

2. Group changes into logical commit phases.
Stage only the files for the current phase.
Create a clear commit message for that phase.
Do not mix unrelated changes in one commit.

3. After every commit phase, verify the repository is still healthy before moving on.
Run `npm run build`.
Run `npm test`.
If either command fails, fix the issue before creating the next commit.

4. When all intended changes are committed and the full test suite passes, decide whether this ship changes the published package.
Published package in this repository: `xno-skills` on npm.
Published automation also packages and publishes the MCP bundle and the `skills/nano` skill from CI after the npm release succeeds.
If the ship changes user-facing package contents, release behavior, CLI/MCP behavior, exported library behavior, bundled assets, or shipped skill content, create a version release.
If the ship is internal-only (tests, docs, repo config, CI-only maintenance with no shipped package change), skip versioning.

5. Changesets are not used in this repository.
There is no `.changeset/` configuration and no Changesets command in the project.
Do not invent a Changesets step here.
For published-package changes, use the local release version command instead: `npm version patch`, `npm version minor`, or `npm version major`.
`npm version` runs this repo's release hooks, including tests and syncing `src/version.ts`, `README.md`, and `skills/nano/SKILL.md`.

6. Push the completed ship.
For internal-only changes with no version bump: `git push`.
For published-package releases: `git push --follow-tags`.

7. Wait for GitHub Actions to finish.
CI workflow: `.github/workflows/ci.yml`.
Publish workflow: `.github/workflows/publish.yml`.
Use the GitHub UI or `gh` CLI to watch the relevant runs.
For example: `gh run list --workflow ci.yml --limit 5` and `gh run list --workflow publish.yml --limit 5`.

8. Confirm production release completion.
For internal-only ships: confirm the CI workflow is green.
For published-package releases: confirm all of the following.
The pushed tag matches `package.json` version.
The publish workflow is green.
`npm publish` completed for `xno-skills`.
The GitHub Release was created.
The MCP bundle publish step completed.
The Smithery nano skill publish step completed.

9. Do not declare the ship complete until every required workflow is green.
