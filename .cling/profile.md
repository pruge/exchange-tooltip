# .cling/profile.md — `exchange` 프로파일

> cling 워크플로우가 읽는 SoT. `/cling:init` 이 생성하며, 직접 편집 가능.
> 모든 `/cling:*` 명령은 이 파일을 먼저 읽고 프로젝트 특수성을 여기서만 가져온다.

## Project
- name: `exchange` (AliExpress USD → KRW Hover)
- summary: AliExpress USD 가격에 호버하면 원화 환산 툴팁을 보여주는 Firefox 확장 (MV2, 바닐라 JS)

## Components
> 단일 컴포넌트 소품. 빌드 스텝·번들러 없음 — 브라우저가 소스를 직접 로드.
> verify = 정적 검증(`web-ext lint`). 테스트 스위트 없음 → lint 가 유일한 머지 게이트.

| 컴포넌트 | 언어/스택 | build | verify (compile + test) |
|---|---|---|---|
| `extension` | 바닐라 JS / Firefox WebExtension MV2 | `npx web-ext build` (xpi 패키징, 선택) | `npx web-ext lint` (manifest + 코드 정적검증 — AMO validation 사각 커버) |

## Source layout
> 단일 컴포넌트, repo 루트에 소스가 흩어져 있음(확장 표준 구조). 코드 루트 분리 안 함.

- code root: repo 루트
| 파일 | 역할 |
|---|---|
| `manifest.json` | MV2 매니페스트 (content_scripts / browser_action / options_ui) |
| `content.js` | DOM 스캔 · USD 가격 감지 · 호버 툴팁 |
| `tooltip.css` | 4가지 테마 (CSS 변수) |
| `popup.html` / `popup.js` | 도구바 팝업 (환율 확인 · 테마 전환) |
| `options.html` / `options.js` | 상세 옵션 |
| `_locales/` | i18n 메시지 (기본 로케일 = ko) |
| `icons/` | PNG 아이콘 (16/32/48/96/128) |

## Contract (shared SoT)
- mode: `none`   # 단일 언어·단일 컴포넌트, 컴포넌트 경계 없음. 공유 계약 불필요.

## Operations (Runbook)
> `web-ext` 는 `npx` 로 실행(전역 설치 없음, package.json 없음). who = 실행 주체.

| 명령 | 목적 | who | 비고 |
|---|---|---|---|
| `about:debugging` → "임시 부가 기능 로드" → `manifest.json` | dev 임시 로드 (Firefox 직접) | user-runs | claude 가 Firefox 띄우지/닫지 않음 |
| `npx web-ext run` | dev Firefox 자동 기동 + 라이브 리로드 | user-runs | claude kill/재시작 금지 |
| `npx web-ext lint` | verify 게이트 (정적 검증) | claude-ok | |
| `npx web-ext build` | xpi 패키징 (`web-ext-artifacts/`) | claude-ok | |
| `npx web-ext sign --channel=listed\|unlisted --api-key=… --api-secret=…` | AMO 서명·게시 | user-only | 🔴 비가역 외부 게시 + API 키. 안내만, claude 실행 금지 |

## Docs layout
> cling 기본 bare-4. `docs/` 는 원래 gitignore 였으나 추적으로 전환(기존 개발노트·아이콘은 `_memo/` 로 이동).

- roadmap: `docs/roadmap/`   # kickoff 산출물 (brief/spec/wireframe/adr)
- todo:    `docs/todo/`
- sprint:  `docs/sprint/`
- spec(SoT 승격): `docs/spec/`
- 인박스: `docs/_memo/`   # gitignore, scratch·원본 자료(기존 개발노트/아이콘 SVG 이관됨)
> 세션 핸드오프는 todo/sprint frontmatter(md SoT) + git 상태 + worktree-end 의 memory-checkpoint 가 담당.

## Verify gate
- **완료 판정 = `npx web-ext lint` 실행해 error 0.** LSP 진단만으로 "완료" 금지.
- 테스트 스위트 없음 — lint 통과 후 사용자 수동 QA(임시 로드 → 알리 페이지 호버)로 기능 확인.
- 컴파일 사각 없음: 번들·DI·codegen 없는 순수 바닐라 JS, 브라우저가 소스 직접 로드.

## Invariants (프로젝트 불변식)
- **INV-1: background/service-worker 없이 content-script 단독 동작.** 상태·환율 캐시는 `storage` API + content.js 안에서 처리. background 스크립트를 도입하지 않는다(권한 최소·MV2 유지).
- **INV-2: content script 는 기본 inert; `location.hostname` 이 allowlist(`usdKrwSites`) 서픽스 매칭일 때만 부수효과(스캔·리스너·DOM 변형)를 낸다.** 미허용 사이트는 storage 1회 read 후 `storage.onChanged` 리스너만 남기고 종료. (universal-krw/ADR-0001)

## Delegation policy
- mode: `solo`   # 1인 소품, 위임 없음

## Memory policy
- **format: `governed`** (항상 통일 — 미래 cross-project harvest 대비)
  - 파일명: `<type>_<slug>.md` · frontmatter: `name` · `description` · `metadata:{ type, status, last_verified, tier }`
  - index: `MEMORY.md` 1줄 포인터
- **enforce: `plain`**   # 포맷만, 의식 X (소품 — governance cap/hook 불필요)
  - `/cling:worktree-end` 가 `/memory-checkpoint`(plain) 로 분기.

## Sprint machinery
> 단일 모델 — cling 부기 = md frontmatter SoT. todo/sprint 상태는 항목당-파일 frontmatter 가 유일 진실, 직접 Write/Edit. index.json·생성 스크립트 없음. done 은 `/cling:archive` 가 `archive/` 로 격리.

## Test strategy per layer
- `extension`: 자동 테스트 없음. `web-ext lint`(정적) + 수동 QA(Firefox 임시 로드 → AliExpress USD 페이지 호버 → 툴팁·환율·테마 확인).

## Conventions
- worktree path: `.claude/worktrees/<slug>`
- 실행 자율성 + 검토 게이트: worktree 안 개발·`web-ext lint` 는 자율 진행. **lint green 이면 멈추고 사용자 QA 대기** → OK 후에만 `worktree-end`(머지).
- commit/push: 명시 요청 시만. main 직접 커밋은 확인 후.
- 외부 전송/삭제/비가역(특히 `web-ext sign` AMO 게시): 확인 후 진행.
- 언어: 사용자와 동일 언어(한국어)로 응답.
