#!/usr/bin/env bash
set -Eeuo pipefail
target=${1:?Usage: backup.sh /path/to/backup.archive.gz}
umask 077
test ! -e "$target" || { echo 'Backup file already exists'; exit 1; }
docker compose exec -T mongo sh -c 'mongodump --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$MONGO_DB" --archive --gzip' > "$target"
test -s "$target"
echo "Backup saved: $target"
