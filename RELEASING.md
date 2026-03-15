# Releasing `xno-skills`

This repo publishes to npm automatically when a **GitHub Release** is published.

## One-time setup

1. **Create an npm automation token**
   - Create a token with publish access for the `xno-skills` package.
2. **Add GitHub Actions secret**
   - In GitHub → Settings → Secrets and variables → Actions → New repository secret:
     - Name: `NPM_TOKEN`
     - Value: the npm token
3. **Permissions**
   - The publish workflow uses npm provenance (`--provenance`) and OIDC (`id-token: write`). No extra setup is usually required beyond `NPM_TOKEN`.

## Release process (recommended)

1. **Decide the version bump**
   - `npm version patch|minor|major --no-git-tag-version`
2. **Build + test locally**
   - `npm test`
3. **Commit the version bump**
   - Commit `package.json`, `package-lock.json`, and `src/version.ts`.
4. **Push to GitHub**
5. **Create a tag matching the version**
   - Tag format must be `vX.Y.Z` (e.g. `v0.3.0`)
6. **Publish a GitHub Release for that tag**
   - When the Release is **published**, GitHub Actions will:
     - check out the tag
     - verify the tag matches `package.json` version
     - `npm ci`, build, test
     - `npm publish --provenance --access public`

## Guardrails

- The publish workflow fails if:
  - the GitHub Release tag does not match `v${package.json.version}`
  - tests fail
- `npm publish` runs `prepack`, which builds both ESM and CJS outputs.

## Manual publish (emergency only)

If automation is down, you can publish locally:

1. `npm ci`
2. `npm test`
3. `npm publish --access public`

Then fix the automation for next time.

