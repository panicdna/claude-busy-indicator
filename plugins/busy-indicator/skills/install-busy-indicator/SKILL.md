---
name: install-busy-indicator
description: >-
  Install a desktop video busy indicator for Claude Code on WSL2/WSLg. Adds
  UserPromptSubmit + Stop hooks to ~/.claude/settings.json that spawn mpv in a
  small window while Claude is working and close it when done. Caches the video
  locally so subsequent prompts spawn instantly. Idempotent — re-run to
  reconfigure (change video, geometry, position). Use when the user asks for a
  "busy indicator", "spinner window", "show when Claude is working", or wants
  the mpv hook setup pattern.
metadata:
  author: panicdna
  version: 1.0.0
  category: hooks
  tags: [hooks, wsl, wslg, mpv, busy-indicator]
---

# Install Busy Indicator

Set up a desktop visual indicator: a small mpv window plays a looped video
while Claude is processing, and is killed when Claude finishes. WSL2 with WSLg
required.

## Pre-flight checks

Run all in one Bash call:

```bash
echo "=== WSLg ==="; ls /mnt/wslg/.X11-unix >/dev/null 2>&1 && echo OK || echo MISSING
echo "=== DISPLAY ==="; echo "${DISPLAY:-unset}"
echo "=== mpv ==="; command -v mpv || echo MISSING
echo "=== ffprobe ==="; command -v ffprobe || echo "MISSING (optional)"
echo "=== jq ==="; command -v jq || echo MISSING
```

If `mpv` is MISSING, stop and tell the user:
> Please run `! sudo apt install -y mpv ffmpeg` (you can't sudo from here),
> then retry `/install-busy-indicator`.

If WSLg or DISPLAY is missing, stop — this skill needs a working GUI display.

## Detect existing installation

```bash
jq -e '.hooks.UserPromptSubmit[]?.hooks[]? | select(.command | test("claude-busy.pid"))' ~/.claude/settings.json >/dev/null 2>&1 && echo "EXISTS" || echo "FRESH"
```

If EXISTS, ask the user:
> Busy indicator is already installed. Reconfigure with new settings?

If they decline, exit without changes.

## Gather parameters

Unless the user specified in their request, use `AskUserQuestion` (each as a
separate single-select question):

**1. Video source**
- "Small sample (Big Buck Bunny, ~1 MB, 10s loop)" — recommended default
- "Tears of Steel 1080p (~557 MB, 12 min cinematic widescreen)"
- "Custom URL" (then ask for URL)
- "Local file path" (then ask for absolute path)

**2. Window size**
- "Small 320×180" (16:9)
- "Cinematic widescreen 640×267" (2.4:1) — recommended default
- "Large cinematic 1280×534" (2.4:1)
- "Custom W×H" (then ask)

**3. Position offset**: skip asking; default to `+20+20` (top-left, 20px in).
Only prompt if user previously asked for something specific.

For custom URL: run `curl -sI -L "$URL"` to read `Content-Length`. If > 100 MB,
confirm with user before proceeding.

## Steps

### 1. Prepare directories

```bash
mkdir -p ~/.claude/assets ~/.cache
```

### 2. Cache the video

If `~/.claude/assets/busy.mp4` exists and its size matches the URL's
`Content-Length` (or the user chose the same video as last time), skip
download. Otherwise:

```bash
curl -L --fail -o ~/.claude/assets/busy.mp4 "$VIDEO_URL"
```

For local file: copy or symlink to `~/.claude/assets/busy.mp4`.

```bash
cp "$LOCAL_PATH" ~/.claude/assets/busy.mp4
# OR
ln -sf "$LOCAL_PATH" ~/.claude/assets/busy.mp4
```

### 3. Verify the file

```bash
ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ~/.claude/assets/busy.mp4
```

If duration is empty or 0, the file is corrupt — stop and tell user.

### 4. Compose hook commands

Substitute `<W>`, `<H>`, `<X>`, `<Y>` with chosen values (e.g. `640`, `267`,
`20`, `20`).

**Spawn** (UserPromptSubmit):
```
PID_FILE=~/.cache/claude-busy.pid; if [ ! -f "$PID_FILE" ] || ! kill -0 "$(cat "$PID_FILE" 2>/dev/null)" 2>/dev/null; then DISPLAY=:0 mpv --loop-file=inf --mute=yes --geometry=<W>x<H>+<X>+<Y> --no-osc ~/.claude/assets/busy.mp4 >/dev/null 2>&1 & echo $! > "$PID_FILE"; fi
```

**Kill** (Stop):
```
PID_FILE=~/.cache/claude-busy.pid; [ -f "$PID_FILE" ] && kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"; true
```

### 5. Pipe-test before writing settings

Verify spawn/kill work standalone. This catches "command looks right but fails
in this environment" issues before they reach settings.json.

```bash
# Clean any leftover state
pkill -x mpv 2>/dev/null; rm -f ~/.cache/claude-busy.pid; sleep 1

# Test spawn
echo '{}' | bash -c "$SPAWN_CMD"
sleep 1
if [ -f ~/.cache/claude-busy.pid ] && kill -0 "$(cat ~/.cache/claude-busy.pid)" 2>/dev/null; then
  echo "✓ spawn OK"
else
  echo "✗ spawn failed"; exit 1
fi

# Test kill
echo '{}' | bash -c "$KILL_CMD"
sleep 1
if [ ! -f ~/.cache/claude-busy.pid ] && ! pgrep -x mpv >/dev/null; then
  echo "✓ kill OK"
else
  echo "✗ kill failed"; pkill -x mpv 2>/dev/null
fi
```

If any test fails, stop and report the failure — do not write to settings.json.

### 6. Merge into ~/.claude/settings.json

Use `jq` to add hooks while preserving any other existing settings/hooks.
Existing busy-indicator hooks (detected by `claude-busy.pid` substring) are
replaced.

```bash
SPAWN_CMD='<the spawn command>'
KILL_CMD='<the kill command>'

jq --arg spawn "$SPAWN_CMD" --arg kill "$KILL_CMD" '
  .hooks //= {}
  | .hooks.UserPromptSubmit = (
      (.hooks.UserPromptSubmit // [])
      | map(.hooks |= map(select(.command | test("claude-busy.pid") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $spawn}]}]
  | .hooks.Stop = (
      (.hooks.Stop // [])
      | map(.hooks |= map(select(.command | test("claude-busy.pid") | not)))
      | map(select(.hooks | length > 0))
    ) + [{"hooks": [{"type": "command", "command": $kill}]}]
' ~/.claude/settings.json > /tmp/settings.new && mv /tmp/settings.new ~/.claude/settings.json
```

If `~/.claude/settings.json` doesn't exist, create it with `{}` first:
```bash
[ -f ~/.claude/settings.json ] || echo '{}' > ~/.claude/settings.json
```

### 7. Validate

```bash
jq empty ~/.claude/settings.json && echo "✓ JSON valid"
jq -e '.hooks.UserPromptSubmit[].hooks[] | select(.command | test("claude-busy.pid"))' ~/.claude/settings.json >/dev/null && echo "✓ spawn hook present"
jq -e '.hooks.Stop[].hooks[] | select(.command | test("claude-busy.pid"))' ~/.claude/settings.json >/dev/null && echo "✓ kill hook present"
```

### 8. Hand-off

Tell the user:

> Installed. Open `/hooks` once to reload settings (Claude Code caches
> settings.json at session start, so mid-session changes need a reload). Then
> send any test message — a video window should appear at top-left and
> disappear when the response completes.
>
> To remove: invoke `/uninstall-busy-indicator`.

## Notes for the model

- Do NOT use `pkill -x mpv` in hook commands — it would kill any mpv the user
  launched manually. Always use the PID file.
- The hook command must be a single line in the JSON `command` field. Don't
  pretty-print it across lines.
- Tilde `~` inside double-quoted bash strings does NOT expand. The hook command
  uses unquoted `~/.cache/claude-busy.pid` and `~/.claude/assets/busy.mp4`,
  which IS expanded — keep it that way.
- WSLg sets both `DISPLAY=:0` (XWayland) and `WAYLAND_DISPLAY=wayland-0`. The
  hook explicitly sets `DISPLAY=:0` because hook environments may not inherit
  the user shell's env.
- If the user is on macOS or native Linux, this skill won't fit out of the box.
  Future work: add platform detection and fall back to native commands.
