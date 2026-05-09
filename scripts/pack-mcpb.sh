#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION=$(node -p "require('./package.json').version")
echo "Packing xno-skills v${VERSION} as MCPB..."

# Inject version into manifest
sed "s/{{VERSION}}/$VERSION/" mcpb/manifest.json.tpl > mcpb/manifest.json

# Build ESM output (skip if already built, e.g. in CI)
if [ ! -d "dist/esm" ]; then
  npm run build:esm
fi

# Stage server files
rm -rf mcpb/server
mkdir -p mcpb/server

cp -r dist mcpb/server/dist
cp package.json mcpb/server/package.json

# Install production deps into staging dir (includes platform .node binary)
npm install --omit=dev --prefix mcpb/server --no-package-lock --silent

# Pack — mcpb pack <directory> <output>
mcpb pack mcpb server.mcpb

echo "Done: ${ROOT}/server.mcpb"
