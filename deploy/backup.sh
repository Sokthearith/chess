#!/usr/bin/env bash
# A consistent copy of the database (accounts, ratings, games) into deploy/backups/.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p backups
name="counterplay-$(date +%Y%m%d-%H%M%S).db"
docker compose exec -T app node -e "new (require('node:sqlite').DatabaseSync)('/data/counterplay.db').exec(\"VACUUM INTO '/data/$name'\")"
docker compose cp "app:/data/$name" "backups/$name"
docker compose exec -T app rm "/data/$name"
echo "Saved deploy/backups/$name"
