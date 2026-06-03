# Claude Busy Indicator — 설치 설명서

> Claude Code가 작업 중일 때 투명 오버레이 위에서 픽셀아트 동물 캐릭터가 달리는 Skill 설치 가이드

---

## 1. Skill 기본 만들기

### Claude Chat에 다음 프롬프트를 입력

```
skill 을 하나 만들고자 한다.
Claude Code 가 Busy 상태에서, 원하는 것인 투명한 바탕(혹은 검은색 바탕)으로
화면에 동물 캐릭터가 바쁘게 달리는 것을 구현하고자 한다.
동물 캐릭터 소스는 Electron / HTML overlay ✅ CSS/Canvas 애니 방법으로
SKILL.md 방식으로 작성해
```

### 추천받은 아키텍처

```
Claude Code가 작업 시작
    ↓
UserPromptSubmit hook
    ↓
node overlay.js start  ←── Electron 앱 실행
    ↓
투명 창 (always-on-top)
    ↓
Canvas에 픽셀아트 동물이 달림
    ↓
Stop hook
    ↓
node overlay.js stop  ←── 창 닫힘
```

### 생성 결과물

| 항목 | 내용 |
|---|---|
| 📁 파일 구조 | `overlay/`, `skills/`, `animal-busy.js` 등 |
| 🚀 설치 스킬 | `/install-animal-busy-indicator` |
| 📦 최종 파일 | `animal-busy-indicator.zip` |

---

## 2. 제작된 Skill로 GitHub 저장소 생성

### Claude Chat에 다음 프롬프트를 입력

```
https://github.com/dEitY719/claude-plugin-visuals 를 참고하여
동일한 방식으로 내 skill [animal-busy-indicator.zip 압축 해제 폴더] 를
새로운 repo https://github.samsungds.net/jazzman-han/claude-busy-indicator 로 등록하라.
```

### 결과

새 저장소가 생성됩니다:

```
https://github.samsungds.net/jazzman-han/claude-busy-indicator
```

---

## 3. AgentToolbox에 Skill 등록

1. **AgentToolbox 접속**
   ```
   https://toolbox.samsungds.net:3355/
   ```

2. **등록** 버튼 클릭 후 GitHub 저장소 URL 입력
   ```
   https://github.samsungds.net/jazzman-han/claude-busy-indicator
   ```

3. URL 입력 시 이름, 상세 설명, 설치 명령이 **자동으로 채워집니다**

4. 공유 설정 마무리 후 저장

---

## 4. 사용자 설치 및 실행

### 4-1. Toolbox에서 설치

1. `claude-busy-indicator` 아이템 선택 → 상세 페이지 보기
2. **CLI 한 줄 설치 (권장)** 복사

   ```bash
   npx skills add jazzman-han/claude-busy-indicator -a claude-code
   ```

3. 터미널에 붙여넣어 실행

---

### 4-2. Claude Code 내에서 설치 명령 실행

설치 후 아래 4가지 slash 명령이 모두 등록됩니다.

| 명령 | 설명 |
|---|---|
| `/install-busy-indicator` | 기본 busy indicator 설치 |
| `/uninstall-busy-indicator` | 기본 busy indicator 제거 |
| `/install-animal-busy-indicator` | 동물 오버레이 설치 |
| `/uninstall-animal-busy-indicator` | 동물 오버레이 제거 |

---

### 4-3. 동물 오버레이 설치 (상세)

Claude Code 터미널에서 실행:

```
/install-busy-indicator
```
→ 선택 옵션(default 등) 확인 후 설치 완료

```
/install-animal-busy-indicator
```
→ 아래 선택 옵션 설정 후 설치 완료

| 옵션 | 선택지 | 기본값 |
|---|---|---|
| 캐릭터 | cat / dog / fox / rabbit | `cat` |
| 위치 | bottom / top / left / right | `bottom` |
| 크기 | 32 / 48 / 64 / 96 px | `64` |
| 속도 | 1 — 8 | `3` |
| 테마 | transparent / dark | `transparent` |

---

### 4-4. Claude Code 재시작 후 동작 확인

```bash
# Claude Code 재시작
claude
```

이후 어떤 프롬프트를 입력해도 Claude Code가 처리하는 동안
**투명 오버레이 위에서 픽셀아트 동물이 달리는 것**을 확인할 수 있습니다.

---

## 참고 링크

| 항목 | URL |
|---|---|
| 레퍼런스 플러그인 | https://github.com/dEitY719/claude-plugin-visuals |
| 원본 busy indicator | https://github.com/panicdna/claude-busy-indicator |
| AgentToolbox | https://toolbox.samsungds.net:3355/ |
| 내 저장소 | https://github.samsungds.net/jazzman-han/claude-busy-indicator |
