#!/bin/bash
# gspowers installer — symlinks skill files to Claude Code skills directory

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$SCRIPT_DIR/skills/gspowers"
TARGET="$HOME/.claude/skills/gspowers"

mkdir -p "$(dirname "$TARGET")"

if [ -L "$TARGET" ]; then
  echo "Updating existing symlink..."
  rm "$TARGET"
elif [ -d "$TARGET" ]; then
  echo "Warning: $TARGET exists as a directory. Backing up to ${TARGET}.bak"
  mv "$TARGET" "${TARGET}.bak"
fi

ln -sf "$SOURCE" "$TARGET"
echo "Installed: $TARGET -> $SOURCE"
echo "Run /gspowers in any git project to start."
