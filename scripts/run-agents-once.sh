#!/usr/bin/env bash
# Run all marketing agents once (local or on server).
set -euo pipefail
cd "$(dirname "$0")/.."

node --import tsx scripts/run-agents-once.mjs "$@"
