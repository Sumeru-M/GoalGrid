#!/usr/bin/env bash
# Link the shared engine/backend into this app's node_modules as packages, so
# Metro resolves them like any workspace package. Re-run after `npm install`
# (installs wipe these links). Idempotent.
set -euo pipefail
cd "$(dirname "$0")/.." # apps/mobile
mkdir -p node_modules
ln -sfn ../../../src node_modules/goalgrid-core
ln -sfn ../../../backend node_modules/goalgrid-backend
echo "linked goalgrid-core -> ../../src, goalgrid-backend -> ../../backend"
