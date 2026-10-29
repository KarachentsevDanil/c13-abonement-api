#!/bin/bash
# PostToolUse (Edit|Write): tsc --noEmit і eslint на щойно змінений .ts-файл.
# exit 2 — вивід потрапляє агенту.
file=$(jq -r '.tool_input.file_path')
case "$file" in
  *.ts) ;;
  *) exit 0 ;;
esac

# Хук запускається в поточному каталозі агента — переходимо в корінь проєкту
cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! out=$( { npx tsc --noEmit && npx eslint "$file"; } 2>&1 ); then
  echo "$out" >&2
  exit 2
fi
exit 0
