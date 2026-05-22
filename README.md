# claude-busy-indicator

A [Claude Code](https://docs.claude.com/en/docs/claude-code) skills marketplace that installs a **desktop video busy indicator** for Claude Code on WSL2 / WSLg.

A small `mpv` window pops up while Claude is processing your prompt, and closes the moment Claude finishes. Useful when Claude Code is running in a terminal that's not in focus and you want a glanceable signal that work is in progress.

Maintained by [@panicdna](https://github.com/panicdna).

## What it does

| Skill | Trigger | Behavior |
|-------|---------|----------|
| `install-busy-indicator` | `/install-busy-indicator` | Environment check → video cache → settings.json hook merge → pipe-test → reload guidance |
| `uninstall-busy-indicator` | `/uninstall-busy-indicator` | Kill running mpv → remove only our hooks → optional cache delete → reload guidance |

Hooks installed:
- `UserPromptSubmit` — spawns mpv (looped, muted) at a configurable geometry
- `Stop` — kills the spawned mpv via a PID file

Both hooks are idempotent and detected by a unique `claude-busy.pid` substring, so uninstall never touches unrelated hooks.

## Installation (for colleagues)

Inside a Claude Code session:

```
/plugin marketplace add panicdna/claude-busy-indicator
/plugin install busy-indicator
```

Then invoke the install skill once:

```
/install-busy-indicator
```

It will ask you which video to use, what window size you want, and merge the hooks into `~/.claude/settings.json`. Open `/hooks` once to reload settings, and you're done.

## Requirements

- **WSL2 with WSLg** (or any Linux with a working X display)
- `mpv` and `ffmpeg` — install via `sudo apt install -y mpv ffmpeg`
- `jq` — used to safely merge into `settings.json`

The install skill performs pre-flight checks for all of these and tells you exactly what to run if anything is missing.

## Removing

```
/uninstall-busy-indicator
/plugin uninstall busy-indicator
```

The uninstall skill leaves all other hooks/settings untouched. It will also ask before deleting the cached video (which can be up to ~557 MB for the Tears of Steel option).

## Update later

```
/plugin update busy-indicator
```

## Repository structure

```
claude-busy-indicator/
├── .claude-plugin/
│   └── marketplace.json                    # Marketplace manifest (cataloged plugins)
├── plugins/
│   └── busy-indicator/
│       ├── .claude-plugin/
│       │   └── plugin.json                 # Plugin manifest
│       └── skills/
│           ├── install-busy-indicator/
│           │   └── SKILL.md                # Install procedure Claude reads
│           └── uninstall-busy-indicator/
│               └── SKILL.md                # Uninstall procedure Claude reads
├── README.md
└── LICENSE
```

## Design notes

- **Idempotent install** — re-running `/install-busy-indicator` reconfigures (different video, size, position) without needing to uninstall first.
- **Pipe-test before writing settings** — the install skill spawns/kills mpv standalone before touching `settings.json`, so you don't end up with a broken hook config.
- **Detection signature** — every hook the plugin owns contains the string `claude-busy.pid`. Uninstall uses this to surgically remove only this plugin's hooks.
- **Cache deletion is opt-in** — uninstall always asks before deleting the cached video to avoid surprise re-downloads.

## License

MIT — see [LICENSE](./LICENSE).
