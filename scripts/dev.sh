#!/bin/bash
set -euo pipefail

trap 'kill 0' EXIT
bun --watch src/index.ts --daemon &
(cd frontend && bun run dev) &
wait
