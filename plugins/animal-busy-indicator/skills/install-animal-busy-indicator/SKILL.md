---
name: install-animal-busy-indicator
description: >
  Install a transparent pixel-art animal overlay that runs while Claude Code is
  busy. A running animal (cat/dog/fox/rabbit) crosses a screen-edge strip via an
  Electron window, driven by UserPromptSubmit + Stop hooks. Interactively asks
  for character, position, size, speed, and theme. Use when the user runs
  /install-animal-busy-indicator or asks to install/set up the animal busy
  indicator. Idempotent — re-run to reconfigure.
---

# Install Animal Busy Indicator

A transparent Electron overlay that shows a running pixel-art animal while
Claude Code is processing. Spawns on the `UserPromptSubmit` hook and is killed
on the `Stop` hook via a PID file.

`${CLAUDE_PLUGIN_ROOT}` is the absolute path to this plugin, injected by Claude
Code. The bundled runtime lives at `${CLAUDE_PLUGIN_ROOT}/runtime/`.

## Pre-flight checks

Run all in one Bash call. Report any failure and what to fix before continuing.

```bash
echo "=== node ===";    node --version 2>/dev/null || echo MISSING
echo "=== npm ===";     npm --version  2>/dev/null || echo MISSING
echo "=== jq ===";      command -v jq  || echo MISSING
echo "=== display ==="; echo "DISPLAY=${DISPLAY:-unset}  WAYLAND=${WAYLAND_DISPLAY:-unset}"
echo "=== existing ==="; [ -f ~/.claude/animal-busy.pid ] && echo "RUNNING" || echo "not running"
echo "=== plugin root ==="; ls "${CLAUDE_PLUGIN_ROOT}/runtime" 2>/dev/null || echo "runtime MISSING"
```

- If `node`/`npm` MISSING → tell the user to run `! sudo apt install -y nodejs npm`, then retry.
- If `jq` MISSING → `! sudo apt install -y jq`.
- If both `DISPLAY` and `WAYLAND` are unset → stop; this needs a GUI display
  (on WSL2 ensure WSLg is enabled with `wsl --update`).

## Step 1 — Copy runtime into place

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
mkdir -p "$INSTALL_DIR"
cp -r "${CLAUDE_PLUGIN_ROOT}/runtime/." "$INSTALL_DIR/"
ls "$INSTALL_DIR" "$INSTALL_DIR/overlay"
```

## Step 2 — Install Electron

First-run only; downloads ~100 MB. Skip if `node_modules/.bin/electron` already
exists (idempotent reconfigure).

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
if [ -x "$INSTALL_DIR/node_modules/.bin/electron" ]; then
  echo "electron already installed — skipping"
else
  ( cd "$INSTALL_DIR" && npm install 2>&1 | tail -5 ); echo "npm exit: $?"
fi
```

## Step 3 — Ask for configuration (INTERACTIVE)

Use the `AskUserQuestion` tool to ask these as separate single-select questions.
Do NOT just write defaults silently — the interactive prompt is the whole point.
If the user already stated preferences in their request, honor those and only
ask for the rest.

1. **Character** — `cat` (default) · `dog` · `fox` · `rabbit`
2. **Position** — `bottom` (default) · `top` · `left` · `right`
   (the animal runs left→right on bottom/top, top→bottom on left/right)
3. **Size** — `32` (small) · `48` · `64` (default) · `96` (large) px
4. **Speed** — `1` (slow) · `3` (default) · `5` · `8` (fast)
5. **Theme** — `transparent` (edge strip is see-through; native Linux/X11 only)
   · `dark` (an OPAQUE dark band behind the animal)
   ⚠️ **On WSL2/WSLg, transparent frameless windows are not composited and
   render fully invisible — recommend `dark` there.** If the pre-flight showed
   `WAYLAND=wayland-0` (WSLg), default to `dark` unless the user insists on
   transparent. The `dark` theme uses a real opaque window so it always shows.

Then write the config with the chosen values substituted:

```bash
cat > "$HOME/.claude/animal-busy-config.json" << CONF
{
  "character": "<character>",
  "position": "<position>",
  "size": <size>,
  "speed": <speed>,
  "theme": "<theme>"
}
CONF
echo "Config written:"; cat "$HOME/.claude/animal-busy-config.json"
```

`size` and `speed` are numbers — emit them WITHOUT quotes.

## Step 4 — Smoke test before writing hooks

Spawn the overlay standalone for ~3s, then stop it. This catches Electron/display
failures before they reach `settings.json`.

```bash
INSTALL_DIR="$HOME/.claude/animal-busy"
ELECTRON_DISABLE_SANDBOX=1 node "$INSTALL_DIR/animal-busy.js" start
sleep 3
if [ -f ~/.claude/animal-busy.pid ]; then echo "✓ spawn OK"; else echo "✗ spawn failed — check DISPLAY / electron"; fi
node "$INSTALL_DIR/animal-busy.js" stop
[ ! -f ~/.claude/animal-busy.pid ] && echo "✓ stop OK" || echo "✗ stop failed"
```

If spawn fails, do NOT proceed to Step 5 — report the failure (most common cause
on Linux is a missing display or the Electron sandbox; the hook already sets
`ELECTRON_DISABLE_SANDBOX=1`).

## Step 5 — Merge hooks into ~/.claude/settings.json

All hooks this plugin owns reference the path `animal-busy.js`, so the
`test("animal-busy")` filter removes only our hooks and never touches the mpv
`busy-indicator` plugin (whose hooks key off `claude-busy.pid`).

```bash
SETTINGS="$HOME/.claude/settings.json"
ANIMAL_JS="$HOME/.claude/animal-busy/animal-busy.js"
[ -f "$SETTINGS" ] || echo '{}' > "$SETTINGS"
cp "$SETTINGS" "$SETTINGS.bak" 2>/dev/null || true

SPAWN="ELECTRON_DISABLE_SANDBOX=1 node $ANIMAL_JS start"
KILL="node $ANIMAL_JS stop"

jq --arg spawn "$SPAWN" --arg kill "$KILL" '
  .hooks //= {}
  | .hooks.UserPromptSubmit = (
      (.hooks.UserPromptSubmit // [])
      | map(.hooks |= map(select(.command | test("animal-busy") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $spawn}]}]
  | .hooks.Stop = (
      (.hooks.Stop // [])
      | map(.hooks |= map(select(.command | test("animal-busy") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $kill}]}]
' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"

jq empty "$SETTINGS" && echo "✓ JSON valid"
jq -e '.hooks.UserPromptSubmit[].hooks[] | select(.command | test("animal-busy"))' "$SETTINGS" >/dev/null && echo "✓ spawn hook present"
jq -e '.hooks.Stop[].hooks[] | select(.command | test("animal-busy"))' "$SETTINGS" >/dev/null && echo "✓ kill hook present"
```

## Step 6 — Hand-off

Tell the user (substitute their chosen character):

> ✅ **Installed.** Open `/hooks` once to reload settings (Claude Code caches
> `settings.json` at session start). Then send any message — a running
> **<character>** will cross the **<position>** edge of your screen while Claude
> works, and vanish when the response completes.
>
> Reconfigure any time by re-running `/install-animal-busy-indicator`
> (it skips the Electron download and just rewrites the config).
>
> To remove: `/uninstall-animal-busy-indicator`.

## Notes for the model

- The spawn hook MUST keep `ELECTRON_DISABLE_SANDBOX=1` — Electron's sandbox
  fails under many WSL2/Linux hook environments.
- Do NOT use `pkill electron` anywhere — it would kill unrelated Electron apps.
  Stop is always via the PID file (`animal-busy.js stop`).
- The hook command relies on the shell expanding `~` in `$ANIMAL_JS`; keep the
  path unquoted at the point of expansion (it is baked as an absolute `$HOME`
  path here, so it is already expanded before reaching the hook).
- Size and speed are JSON numbers — never quote them in the config file.
