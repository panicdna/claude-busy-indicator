---
name: install-animal-busy-indicator
description: >-
  Install a transparent pixel-art animal overlay busy indicator for Claude Code.
  Adds UserPromptSubmit + Stop hooks to ~/.claude/settings.json that spawn a
  frameless Electron window showing a running animal (cat/dog/fox/rabbit) along a
  screen edge while Claude is working, and close it when done. Idempotent — re-run
  to reconfigure (character, position, size, speed, theme). Use when the user asks
  for an "animal busy indicator", "running animal overlay", "pixel art spinner",
  or runs /install-animal-busy-indicator.
metadata:
  author: panicdna
  version: 1.0.0
  category: hooks
  tags: [hooks, electron, overlay, pixel-art, busy-indicator]
---

# Install Animal Busy Indicator

Set up a desktop visual indicator: a frameless, transparent Electron window shows
a running pixel-art animal along a screen edge while Claude is processing, and is
killed when Claude finishes. Requires a working GUI display (WSL2 with WSLg, or
native Linux with X/Wayland).

## Pre-flight checks

Run all in one Bash call:

```bash
echo "=== node ==="; command -v node && node --version || echo MISSING
echo "=== npm ==="; command -v npm || echo MISSING
echo "=== display ==="; echo "DISPLAY=${DISPLAY:-unset}  WAYLAND=${WAYLAND_DISPLAY:-unset}"
echo "=== jq ==="; command -v jq || echo MISSING
echo "=== plugin root ==="; echo "${CLAUDE_PLUGIN_ROOT:-unset}"
```

If `node`/`npm` is MISSING, stop and tell the user:
> Please run `! sudo apt install -y nodejs npm` (you can't sudo from here), then
> retry `/install-animal-busy-indicator`.

If both `DISPLAY` and `WAYLAND_DISPLAY` are unset, stop — this skill needs a GUI
display. On WSL2, ensure WSLg is enabled (`wsl --update` from Windows).

## Detect existing installation

```bash
jq -e '.hooks.UserPromptSubmit[]?.hooks[]? | select(.command | test("animal-busy.pid"))' ~/.claude/settings.json >/dev/null 2>&1 && echo "EXISTS" || echo "FRESH"
```

If EXISTS, ask the user:
> Animal busy indicator is already installed. Reconfigure with new settings?

If they decline, exit without changes.

## Locate the bundled payload

The plugin bundles `animal-busy.js` and `overlay/` (the Electron app). Find the
plugin root — prefer `$CLAUDE_PLUGIN_ROOT`, fall back to a search:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"
if [ -z "$PLUGIN_ROOT" ] || [ ! -f "$PLUGIN_ROOT/animal-busy.js" ]; then
  PLUGIN_ROOT=$(dirname "$(find ~/.claude -path '*animal-busy-indicator/animal-busy.js' 2>/dev/null | head -1)")
fi
echo "PLUGIN_ROOT=$PLUGIN_ROOT"
[ -f "$PLUGIN_ROOT/animal-busy.js" ] && echo "✓ payload found" || echo "✗ payload missing — is the plugin installed?"
```

If the payload can't be found, stop and tell the user to run
`/plugin install animal-busy-indicator` first.

## Steps

### 1. Copy the payload into ~/.claude/animal-busy

Copy **both** `animal-busy.js` and the `overlay/` directory so the runtime layout
matches what `animal-busy.js` expects (`__dirname/overlay`).

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
mkdir -p "$INSTALL_DIR"
cp "$PLUGIN_ROOT/animal-busy.js" "$INSTALL_DIR/animal-busy.js"
cp -r "$PLUGIN_ROOT/overlay" "$INSTALL_DIR/overlay"
echo "Installed to $INSTALL_DIR:"; ls -R "$INSTALL_DIR" | head -20
```

### 2. Install Electron (into overlay/)

`package.json` and the electron binary live under `overlay/`, and
`animal-busy.js` resolves electron at `overlay/node_modules/.bin/electron`. Run
the install there:

```bash
cd "$HOME/.claude/animal-busy/overlay"
npm install 2>&1 | tail -5
echo "npm install exit: ${PIPESTATUS[0]}"
```

This downloads ~100 MB the first time — tell the user to wait. If it succeeds,
verify the binary exists:

```bash
ls "$HOME/.claude/animal-busy/overlay/node_modules/.bin/electron" && echo "✓ electron present" || echo "✗ electron missing"
```

### 3. Gather parameters

Unless the user specified in their request, use `AskUserQuestion` (each as a
separate single-select question). Defaults in **bold**:

- **Character**: **cat** / dog / fox / rabbit
- **Position**: **bottom** / top / left / right
- **Size (px)**: 32 / 48 / **64** / 96
- **Speed (1–8)**: **3**
- **Theme**: **transparent** / dark (dark draws a dim strip so the window is
  visible on busy desktops)

Write the config (substitute the user's choices):

```bash
cat > "$HOME/.claude/animal-busy-config.json" << 'CONF'
{
  "character": "cat",
  "position": "bottom",
  "size": 64,
  "speed": 3,
  "theme": "transparent"
}
CONF
echo "Config written:"; cat "$HOME/.claude/animal-busy-config.json"
```

### 4. Smoke test before writing settings

Spawn the overlay standalone for ~3s and stop it. This catches display/sandbox
problems before they reach settings.json.

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
ELECTRON="$INSTALL_DIR/overlay/node_modules/.bin/electron"

ELECTRON_DISABLE_SANDBOX=1 "$ELECTRON" "$INSTALL_DIR/overlay/main.js" start &
sleep 3
node "$INSTALL_DIR/animal-busy.js" stop 2>/dev/null || kill %1 2>/dev/null
echo "Smoke test done."
```

Ask the user whether they saw the animal. If Electron crashed with a sandbox
error, confirm `ELECTRON_DISABLE_SANDBOX=1` is present (it is, in the hook below).

### 5. Compose hook commands

The hooks call the bundled `animal-busy.js`, which spawns/kills the Electron
overlay and manages `~/.claude/animal-busy.pid`. The trailing
`# animal-busy.pid` comment is the **detection signature** used for idempotent
re-install and surgical uninstall.

**Spawn** (UserPromptSubmit):
```
ELECTRON_DISABLE_SANDBOX=1 node ~/.claude/animal-busy/animal-busy.js start # animal-busy.pid
```

**Stop** (Stop):
```
node ~/.claude/animal-busy/animal-busy.js stop # animal-busy.pid
```

### 6. Merge into ~/.claude/settings.json

Use `jq` to add hooks while preserving any other settings/hooks. Existing
animal-busy hooks (detected by the `animal-busy.pid` substring) are replaced, so
re-install is idempotent.

```bash
[ -f ~/.claude/settings.json ] || echo '{}' > ~/.claude/settings.json

SPAWN_CMD='ELECTRON_DISABLE_SANDBOX=1 node ~/.claude/animal-busy/animal-busy.js start # animal-busy.pid'
KILL_CMD='node ~/.claude/animal-busy/animal-busy.js stop # animal-busy.pid'

jq --arg spawn "$SPAWN_CMD" --arg kill "$KILL_CMD" '
  .hooks //= {}
  | .hooks.UserPromptSubmit = (
      (.hooks.UserPromptSubmit // [])
      | map(.hooks |= map(select(.command | test("animal-busy.pid") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $spawn}]}]
  | .hooks.Stop = (
      (.hooks.Stop // [])
      | map(.hooks |= map(select(.command | test("animal-busy.pid") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $kill}]}]
' ~/.claude/settings.json > /tmp/settings.new && mv /tmp/settings.new ~/.claude/settings.json
```

### 7. Validate

```bash
jq empty ~/.claude/settings.json && echo "✓ JSON valid"
jq -e '.hooks.UserPromptSubmit[].hooks[] | select(.command | test("animal-busy.pid"))' ~/.claude/settings.json >/dev/null && echo "✓ spawn hook present"
jq -e '.hooks.Stop[].hooks[] | select(.command | test("animal-busy.pid"))' ~/.claude/settings.json >/dev/null && echo "✓ kill hook present"
```

### 8. Hand-off

Tell the user:

> Installed. Open `/hooks` once to reload settings (Claude Code caches
> settings.json at session start, so mid-session changes need a reload). Then
> send any test message — a running **[character]** should appear along the
> **[position]** edge and disappear when the response completes.
>
> To change settings later, edit `~/.claude/animal-busy-config.json` (or re-run
> `/install-animal-busy-indicator`). To remove: `/uninstall-animal-busy-indicator`.

## Notes for the model

- The hook command must be a single line in the JSON `command` field. Don't
  pretty-print it across lines.
- Tilde `~` is used unquoted in the hook command (`~/.claude/animal-busy/...`) so
  the shell expands it. Keep it unquoted there.
- `ELECTRON_DISABLE_SANDBOX=1` is required on most Linux/WSL2 setups — Electron's
  sandbox needs kernel features WSL often lacks. Keep it in the spawn hook.
- npm install MUST run inside `overlay/` (that's where `package.json` lives and
  where `animal-busy.js` resolves the electron binary).
- The overlay window is frameless, click-through (`setIgnoreMouseEvents`), and
  `alwaysOnTop`. It never steals focus.
- If the user is on macOS or native Linux without WSLg, Electron still works as
  long as a display is available — but this skill assumes Linux paths.
