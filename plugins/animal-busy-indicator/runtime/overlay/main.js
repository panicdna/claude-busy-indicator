const { app, BrowserWindow, screen } = require('electron');
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const PID_FILE = path.join(require('os').homedir(), '.claude', 'animal-busy.pid');

const command = process.argv[2];

if (command === 'stop') {
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    process.kill(pid, 'SIGTERM');
    fs.unlinkSync(PID_FILE);
    console.log(`[animal-busy] stopped PID ${pid}`);
  } catch (e) {}
  process.exit(0);
}

// ── start 모드 ────────────────────────────────────────────────
const CONFIG_FILE = path.join(require('os').homedir(), '.claude', 'animal-busy-config.json');
let config = {
  character: 'rabbit',
  position: 'top',
  size: 64,
  speed: 3,
  theme: 'dark',
};
try {
  Object.assign(config, JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
} catch (_) {}

// Query Windows monitor layout via PowerShell, then translate to X virtual
// screen coordinates. Falls back to Electron's getAllDisplays() when
// PowerShell is unavailable (native Linux).
function getDisplayBounds() {
  try {
    const ps = `Add-Type -AssemblyName System.Windows.Forms;
[System.Windows.Forms.Screen]::AllScreens |
ForEach-Object { "$($_.Bounds.X),$($_.Bounds.Y),$($_.Bounds.Width),$($_.Bounds.Height)" }`;
    const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], {
      timeout: 3000,
      encoding: 'utf8',
    }).trim();

    const monitors = out.split('\n')
      .map(l => l.trim()).filter(Boolean)
      .map(l => {
        const [x, y, w, h] = l.split(',').map(Number);
        return { x, y, width: w, height: h };
      });

    if (!monitors.length) throw new Error('empty');

    // Compute bounding box origin — that's where X puts (0,0).
    const originX = Math.min(...monitors.map(m => m.x));
    const originY = Math.min(...monitors.map(m => m.y));

    return monitors.map(m => ({
      x: m.x - originX,
      y: m.y - originY,
      width: m.width,
      height: m.height,
    }));
  } catch (_) {
    // PowerShell not available — use Electron's own display list.
    return screen.getAllDisplays().map(d => d.bounds);
  }
}

function makeWindow(bounds) {
  const STRIP = config.size + 20;
  let winX, winY, winW, winH;
  if (config.position === 'top')         { winX = bounds.x; winY = bounds.y;                          winW = bounds.width; winH = STRIP; }
  else if (config.position === 'bottom') { winX = bounds.x; winY = bounds.y + bounds.height - STRIP;  winW = bounds.width; winH = STRIP; }
  else if (config.position === 'left')   { winX = bounds.x; winY = bounds.y; winW = STRIP; winH = bounds.height; }
  else if (config.position === 'right')  { winX = bounds.x + bounds.width - STRIP; winY = bounds.y; winW = STRIP; winH = bounds.height; }
  else { winX = bounds.x; winY = bounds.y + bounds.height - STRIP; winW = bounds.width; winH = STRIP; }

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
  win.loadFile(path.join(__dirname, 'overlay.html'), {
    search: 'config=' + encodeURIComponent(JSON.stringify(config)) + `&winW=${winW}&winH=${winH}`,
  });
  return win;
}

app.whenReady().then(() => {
  const displays = getDisplayBounds();
  const wins = displays.map(b => makeWindow(b));
  console.log(`[animal-busy] started (PID ${process.pid}), ${wins.length} display(s)`);

  fs.mkdirSync(path.dirname(PID_FILE), { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));

  process.on('SIGTERM', () => {
    try { fs.unlinkSync(PID_FILE); } catch (_) {}
    app.quit();
  });
});

app.on('window-all-closed', () => app.quit());
