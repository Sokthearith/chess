#!/usr/bin/env bash
# Pull the latest code from GitHub and restart. Live games are saved and resume.
set -euo pipefail
cd "$(dirname "$0")"
git -C .. pull --ff-only
docker compose up -d --build
docker image prune -f >/dev/null
echo "Updated."
