const { app, BrowserWindow, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const PID_FILE = path.join(require('os').homedir(), '.claude', 'animal-busy.pid');

// CLI 인자: start | stop
const command = process.argv[2];

if (command === 'stop') {
  // PID 파일 읽어서 프로세스 종료
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_FILE);
    console.log(`Stopped PID ${pid}`);
  } catch (e) {
    // 이미 종료됐거나 PID 없음 — 조용히 무시
  }
  process.exit(0);
}

// ── start 모드 ────────────────────────────────────────────────
// 설정 읽기 (없으면 기본값)
const CONFIG_FILE = path.join(require('os').homedir(), '.claude', 'animal-busy-config.json');
let config = {
  character: 'cat',       // cat | dog | fox | rabbit
  position: 'bottom',     // bottom | top | left | right
  size: 64,               // 픽셀 크기
  speed: 3,               // 이동 속도
  theme: 'transparent',   // transparent | dark
};
try {
  Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
} catch (_) {}

// Build one overlay strip for a single monitor's bounds.
function makeWindow(bounds) {
  const STRIP = config.size + 20;
  let winX, winY, winW, winH;
  if (config.position === 'top')         { winX = bounds.x; winY = bounds.y;                          winW = bounds.width; winH = STRIP; }
  else if (config.position === 'bottom') { winX = bounds.x; winY = bounds.y + bounds.height - STRIP;  winW = bounds.width; winH = STRIP; }
  else if (config.position === 'left')   { winX = bounds.x; winY = bounds.y; winW = STRIP; winH = bounds.height; }
  else if (config.position === 'right')  { winX = bounds.x + bounds.width - STRIP; winY = bounds.y; winW = STRIP; winH = bounds.height; }
  else { winX = bounds.x; winY = bounds.y + bounds.height - STRIP; winW = bounds.width; winH = STRIP; }

  // WSLg/Weston does not composite transparent frameless windows — content
  // renders invisible. The 'dark' theme uses a real OPAQUE window so it shows
  // on WSL2; 'transparent' keeps the see-through strip where the compositor
  // supports it.
  const isDark = config.theme === 'dark';
  const win = new BrowserWindow({
    x: winX, y: winY,
    width: winW, height: winH,
    transparent: !isDark,
    backgroundColor: isDark ? '#11141a' : '#00000000',
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    enableLargerThanScreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });
  win.setIgnoreMouseEvents(true);
  // Pass config + this monitor's strip size via the URL query.
  win.loadFile(path.join(__dirname, 'overlay.html'), {
    search: 'config=' + encodeURIComponent(JSON.stringify(config)) + `&winW=${winW}&winH=${winH}`,
  });
  return win;
}

app.whenReady().then(() => {
  // One overlay per monitor — the animal runs on every display. Uses each
  // display's full bounds (edge-to-edge), not workArea.
  const wins = screen.getAllDisplays().map(d => makeWindow(d.bounds));
  console.log(`[animal-busy] ${wins.length} overlay window(s) across ${wins.length} display(s)`);

  // One process owns all windows → a single PID controls them all.
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));

  process.on('SIGTERM', () => {
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
