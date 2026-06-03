# claude-busy-indicator

Claude 가 작업 중일 때 — 특히 터미널이 포커스를 벗어나 있을 때 — 한눈에 알아챌 수 있게 해주는 **데스크톱 busy 인디케이터** [Claude Code](https://docs.claude.com/en/docs/claude-code) 플러그인 마켓플레이스입니다.

원하는 스타일을 고르세요:

| 플러그인 | 인디케이터 | 이럴 때 좋아요 |
|--------|-----------|-----------|
| **`busy-indicator`** | 작은 `mpv` 비디오 창 (루프 재생) | 단순하고 의존성 가벼운 팝업이 좋을 때 (`mpv` 만 필요) |
| **`animal-busy-indicator`** | 화면 가장자리를 달리는 투명 픽셀아트 동물 | 아기자기하고 거슬리지 않는 표시가 좋을 때 (Node + Electron 필요) |

관리: [@panicdna](https://github.com/panicdna). 둘 다 작동하는 디스플레이(WSL2/WSLg 또는 X 디스플레이가 있는 Linux)와 `jq` 가 필요합니다.

---

## 설치는 어떻게 동작하나

설치는 **두 개의 층**으로 나뉘며, `install` 과 `uninstall` 은 **각각 별개의 명령 세트**입니다 — 플러그인마다 자기 쌍을 가집니다.

**1. 마켓플레이스 등록 — 딱 한 번.** 마켓플레이스 하나가 *두 플러그인을 모두* 담고 있으므로, 몇 개를 설치하든 이 명령은 한 번만 실행하면 됩니다:

```
/plugin marketplace add panicdna/claude-busy-indicator
```

**2. 그다음, 플러그인마다 두 단계:**

- `/plugin install <plugin>` — 플러그인의 스킬을 내 환경으로 가져옵니다 (이것만으로는 인디케이터가 켜지지 **않습니다**).
- `/install-<plugin>` — `~/.claude/settings.json` 에 hook 을 실제로 작성하고 인디케이터를 켜는 스킬입니다.

**제거는 역순입니다:**

- `/uninstall-<plugin>` — 이 플러그인의 hook 을 `settings.json` 에서 제거합니다.
- `/plugin uninstall <plugin>` — 플러그인 패키지를 제거합니다.

> ⚠️ 반드시 `/uninstall-<plugin>` 을 `/plugin uninstall` **보다 먼저** 실행하세요. 플러그인을 먼저 지우면 hook 이 `settings.json` 에 "유령 hook" 으로 남습니다 — 매 프롬프트마다 명령은 실행되려 하는데 가리키는 스킬은 사라진 상태가 됩니다.

| 플러그인 | 플러그인 층 (`/plugin …`) | 설치 스킬 | 제거 스킬 |
|--------|---------------------------|-------------|----------------|
| `busy-indicator` | `install busy-indicator` / `uninstall busy-indicator` | `/install-busy-indicator` | `/uninstall-busy-indicator` |
| `animal-busy-indicator` | `install animal-busy-indicator` / `uninstall animal-busy-indicator` | `/install-animal-busy-indicator` | `/uninstall-animal-busy-indicator` |

두 플러그인은 서로 독립적이라 나란히 설치할 수 있습니다 — hook 시그니처가 서로 다르기 때문에(`claude-busy.pid` vs `animal-busy`), 각 제거는 자기 hook 만 지웁니다.

---

## `busy-indicator` — mpv 비디오 창

Claude 가 프롬프트를 처리하는 동안 작은 `mpv` 창이 떴다가, 응답이 끝나는 순간 닫힙니다.

| 스킬 | 트리거 | 동작 |
|-------|---------|------|
| `install-busy-indicator` | `/install-busy-indicator` | 환경 점검 → 비디오 캐시 → settings.json hook 병합 → pipe-test → 리로드 안내 |
| `uninstall-busy-indicator` | `/uninstall-busy-indicator` | 실행 중 mpv 종료 → 자기 hook 만 제거 → 캐시 삭제 선택 → 리로드 안내 |

Hook: `UserPromptSubmit` 가 설정한 geometry 로 mpv(루프, 음소거)를 띄우고, `Stop` 이 PID 파일로 종료합니다. 둘 다 멱등이며 고유 문자열 `claude-busy.pid` 로 식별되므로, 제거 시 무관한 hook 은 절대 건드리지 않습니다.

**설치:**

```
/plugin marketplace add panicdna/claude-busy-indicator   # 한 번만; 이미 등록했다면 생략
/plugin install busy-indicator
/install-busy-indicator
```

설치 스킬이 어떤 비디오와 창 크기를 쓸지 물어본 뒤 hook 을 병합합니다. `/hooks` 를 한 번 열었다 닫아 리로드하세요.

**요구사항:** `mpv` + `ffmpeg` (`sudo apt install -y mpv ffmpeg`), `jq`.

**제거:** `/uninstall-busy-indicator` 후 `/plugin uninstall busy-indicator`. 캐시된 비디오(Tears of Steel 선택 시 최대 ~557 MB)를 지우기 전에 물어봅니다.

### 트러블슈팅 — 흰 창만 뜨고 영상이 안 보임 (WSL2 + 외부 X 서버)

**증상:** mpv 창이 열리지만 영상 대신 흰 빈 창만 표시됩니다.

**원인:** `DISPLAY`가 WSLg(`DISPLAY=:0`)가 아닌 외부 X 서버(VcXsrv · X410 등, 예: `172.17.16.1:0`)를 가리킬 때 발생합니다. mpv 기본 렌더러(`gpu/opengl`)가 실패하고 SDL 폴백으로 전락하는데, 외부 X 서버에서 SDL OpenGL이 빈 흰 창만 그립니다. `mpv` 로그에서 아래 라인으로 확인할 수 있습니다.

```
[vo/gpu/opengl] Suspected software renderer or indirect context.
Xlib:  extension "XVideo" missing on display "172.17.16.1:0".
[vo/sdl] Warning: this legacy VO has bad performance.
```

**해결:** hook 명령에 `--vo=x11` 를 추가합니다. 순수 X11 렌더러는 OpenGL/XVideo 없이도 원격 X 서버에서 안정적으로 동작합니다.

`~/.claude/settings.json` 의 `UserPromptSubmit` hook 명령에서:

```
mpv --loop-file=inf ...
```

를 아래로 교체하세요:

```
mpv --vo=x11 --loop-file=inf ...
```

또는 `/install-busy-indicator` 를 다시 실행하면 — 설치 스킬이 `DISPLAY` 값을 보고 외부 X 서버 환경임을 감지해 `--vo=x11` 을 자동으로 추가합니다.

> 💡 **외부 X 서버 환경 판별:** `echo $DISPLAY` 가 `:0` 이 아닌 IP 주소(`172.x.x.x:0` 등)이면 외부 X 서버입니다.

---

## `animal-busy-indicator` — 픽셀아트 동물 오버레이

투명 Electron 오버레이가 화면 가장자리 띠 위로 달리는 픽셀아트 동물을 그리고, 응답이 끝나면 사라집니다. 이미지 에셋 없이 순수 `<canvas>` 스프라이트로 그려지며, 발자국 파티클과 가끔씩 생각 말풍선이 나옵니다. **모든 모니터에 걸쳐** 표시됩니다 — 디스플레이마다 띠 하나씩, 단일 프로세스가 모두 구동합니다.

| 스킬 | 트리거 | 동작 |
|-------|---------|------|
| `install-animal-busy-indicator` | `/install-animal-busy-indicator` | 사전 점검 → 런타임 복사 → electron `npm install` → **대화식 설정** → 스모크 테스트 → settings.json hook 병합 → 리로드 안내 |
| `uninstall-animal-busy-indicator` | `/uninstall-animal-busy-indicator` | 오버레이 종료 → 자기 hook 만 제거 → 파일 삭제 선택 → 리로드 안내 |

설치는 **대화식** 입니다 — Claude 의 질문 UI 로 다음을 물어봅니다:

| 설정 | 옵션 | 기본값 |
|---------|---------|---------|
| 캐릭터 | rabbit / cat / dog / fox | rabbit |
| 위치 | top / bottom / left / right | top |
| 크기 | 32 / 48 / 64 / 96 px | 64 |
| 속도 | 1 / 3 / 5 / 8 | 3 |
| 테마 | transparent / dark | transparent |

> 💡 **WSL2/WSLg 참고:** WSLg(Weston)는 투명 frameless 창을 합성하지 못해 통째로 안 보일 수 있습니다. WSL2 에서는 `dark` 테마(진짜 불투명 창)를 권장합니다.

Hook: `UserPromptSubmit` 가 Electron 오버레이를 띄우고(`ELECTRON_DISABLE_SANDBOX=1 node ~/.claude/animal-busy/animal-busy.js start`), `Stop` 이 PID 로 종료합니다. 둘 다 `animal-busy` 문자열로 식별되므로 mpv `busy-indicator` 플러그인과 깔끔하게 공존하고, 제거 시 자기 hook 만 지웁니다.

**설치:**

```
/plugin marketplace add panicdna/claude-busy-indicator   # 한 번만; 이미 등록했다면 생략
/plugin install animal-busy-indicator
/install-animal-busy-indicator
```

재설정은 `/install-animal-busy-indicator` 를 다시 실행하면 됩니다 — Electron 다운로드를 건너뛰고 설정만 다시 씁니다.

**요구사항:** Node.js ≥ 18 + npm (`sudo apt install -y nodejs npm`), `jq`. 첫 설치 시 Electron(~100 MB)을 내려받습니다.

**제거:** `/uninstall-animal-busy-indicator` 후 `/plugin uninstall animal-busy-indicator`. `~/.claude/animal-busy/`(Electron 설치본)를 지우기 전에 물어봅니다.

### 트러블슈팅 — 멀티 모니터 중 일부 화면에 오버레이가 안 보임 (외부 X 서버)

**증상:** 모니터가 2대 이상인데 오버레이가 한 화면에만 나타납니다.

**원인:** X410·VcXsrv 같은 외부 X 서버는 Windows의 모든 모니터를 하나의 가상 스크린으로 합칩니다. Electron의 `getAllDisplays()` 는 X서버에 물어보기 때문에 항상 1개만 반환하고, 오버레이 창도 1개만 생성됩니다.

**수정 방법 (v1.0.1+):** `overlay/main.js` 가 시작 시 `powershell.exe` 로 실제 Windows 모니터 레이아웃을 읽어 X 가상 스크린 좌표로 변환한 뒤 각 모니터마다 창을 만듭니다. PowerShell을 쓸 수 없는 네이티브 Linux에서는 기존 `getAllDisplays()` 폴백을 유지합니다.

이미 설치된 경우 `~/.claude/animal-busy/overlay/main.js` 를 직접 교체하거나, `/install-animal-busy-indicator` 를 재실행하면 최신 파일이 복사됩니다.

### 트러블슈팅 — Electron 설치 실패 (사내 프록시 환경)

**증상:** `/install-animal-busy-indicator` 실행 중 `npm install` 이 아래 오류로 중단됩니다.

```
npm error command failed
npm error command sh -c node install.js
npm error RequestError: read ECONNRESET
```

**원인:** Electron 의 `install.js` 는 `@electron/get`(내부적으로 `got` 라이브러리)을 통해 GitHub Releases 에서 ~100 MB 바이너리를 내려받습니다. `got` 은 표준 `http_proxy` / `https_proxy` 환경변수를 인식하지 못하기 때문에, `npm config` 에 프록시가 설정되어 있어도 대용량 파일을 받다가 프록시에서 연결이 끊깁니다.

**해결:** `@electron/get` 의 로컬 캐시(`~/.cache/electron/`)를 미리 채운 뒤 `install.js` 를 다시 실행합니다. 캐시가 있으면 네트워크 요청을 건너뜁니다.

**1단계 — 스크립트 없이 패키지 먼저 설치**

```bash
cd ~/.claude/animal-busy
npm install --ignore-scripts
```

**2단계 — 설치될 Electron 버전 확인**

```bash
node -e "console.log(require('./node_modules/electron/package.json').version)"
# 예: 30.5.1
```

**3단계 — 캐시 디렉터리 경로 계산**

`@electron/get` 은 다운로드 URL 의 디렉터리 부분을 SHA-256 해시한 값을 캐시 폴더 이름으로 사용합니다.

```bash
ELECTRON_VER=$(node -e "console.log(require('$HOME/.claude/animal-busy/node_modules/electron/package.json').version)")
DOWNLOAD_URL="https://github.com/electron/electron/releases/download/v${ELECTRON_VER}/electron-v${ELECTRON_VER}-linux-x64.zip"
HASH_DIR=$(node -e "
  const url = require('url'), crypto = require('crypto'), path = require('path');
  const u = new url.URL('$DOWNLOAD_URL');
  const stripped = url.format({ protocol: u.protocol, host: u.host, pathname: path.dirname(u.pathname) });
  console.log(crypto.createHash('sha256').update(stripped).digest('hex'));
")
echo "캐시 경로: $HOME/.cache/electron/$HASH_DIR/"
```

**4단계 — curl 로 직접 내려받기**

```bash
mkdir -p "$HOME/.cache/electron/$HASH_DIR"

# zip 본체 (~100 MB)
curl -L --proxy http://<프록시호스트>:<포트> \
  -o "$HOME/.cache/electron/$HASH_DIR/electron-v${ELECTRON_VER}-linux-x64.zip" \
  "$DOWNLOAD_URL"

# 체크섬 파일
curl -L --proxy http://<프록시호스트>:<포트> \
  -o "$HOME/.cache/electron/SHASUMS256.txt-${ELECTRON_VER}" \
  "https://github.com/electron/electron/releases/download/v${ELECTRON_VER}/SHASUMS256.txt"
```

> 프록시 주소를 모르면 `echo $http_proxy` 로 확인하세요.

**5단계 — install.js 재실행**

```bash
cd ~/.claude/animal-busy/node_modules/electron
node install.js
```

캐시를 찾으면 아무 출력 없이 종료됩니다. 이후 `/install-animal-busy-indicator` 를 다시 실행하면 "electron already installed — skipping" 메시지와 함께 설정 단계로 넘어갑니다.

---

## 저장소 구조

```
claude-busy-indicator/
├── .claude-plugin/
│   └── marketplace.json                        # 마켓플레이스 매니페스트 (등재 플러그인 목록)
├── plugins/
│   ├── busy-indicator/
│   │   ├── .claude-plugin/plugin.json
│   │   └── skills/
│   │       ├── install-busy-indicator/SKILL.md
│   │       └── uninstall-busy-indicator/SKILL.md
│   └── animal-busy-indicator/
│       ├── .claude-plugin/plugin.json
│       ├── runtime/                            # 설치 시 ~/.claude/animal-busy/ 로 복사됨
│       │   ├── animal-busy.js                  # start|stop 진입점 (hook 이 호출)
│       │   ├── package.json                    # electron 의존성
│       │   └── overlay/
│       │       ├── main.js                     # Electron main: 항상-위 투명 띠 창
│       │       └── overlay.html                # canvas 렌더러 + 픽셀아트 스프라이트
│       └── skills/
│           ├── install-animal-busy-indicator/SKILL.md
│           └── uninstall-animal-busy-indicator/SKILL.md
├── README.md
└── LICENSE
```

## 설계 노트

- **멱등 설치** — 설치 스킬을 다시 실행하면 제거 없이 그 자리에서 재설정됩니다 (다른 비디오/geometry, 또는 다른 동물/위치/크기/속도/테마).
- **설정 쓰기 전 검증** — `busy-indicator` 는 mpv 를 standalone 으로 pipe-test 하고, `animal-busy-indicator` 는 오버레이를 ~3초 스모크 테스트합니다. 런타임이 동작함을 증명하기 전엔 `settings.json` 을 건드리지 않습니다.
- **분리된 식별 시그니처** — `busy-indicator` hook 은 `claude-busy.pid`, `animal-busy-indicator` hook 은 `animal-busy` 를 포함합니다. 각 제거는 자기 hook 만 정확히 지우므로 두 플러그인을 나란히 설치할 수 있습니다.
- **정리는 선택** — 제거 시 캐시된 비디오 / Electron 설치본을 지우기 전에 항상 물어봅니다.

## 라이선스

MIT — [LICENSE](./LICENSE) 참고.
