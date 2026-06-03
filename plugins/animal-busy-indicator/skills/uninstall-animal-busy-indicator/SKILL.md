---
name: uninstall-animal-busy-indicator
description: >
  Remove the animal busy indicator overlay from Claude Code. Kills any running
  overlay, strips only this plugin's hooks from settings.json (detected by the
  'animal-busy' substring), and optionally deletes the installed files. Use on
  /uninstall-animal-busy-indicator or when the user asks to remove/uninstall the
  animal busy indicator.
---

# Uninstall Animal Busy Indicator

Cleanly removes the overlay without touching unrelated hooks or settings. Only
hook commands containing `animal-busy` are removed — the mpv `busy-indicator`
plugin (keyed on `claude-busy.pid`) is never affected.

## Step 1 — Kill any running overlay

```bash
ANIMAL_JS="$HOME/.claude/animal-busy/animal-busy.js"
if [ -f ~/.claude/animal-busy.pid ]; then
  node "$ANIMAL_JS" stop 2>/dev/null || { kill "$(cat ~/.claude/animal-busy.pid)" 2>/dev/null; rm -f ~/.claude/animal-busy.pid; }
  echo "✓ overlay stopped"
else
  echo "(no PID file — nothing to kill)"
fi
```

## Step 2 — Detect what will be removed

```bash
echo "=== animal-busy hooks present ==="
jq '{
  UserPromptSubmit: ((.hooks.UserPromptSubmit // []) | map(.hooks[]? | select(.command | test("animal-busy")))),
  Stop:             ((.hooks.Stop             // []) | map(.hooks[]? | select(.command | test("animal-busy"))))
}' ~/.claude/settings.json
```

If both arrays are empty, tell the user "nothing to uninstall" and skip to Step 4.

## Step 3 — Strip our hooks (and collapse empties)

```bash
SETTINGS="$HOME/.claude/settings.json"
[ -f "$SETTINGS" ] || { echo "no settings.json — nothing to remove"; exit 0; }
cp "$SETTINGS" "$SETTINGS.bak" 2>/dev/null || true

jq '
  if .hooks then
    .hooks |= (
      to_entries
      | map(.value |= (
          map(.hooks |= map(select(.command | test("animal-busy") | not)))
          | map(select(.hooks | length > 0))
        ))
      | map(select(.value | length > 0))
      | from_entries
    )
    | if (.hooks | length == 0) then del(.hooks) else . end
  else . end
' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"

jq empty "$SETTINGS" && echo "✓ valid"
jq -e '.. | .command? // empty | select(test("animal-busy"))' "$SETTINGS" >/dev/null 2>&1 \
  && echo "✗ an animal-busy command still lingers — investigate" \
  || echo "✓ all animal-busy hooks removed"
```

## Step 4 — Ask before deleting files

Use `AskUserQuestion`:

- **Keep files** (recommended if reinstall is possible) — leaves
  `~/.claude/animal-busy/` (~100 MB Electron) and the config in place so a
  reinstall skips the download.
- **Delete files** — frees ~100 MB; reinstall will re-run `npm install`.

If the user chooses delete:

```bash
rm -rf "$HOME/.claude/animal-busy"
rm -f  "$HOME/.claude/animal-busy-config.json"
echo "✓ files deleted"
```

## Step 5 — Hand-off

> ✅ **Uninstalled.** Open `/hooks` once to reload settings — the running
> session caches the removed hooks until you reload. After reload, no overlay
> appears on prompts.
>
> Reinstall any time with `/install-animal-busy-indicator`.
