#!/bin/bash
# Stop: юніт-тести перед тим, як агент завершить відповідь.
# exit 2 — агент не зупиняється й бачить вивід; другий Stop поспіль пропускаємо.
if [ "$(jq -r '.stop_hook_active')" = "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0

if ! out=$(npx vitest run --project unit 2>&1); then
  echo "$out" | tail -40 >&2
  exit 2
fi
exit 0
