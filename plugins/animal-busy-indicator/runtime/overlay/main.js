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

app.whenReady().then(() => {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  // 오버레이 띠 높이/너비 계산
  const STRIP = config.size + 20;
  let winX = 0, winY = 0, winW = width, winH = STRIP;
  if (config.position === 'top')    { winY = 0; }
  if (config.position === 'bottom') { winY = height - STRIP; }
  if (config.position === 'left')   { winW = STRIP; winH = height; winX = 0; winY = 0; }
  if (config.position === 'right')  { winW = STRIP; winH = height; winX = width - STRIP; winY = 0; }

  const win = new BrowserWindow({
    x: winX, y: winY,
    width: winW, height: winH,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      additionalArguments: [
        `--config=${JSON.stringify(config)}`,
        `--winW=${winW}`,
        `--winH=${winH}`,
      ]
    }
  });

  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(__dirname, 'overlay.html'));

  // PID 저장
  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));

  // SIGTERM 수신 시 정상 종료
  process.on('SIGTERM', () => {
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
