---
name: uninstall-animal-busy-indicator
description: >-
  Remove the animal-busy-indicator hooks installed by
  /install-animal-busy-indicator. Kills any running overlay, cleans hooks
  referencing animal-busy.pid from ~/.claude/settings.json, and optionally
  deletes the installed Electron app. Preserves all unrelated hooks and settings.
  Use when the user wants to disable the animal busy indicator, clean up after
  experimentation, or runs /uninstall-animal-busy-indicator.
metadata:
  author: panicdna
  version: 1.0.0
  category: hooks
  tags: [hooks, electron, overlay, busy-indicator, uninstall, cleanup]
---

# Uninstall Animal Busy Indicator

Remove animal-busy-indicator hooks and clean up. Preserves all unrelated hooks
and settings — only entries whose command references `animal-busy.pid` are
removed.

## Steps

### 1. Kill any running overlay from this setup

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
PID_FILE="$HOME/.claude/animal-busy.pid"

if [ -f "$INSTALL_DIR/animal-busy.js" ]; then
  node "$INSTALL_DIR/animal-busy.js" stop 2>/dev/null
fi
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
  echo "✓ overlay stopped and PID file removed"
else
  echo "(no PID file — nothing to kill)"
fi
```

### 2. Detect what will be removed (for the user's confirmation)

```bash
echo "=== Existing animal-busy hooks ==="
jq '
  {
    UserPromptSubmit: ((.hooks.UserPromptSubmit // []) | map(.hooks[] | select(.command | test("animal-busy.pid")))),
    Stop: ((.hooks.Stop // []) | map(.hooks[] | select(.command | test("animal-busy.pid"))))
  }
' ~/.claude/settings.json
```

If both arrays are empty, tell the user "nothing to uninstall" and skip to step 5
(file cleanup question).

### 3. Strip our hooks from settings.json

Filter out any hook entry whose command contains `animal-busy.pid`. Collapse
emptied parent arrays / keys so no structural garbage is left behind.

```bash
jq '
  if .hooks then
    .hooks |= (
      to_entries
      | map(
          .value |= (
            map(.hooks |= map(select(.command | test("animal-busy.pid") | not)))
            | map(select(.hooks | length > 0))
          )
        )
      | map(select(.value | length > 0))
      | from_entries
    )
    | if (.hooks | length == 0) then del(.hooks) else . end
  else . end
' ~/.claude/settings.json > /tmp/settings.new && mv /tmp/settings.new ~/.claude/settings.json
```

### 4. Validate JSON

```bash
jq empty ~/.claude/settings.json && echo "✓ valid"
jq -e '.. | .command? // empty | select(test("animal-busy.pid"))' ~/.claude/settings.json >/dev/null 2>&1 \
  && echo "✗ an animal-busy command still lingers somewhere — investigate" \
  || echo "✓ all animal-busy commands removed"
```

### 5. Ask about installed files

Use `AskUserQuestion`:
- "Keep `~/.claude/animal-busy/` and config" — recommended if reinstall is
  possible (avoids re-running the ~100 MB `npm install electron`)
- "Delete `~/.claude/animal-busy/` and config" — frees disk space; reinstall will
  re-download Electron

If the user chose delete:

```bash
rm -rf "$HOME/.claude/animal-busy"
rm -f  "$HOME/.claude/animal-busy-config.json"
rm -f  "$HOME/.claude/animal-busy.pid"
echo "✓ files deleted"
```

### 6. Hand-off

Tell the user:

> Uninstalled. Open `/hooks` once to reload settings — the running session still
> caches the removed hooks until you reload. After reload, no overlay will appear
> on prompts.
>
> Reinstall any time with `/install-animal-busy-indicator`.

## Notes for the model

- This is a **non-destructive** skill in two senses: (a) it never touches
  settings unrelated to animal-busy, and (b) it asks before deleting the
  installed Electron app. Maintain both properties.
- The `jq` filter uses `test("animal-busy.pid")` as the detection signature —
  the same trailing comment string the install skill writes into each hook
  command. This is intentionally unique enough to avoid false matches.
- The overlay process is killed via the bundled `animal-busy.js stop` (PID file),
  not `pkill electron`, so a user's other Electron apps are never touched.
