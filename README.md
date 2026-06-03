# claude-busy-indicator

A [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin marketplace
of **desktop busy indicators** — a glanceable on-screen signal that Claude is
working, useful when Claude Code runs in a terminal that isn't in focus.

Two plugins to choose from:

| Plugin | What appears | Runtime | Best for |
|--------|--------------|---------|----------|
| **`busy-indicator`** | A small looped video window | `mpv` (WSL2/WSLg) | Lightest setup; no Node build step |
| **`animal-busy-indicator`** | A pixel-art animal running along a screen edge | Electron (transparent overlay) | Playful, click-through overlay; configurable character/position |

Maintained by [@panicdna](https://github.com/panicdna).

## Quick start

Inside a Claude Code session, add the marketplace once:

```
/plugin marketplace add panicdna/claude-busy-indicator
```

Then install **one** of the plugins (or both — they use independent hooks and
detection signatures, so they don't collide):

```
/plugin install busy-indicator
# or
/plugin install animal-busy-indicator
```

Finally, run the matching install skill once to wire up the hooks:

```
/install-busy-indicator
# or
/install-animal-busy-indicator
```

Both install skills run pre-flight checks, ask for your preferences, smoke-test
the indicator standalone, then merge hooks into `~/.claude/settings.json`. Open
`/hooks` once afterward to reload settings, and you're done.

---

## Plugin: `busy-indicator` (mpv video)

A small `mpv` window plays a looped, muted video while Claude is processing, and
closes the moment Claude finishes.

| Skill | Trigger | Behavior |
|-------|---------|----------|
| `install-busy-indicator` | `/install-busy-indicator` | Environment check → video cache → settings.json hook merge → pipe-test → reload guidance |
| `uninstall-busy-indicator` | `/uninstall-busy-indicator` | Kill running mpv → remove only our hooks → optional cache delete → reload guidance |

Hooks installed:
- `UserPromptSubmit` — spawns mpv (looped, muted) at a configurable geometry
- `Stop` — kills the spawned mpv via a PID file

Both hooks are idempotent and detected by a unique `claude-busy.pid` substring,
so uninstall never touches unrelated hooks.

**Requirements**
- **WSL2 with WSLg** (or any Linux with a working X display)
- `mpv` and `ffmpeg` — `sudo apt install -y mpv ffmpeg`
- `jq` — used to safely merge into `settings.json`

**Install / remove**
```
/install-busy-indicator      # set up
/uninstall-busy-indicator    # tear down (asks before deleting the cached video)
/plugin uninstall busy-indicator
```

---

## Plugin: `animal-busy-indicator` (pixel-art Electron overlay)

A frameless, transparent, click-through Electron window shows a running pixel-art
animal along a screen edge while Claude works, and is killed when Claude
finishes.

| Skill | Trigger | Behavior |
|-------|---------|----------|
| `install-animal-busy-indicator` | `/install-animal-busy-indicator` | Environment check → copy bundled overlay + `npm install electron` → config → smoke test → settings.json hook merge → reload guidance |
| `uninstall-animal-busy-indicator` | `/uninstall-animal-busy-indicator` | Kill running overlay → remove only our hooks → optional file delete → reload guidance |

Hooks installed (both carry a unique `animal-busy.pid` detection signature):
- `UserPromptSubmit` — `node ~/.claude/animal-busy/animal-busy.js start`
- `Stop` — `node ~/.claude/animal-busy/animal-busy.js stop`

**Configurable** (asked at install, stored in `~/.claude/animal-busy-config.json`):

| Setting | Options | Default |
|---|---|---|
| Character | cat / dog / fox / rabbit | cat |
| Position | bottom / top / left / right | bottom |
| Size (px) | 32 / 48 / 64 / 96 | 64 |
| Speed | 1–8 | 3 |
| Theme | transparent / dark | transparent |

Edit that JSON file and the next prompt picks up the change — no reinstall
needed.

**Requirements**
- A working GUI display: **WSL2 with WSLg**, or native Linux with X/Wayland
- **Node.js ≥ 18** and **npm** — `sudo apt install -y nodejs npm`
- `jq` — used to safely merge into `settings.json`
- The first install runs `npm install electron` (~100 MB download)

**Install / remove**
```
/install-animal-busy-indicator     # set up (downloads Electron the first time)
/uninstall-animal-busy-indicator   # tear down (asks before deleting the Electron app)
/plugin uninstall animal-busy-indicator
```

---

## Update later

```
/plugin update busy-indicator
/plugin update animal-busy-indicator
```

## Repository structure

```
claude-busy-indicator/
├── .claude-plugin/
│   └── marketplace.json                          # Marketplace manifest (both plugins cataloged)
├── plugins/
│   ├── busy-indicator/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/
│   │       ├── install-busy-indicator/SKILL.md
│   │       └── uninstall-busy-indicator/SKILL.md
│   └── animal-busy-indicator/
│       ├── .claude-plugin/plugin.json
│       ├── animal-busy.js                         # Hook entry point (spawn/stop Electron)
│       ├── overlay/                               # Electron overlay app
│       │   ├── main.js                            # Frameless transparent window
│       │   ├── overlay.html                       # Pixel-art animal canvas renderer
│       │   └── package.json                       # electron dependency
│       └── skills/
│           ├── install-animal-busy-indicator/SKILL.md
│           └── uninstall-animal-busy-indicator/SKILL.md
├── README.md
└── LICENSE
```

## Design notes

- **Idempotent install** — re-running an install skill reconfigures (different
  video / character / size / position) without needing to uninstall first.
- **Smoke-test before writing settings** — each install spawns and kills the
  indicator standalone before touching `settings.json`, so you never end up with
  a broken hook config.
- **Surgical detection signatures** — `busy-indicator` hooks all contain
  `claude-busy.pid`; `animal-busy-indicator` hooks all contain `animal-busy.pid`.
  Uninstall uses these to remove only that plugin's hooks, and the two plugins
  can be installed side by side without interfering.
- **Cleanup is opt-in** — uninstall always asks before deleting the cached video
  (busy-indicator) or the installed Electron app (animal-busy-indicator).

## License

MIT — see [LICENSE](./LICENSE).
