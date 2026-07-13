# 배포 런북 (build · sign · publish)

> Firefox 확장(MV2)의 패키징·서명·AMO 게시 절차와 릴리스 기록. cling IA: `z_setup/`(운영 런북).

## 개요

- 빌드 툴: `web-ext` (전역 설치 없이 `npx web-ext …`).
- gecko id: **`ali-usd-krw-hover@local`** — 🔴 절대 변경 금지(변경 시 AMO 상 별개 앱 = 기존 설치·이력 단절).
- 채널 2종:
  - **unlisted** — 자체 배포용. 즉시 서명된 `.xpi` 다운로드 → 정식판 Firefox 영구 설치 가능. 심사 없음.
  - **listed** — AMO 공개 스토어. 자동 검증 + (필요 시) 수동 검토 후 공개.
- 버전 번호는 **두 채널 통틀어 유일**해야 함 → 한 번 쓴 버전은 재사용 불가(다음 서명은 반드시 bump).

## 자격 증명 (AMO API)

- JWT 발급자 / 시크릿은 **`docs/_memo/mozilla 개발자.md`** 에 보관(🔴 `docs/_memo/` 는 gitignore — 커밋·push·패키지 제외).
- 발급/회전: https://addons.mozilla.org/developers/addon/api/key/
- 사용법: `WEB_EXT_API_KEY=<발급자> WEB_EXT_API_SECRET=<시크릿> npx web-ext sign …` (환경변수로 주입, 명령 로그에 시크릿 남기지 말 것).

## 패키지 제외 목록 (`--ignore-files`)

확장 파일만 담기게 항상 아래를 제외:
```
"docs/**" ".cling/**" ".claude/**" "*.xpi" "web-ext-artifacts/**" "amo-metadata.json" ".amo-upload-uuid" "MEMORY.md"
```
→ `docs/_memo` 의 시크릿·cling 문서·서명 산출물이 패키지에 안 들어감.

## 절차

### 0. 사전
```bash
npx web-ext lint --self-hosted --ignore-files "docs/**" ".cling/**" ".claude/**" "*.xpi" "web-ext-artifacts/**" "amo-metadata.json" ".amo-upload-uuid" "MEMORY.md"
# errors 0 확인. + node 로 순수 로직 검증(currency 모듈).
```
`manifest.json` 의 `version` bump.

### 1. 미서명 빌드 (임시 로드 / 개발)
```bash
npx web-ext build --overwrite-dest --ignore-files <위 목록>
# → web-ext-artifacts/_-<version>.zip  (about:debugging 임시 로드용)
```

### 2. unlisted 서명 (자체 배포 — 정식판 영구 설치)
```bash
WEB_EXT_API_KEY=… WEB_EXT_API_SECRET=… \
npx web-ext sign --channel=unlisted --ignore-files <위 목록>
# → web-ext-artifacts/996ddff01e1f4fa096f9-<version>.xpi (서명됨)
```
설치: `about:addons` → ⚙ → "파일에서 부가 기능 설치" → 위 `.xpi`.

### 3. listed 게시 (공개 스토어)
```bash
WEB_EXT_API_KEY=… WEB_EXT_API_SECRET=… \
npx web-ext sign --channel=listed --amo-metadata=amo-metadata.json --ignore-files <위 목록>
```
- `amo-metadata.json` = 카테고리(`shopping`)·라이선스(MIT). 리스팅 메타데이터.
- 자동 검증 통과 시 서명 XPI 다운로드. `<all_urls>` 권한 때문에 **게시 후 수동 검토** 가능.
- 상태 확인: https://addons.mozilla.org/developers/addons → 버전 상태(Approved/Pending).
- 🔴 리뷰 노트 답변: "**per-site opt-in — 사용자가 팝업에서 켠 사이트에서만 동작. 데이터 수집 없음(환율 API 호출만).**"

## 릴리스 기록

| 버전 | 채널 | 요약 |
|---|---|---|
| 0.8.5 | listed | (이전) AliExpress USD 전용, AMO listed 제출 |
| 0.9.0 | unlisted | **universal-krw** — 다통화 + 전 사이트 per-site opt-in(`<all_urls>`+게이트), 공유 모듈(currency/rates/sites), 이름 "환율 호버 → 원화" |
| 0.9.1 | unlisted | 유럽식 숫자(`512,00 €` · `1.234,56`) 파싱 — 콤마=소수/천단위 자동 판별 |
| 0.9.2 | unlisted | `USD $` 코드+심볼 결합 토큰 감지(WMC 등 통화 스위처 사이트) |
| **0.9.3** | **listed** | 위 전부 반영해 공개 스토어 제출 |
| 0.9.4 | (미정) | 이름 변경 → "원화 환산 — 환율 호버" (EN "KRW Converter — Hover Any Price"). gecko id 불변 |

## 참고
- 자체설치 서명 XPI 는 `web-ext-artifacts/`(gitignore)에 버전별 누적.
- unlisted 로 이미 쓴 버전(0.9.0~0.9.2)은 listed 로 못 올림 → listed 는 새 버전(0.9.3)으로.
- release repo: `github.com/pruge/exchange-tooltip`.
