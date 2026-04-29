#!/bin/bash
set -euo pipefail

echo "==> Checking prerequisites..."
command -v bun >/dev/null 2>&1 || { echo "bun not found"; exit 1; }
bun --version

echo "==> Type checking..."
bun tsc --noEmit

echo "==> Building frontend..."
cd frontend
bun install --frozen-lockfile
bun run build
cd ..

echo "==> Running tests..."
bun test

echo "==> Compiling binary (linux-x64)..."
bun build \
  --compile \
  --minify \
  --target=bun-linux-x64 \
  --asset-naming="[name].[ext]" \
  ./src/index.ts \
  --outfile dist/airlink-linux-x64

echo "==> Compiling binary (linux-arm64)..."
bun build \
  --compile \
  --minify \
  --target=bun-linux-arm64 \
  --asset-naming="[name].[ext]" \
  ./src/index.ts \
  --outfile dist/airlink-linux-arm64

echo "==> Build complete. Binaries in dist/"
ls -lah dist/
