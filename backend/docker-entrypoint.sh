#!/bin/sh
# Docker entrypoint: copies seed DB to volume on first run

set -e

DATA_DIR="/app/data"
SEED_DB="/app/medtech.db"
TARGET_DB="$DATA_DIR/medtech.db"

mkdir -p "$DATA_DIR"

if [ ! -f "$TARGET_DB" ]; then
    echo "🌱 First run: copying seed database to volume..."
    if [ -f "$SEED_DB" ]; then
        cp "$SEED_DB" "$TARGET_DB"
        echo "✅ Seed database copied ($(du -sh $TARGET_DB | cut -f1))"
    else
        echo "⚠️  No seed DB found. Starting with empty database."
    fi
else
    echo "✅ Database already exists at $TARGET_DB"
fi

exec "$@"
