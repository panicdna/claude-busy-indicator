# claude-busy-indicator

A [Claude Code](https://docs.claude.com/en/docs/claude-code) plugin marketplace of **desktop busy indicators** — a glanceable signal that Claude is working when its terminal isn't in focus.

Pick whichever style you like:

| Plugin | Indicator | Best when |
|--------|-----------|-----------|
| **`busy-indicator`** | A small looped `mpv` video window | You want a simple, dependency-light pop-up (just `mpv`) |
| **`animal-busy-indicator`** | A transparent pixel-art animal running across a screen edge | You want something playful and unobtrusive (needs Node + Electron) |

Maintained by [@panicdna](https://github.com/panicdna). Both require a working display (WSL2/WSLg or any Linux X display) and `jq`.

---

## How installation works

Installation is **two layers**, and `install` / `uninstall` are **separate command sets** — each plugin ships its own pair.

**1. Add the marketplace — once.** A single marketplace holds *both* plugins, so you run this one time no matter how many plugins you install:

```
/plugin marketplace add panicdna/claude-busy-indicator
```

**2. Then, per plugin, two steps:**

- `/plugin install <plugin>` — fetches the plugin's skills into your environment (this alone does **not** start any indicator).
- `/install-<plugin>` — the skill that actually writes the hooks into `~/.claude/settings.json` and turns the indicator on.

**Removal is the reverse order:**

- `/uninstall-<plugin>` — removes this plugin's hooks from `settings.json`.
- `/plugin uninstall <plugin>` — removes the plugin package.

> ⚠️ Always run `/uninstall-<plugin>` **before** `/plugin uninstall`. If you remove the plugin first, its hooks linger in `settings.json` as "ghost hooks" — the command still fires on every prompt but the skill it points to is gone.

| Plugin | Plugin layer (`/plugin …`) | Setup skill | Teardown skill |
|--------|---------------------------|-------------|----------------|
| `busy-indicator` | `install busy-indicator` / `uninstall busy-indicator` | `/install-busy-indicator` | `/uninstall-busy-indicator` |
| `animal-busy-indicator` | `install animal-busy-indicator` / `uninstall animal-busy-indicator` | `/install-animal-busy-indicator` | `/uninstall-animal-busy-indicator` |

The two plugins are independent and can be installed side by side — their hooks use disjoint signatures (`claude-busy.pid` vs `animal-busy`), so each uninstall only removes its own.

---

## `busy-indicator` — mpv video window

A small `mpv` window pops up while Claude processes your prompt and closes the moment Claude finishes.

| Skill | Trigger | Behavior |
|-------|---------|----------|
| `install-busy-indicator` | `/install-busy-indicator` | Environment check → video cache → settings.json hook merge → pipe-test → reload guidance |
| `uninstall-busy-indicator` | `/uninstall-busy-indicator` | Kill running mpv → remove only our hooks → optional cache delete → reload guidance |

Hooks: `UserPromptSubmit` spawns mpv (looped, muted) at a configurable geometry; `Stop` kills it via a PID file. Both are idempotent and keyed on the unique `claude-busy.pid` substring, so uninstall never touches unrelated hooks.

**Install:**

```
/plugin marketplace add panicdna/claude-busy-indicator   # one-time; skip if already added
/plugin install busy-indicator
/install-busy-indicator
```

The install skill asks which video and window size you want, then merges the hooks. Open `/hooks` once to reload.

**Requirements:** `mpv` + `ffmpeg` (`sudo apt install -y mpv ffmpeg`), `jq`.

**Remove:** `/uninstall-busy-indicator` then `/plugin uninstall busy-indicator`. It asks before deleting the cached video (up to ~557 MB for the Tears of Steel option).

---

## `animal-busy-indicator` — pixel-art animal overlay

A transparent Electron overlay draws a running pixel-art animal across a screen-edge strip while Claude works, then vanishes when the response completes. Pure `<canvas>` sprites (no image assets) with footstep particles and occasional thought bubbles. Spans **every monitor** — one strip per display, all driven by a single process.

| Skill | Trigger | Behavior |
|-------|---------|----------|
| `install-animal-busy-indicator` | `/install-animal-busy-indicator` | Pre-flight → copy runtime → `npm install` electron → **interactive config** → smoke test → settings.json hook merge → reload guidance |
| `uninstall-animal-busy-indicator` | `/uninstall-animal-busy-indicator` | Kill overlay → remove only our hooks → optional file delete → reload guidance |

The install is **interactive** — it asks you (via Claude's question UI) for:

| Setting | Options | Default |
|---------|---------|---------|
| Character | cat / dog / fox / rabbit | cat |
| Position | bottom / top / left / right | bottom |
| Size | 32 / 48 / 64 / 96 px | 64 |
| Speed | 1 / 3 / 5 / 8 | 3 |
| Theme | transparent / dark | transparent |

Hooks: `UserPromptSubmit` spawns the Electron overlay (`ELECTRON_DISABLE_SANDBOX=1 node ~/.claude/animal-busy/animal-busy.js start`); `Stop` kills it by PID. Both are keyed on the `animal-busy` substring, so they coexist cleanly with the mpv `busy-indicator` plugin and uninstall removes only their own hooks.

**Install:**

```
/plugin marketplace add panicdna/claude-busy-indicator   # one-time; skip if already added
/plugin install animal-busy-indicator
/install-animal-busy-indicator
```

Re-run `/install-animal-busy-indicator` any time to reconfigure — it skips the Electron download and just rewrites the config.

**Requirements:** Node.js ≥ 18 + npm (`sudo apt install -y nodejs npm`), `jq`. First install downloads Electron (~100 MB).

**Remove:** `/uninstall-animal-busy-indicator` then `/plugin uninstall animal-busy-indicator`. It asks before deleting `~/.claude/animal-busy/` (the Electron install).

---

## Repository structure

```
claude-busy-indicator/
├── .claude-plugin/
│   └── marketplace.json                        # Marketplace manifest (cataloged plugins)
├── plugins/
│   ├── busy-indicator/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/
│   │       ├── install-busy-indicator/SKILL.md
│   │       └── uninstall-busy-indicator/SKILL.md
│   └── animal-busy-indicator/
│       ├── .claude-plugin/plugin.json
│       ├── runtime/                            # copied to ~/.claude/animal-busy/ on install
│       │   ├── animal-busy.js                  # start|stop entry point (hooks call this)
│       │   ├── package.json                    # electron dependency
│       │   └── overlay/
│       │       ├── main.js                     # Electron main: transparent always-on-top strip
│       │       └── overlay.html                # canvas renderer + pixel-art sprites
│       └── skills/
│           ├── install-animal-busy-indicator/SKILL.md
│           └── uninstall-animal-busy-indicator/SKILL.md
├── README.md
└── LICENSE
```

## Design notes

- **Idempotent installs** — re-running an install skill reconfigures in place (different video/geometry, or different animal/position/size/speed/theme) without uninstalling first.
- **Verify before writing settings** — `busy-indicator` pipe-tests mpv standalone; `animal-busy-indicator` runs a ~3s smoke test of the overlay. Neither touches `settings.json` until the runtime is proven to work.
- **Disjoint detection signatures** — `busy-indicator` hooks contain `claude-busy.pid`; `animal-busy-indicator` hooks contain `animal-busy`. Each uninstall surgically removes only its own hooks, so the two plugins can be installed side by side.
- **Cleanup is opt-in** — uninstall always asks before deleting cached video / the Electron install.

## License

MIT — see [LICENSE](./LICENSE).
