# Releasing `xno-skills`

This repo publishes to npm automatically when a **GitHub Release** is published.

## One-time setup (recommended): npm Trusted Publishing (no tokens)

This repo is set up to publish via **npm Trusted Publishing** (OIDC), so you don’t need to manage `NPM_TOKEN`.

1. **Verify GitHub Actions workflow requirements**
   - The publish workflow uses Node `24` (includes a recent npm) and requests `id-token: write`.
2. **Enable Trusted Publishing on npm**
   - Go to npm → `xno-skills` package page → **Settings**
   - Find **Trusted publishing** → add a **GitHub Actions** publisher
   - Fill in:
     - **Owner/org:** `CasualSecurityInc`
     - **Repository:** `xno-skills`
     - **Workflow file:** `.github/workflows/publish.yml`
   - Save.

If you previously created `NPM_TOKEN` in GitHub Secrets, it’s no longer required for publishing with Trusted Publishing.

## Release process (recommended)

1. **Decide the version bump**
   - `npm version patch|minor|major`
   - This repo uses npm’s `preversion/version/postversion` hooks to run tests and keep `src/version.ts` in sync.
2. **Build + test locally**
   - `npm test` (already run automatically by `npm version`, but it’s fine to run it explicitly too)
3. **Commit the version bump**
   - `npm version` already creates the commit + tag; no manual version-bump commit required.
4. **Push to GitHub**
   - `git push && git push --tags`
5. **Create a tag matching the version**
   - `npm version` created the tag for you (`vX.Y.Z`).
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

## Fallback: token publishing (not recommended)

If you can’t use Trusted Publishing for some reason, you can switch the workflow back to using `NODE_AUTH_TOKEN` and add an npm token as `NPM_TOKEN` in GitHub Secrets.
