#!/usr/bin/env node
/**
 * animal-busy.js  <start|stop>
 *
 * Entry point invoked from Claude Code hooks.
 * Spawns the Electron overlay detached on `start`, or kills it by PID on `stop`.
 *
 * Layout once installed (see install-animal-busy-indicator skill):
 *   ~/.claude/animal-busy/
 *     ├── animal-busy.js        ← this file (__dirname = install root)
 *     ├── package.json
 *     ├── node_modules/.bin/electron
 *     └── overlay/{main.js,overlay.html}
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const ROOT        = __dirname;                              // install root
const OVERLAY_DIR = path.join(ROOT, 'overlay');
const PID_FILE    = path.join(os.homedir(), '.claude', 'animal-busy.pid');
const command     = process.argv[2];

// Resolve the electron binary: prefer the locally installed one, fall back to global.
function getElectron() {
  const local = path.join(ROOT, 'node_modules', '.bin', 'electron');
  if (fs.existsSync(local)) return local;
  try { return require.resolve('electron').replace(/index\.js$/, 'dist/electron'); } catch (_) {}
  try { return execSync('which electron', { encoding: 'utf8' }).trim(); } catch (_) {}
  return null;
}

if (command === 'stop') {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
    process.kill(pid, 'SIGTERM');
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
    console.log(`[animal-busy] stopped PID ${pid}`);
  } catch (_) {
    // already gone — nothing to do
  }
  process.exit(0);
}

// ── start ─────────────────────────────────────────────────────
const electronBin = getElectron();
if (!electronBin) {
  console.error('[animal-busy] electron not found. Run `npm install` in ' + ROOT);
  process.exit(1);
}

const child = spawn(electronBin, [path.join(OVERLAY_DIR, 'main.js'), 'start'], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
});
child.unref();

// Give main.js a moment to write the PID file, then confirm.
setTimeout(() => {
  if (fs.existsSync(PID_FILE)) {
    console.log(`[animal-busy] started (PID ${fs.readFileSync(PID_FILE, 'utf8').trim()})`);
  }
}, 600);
