## Unavoidable rule before `git push`

Before pushing any branch that changes behavior or adds features:

1) Review `README.md` for correctness and completeness (CLI/MCP/tooling/skill lists, examples, and security notes).
2) If `README.md` needs updates, update it in the same workstream.
3) Ask the user what they want to do next (push, tag/release, publish to npm, update skills, etc.).

Additional rule for releases/version bumps:

- If the user asks for a version bump (or you detect a version bump via `npm version …` / changes to `package.json` version), re-review `README.md` *specifically* for any example/config changes introduced since the last release (CLI flags, `npx -p …` usage, MCP tool list, env vars).
