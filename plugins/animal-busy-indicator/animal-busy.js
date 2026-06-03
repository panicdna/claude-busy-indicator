#!/usr/bin/env node
/**
 * animal-busy.js  <start|stop>
 *
 * Claude Code hook에서 호출되는 진입점.
 * Electron 앱을 detached 로 실행하거나 PID로 종료한다.
 */

const { spawn, execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const PID_FILE    = path.join(os.homedir(), '.claude', 'animal-busy.pid');
const OVERLAY_DIR = path.join(__dirname, 'overlay');
const command     = process.argv[2];

// electron 바이너리 경로
function getElectron() {
  try { return require.resolve('electron').replace('index.js', 'dist/electron'); } catch (_) {}
  // node_modules/.bin/electron
  const local = path.join(OVERLAY_DIR, 'node_modules', '.bin', 'electron');
  if (fs.existsSync(local)) return local;
  // 글로벌 fallback
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
    // 이미 없음
  }
  process.exit(0);
}

// ── start ─────────────────────────────────────────────────────
const electronBin = getElectron();
if (!electronBin) {
  console.error('[animal-busy] electron을 찾을 수 없습니다. npm install 을 실행하세요.');
  process.exit(1);
}

const child = spawn(electronBin, [path.join(OVERLAY_DIR, 'main.js'), 'start'], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
});
child.unref();

// 잠깐 기다렸다가 PID 확인 (main.js 가 파일에 쓸 시간)
setTimeout(() => {
  if (fs.existsSync(PID_FILE)) {
    console.log(`[animal-busy] started (PID ${fs.readFileSync(PID_FILE,'utf8').trim()})`);
  }
}, 600);
