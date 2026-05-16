#!/usr/bin/env bash
# Import a MySQL dump into the running docker compose db service.
# Usage (from repo root homeconnect/):
#   ./scripts/import-db.sh path/to/backup.sql
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DUMP_FILE="${1:?Usage: ./scripts/import-db.sh path/to/backup.sql}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "File not found: $DUMP_FILE" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "Missing .env — copy from .env.example first." >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env
set +a

DB="${DB_NAME:-homeconnect}"
echo "Importing $DUMP_FILE into database '$DB' ..."

docker compose exec -T db mysql -u root -p"${MYSQL_ROOT_PASSWORD}" "$DB" < "$DUMP_FILE"

echo "Done."
