#!/usr/bin/env bash
set -euo pipefail

docker info >/dev/null
context="$(mktemp -d)"
image="xno-wallet-create-test:$(basename "$context" | tr '[:upper:]' '[:lower:]')"
cleanup() {
  docker image rm "$image" >/dev/null 2>&1 || true
  rm -r "$context"
}
trap cleanup EXIT

HUSKY=0 npm pack --cache "$context/npm-cache" --pack-destination "$context"
rm -r "$context/npm-cache"
mv "$context"/xno-skills-*.tgz "$context/runtime.tgz"
cp scripts/test-wallet-create.mjs "$context/"
cat > "$context/Dockerfile" <<'DOCKERFILE'
FROM node:22-bookworm-slim
WORKDIR /acceptance
COPY runtime.tgz test-wallet-create.mjs ./
RUN npm install --no-audit --no-fund ./runtime.tgz @modelcontextprotocol/client@2.4.0 \
    && ln -s /acceptance/node_modules/.bin/xno-skills /usr/local/bin/xno-skills
ENV HOME=/tmp/acceptance-home XNO_MCP_HOME=/tmp/acceptance-xno
DOCKERFILE

docker build "$@" -t "$image" "$context"
docker run --rm --network none "$image" node test-wallet-create.mjs
docker run --rm --network none "$image" sh -ec '
  find node_modules -type d -path "*/@open-wallet-standard/core-linux-*-gnu" -prune -exec mv {} /tmp/disabled-ows \;
  node test-wallet-create.mjs --missing-ows
'
