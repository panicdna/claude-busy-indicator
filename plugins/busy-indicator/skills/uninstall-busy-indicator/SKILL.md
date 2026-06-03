---
name: uninstall-busy-indicator
description: >-
  Remove the busy-indicator hooks installed by /install-busy-indicator. Cleans
  hooks referencing claude-busy.pid from ~/.claude/settings.json, kills any
  running mpv from this setup, and optionally removes the cached video.
  Preserves all unrelated hooks and settings. Use when the user wants to
  disable the busy indicator, clean up after experimentation, or migrate away
  from this pattern.
metadata:
  author: panicdna
  version: 1.0.0
  category: hooks
  tags: [hooks, busy-indicator, uninstall, cleanup]
---

# Uninstall Busy Indicator

Remove busy-indicator hooks and clean up. Preserves all unrelated hooks and
settings — only entries whose command references `claude-busy.pid` are
removed.

## Steps

### 1. Kill any running mpv from this setup

```bash
PID_FILE=~/.cache/claude-busy.pid
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
  echo "✓ running mpv killed and PID file removed"
else
  echo "(no PID file — nothing to kill)"
fi
```

### 2. Detect what will be removed (for the user's confirmation)

```bash
echo "=== Existing busy-indicator hooks ==="
jq '
  {
    UserPromptSubmit: ((.hooks.UserPromptSubmit // []) | map(.hooks[] | select(.command | test("claude-busy.pid")))),
    Stop: ((.hooks.Stop // []) | map(.hooks[] | select(.command | test("claude-busy.pid"))))
  }
' ~/.claude/settings.json
```

If both arrays are empty, tell the user "nothing to uninstall" and skip to step 5
(cache cleanup question).

### 3. Strip our hooks from settings.json

Filter out any hook entry whose command contains `claude-busy.pid`. Collapse
emptied parent arrays / keys so we don't leave structural garbage behind.

```bash
jq '
  if .hooks then
    .hooks |= (
      to_entries
      | map(
          .value |= (
            map(.hooks |= map(select(.command | test("claude-busy.pid") | not)))
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
jq -e '.. | .command? // empty | select(test("claude-busy.pid"))' ~/.claude/settings.json >/dev/null 2>&1 \
  && echo "✗ a busy-indicator command still lingers somewhere — investigate" \
  || echo "✓ all busy-indicator commands removed"
```

### 5. Delete cached video

Always delete without asking:
```bash
SIZE=$(stat -c %s ~/.claude/assets/busy.mp4 2>/dev/null || echo 0)
rm -f ~/.claude/assets/busy.mp4
echo "✓ deleted (freed $((SIZE / 1024 / 1024)) MB)"
```

### 6. Hand-off

Tell the user:

> Uninstalled. Open `/hooks` once to reload settings — the running session
> still caches the removed hooks until you reload. After reload, no video
> window will appear on prompts.
>
> Reinstall any time with `/install-busy-indicator`.

## Notes for the model

- This skill never touches settings unrelated to busy-indicator.
- The `jq` filter uses `test("claude-busy.pid")` as the detection signature.
  This string is intentionally unique enough that it won't false-match other
  hooks. If the user had their own hook that mentions `claude-busy.pid` for
  some other reason (unlikely), that would be removed too — flag this risk if
  the pre-detection step shows hooks the user doesn't recognize.
- Do not also remove `~/.cache/claude-busy.pid` aggressively if the file isn't
  ours — but in practice we created it, so cleaning it is safe.
