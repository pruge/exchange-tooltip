---
created: 2026-07-13
status: in_progress
priority: high
kind: bundle
todos: [2026-07-13-content-generalize, 2026-07-13-popup-optin]
worktree: wire-multicurrency
startedAt: 2026-07-13
related_sprints: [2026-07-13-shared-core]
---

# wire-multicurrency — 공유 모듈을 content/팝업/manifest 에 배선
> 묶음. 1 worktree = 1 sprint. shared-core 모듈(CurrencyKit/RatesKit/SitesKit)을 소비해 확장을 실제 다통화·per-site 로 작동시킨다.

## scope
- 2026-07-13-content-generalize (high) — content.js 재작성: 다통화 감지 + per-site 게이트(INV-2) + rate 교차환산.
- 2026-07-13-popup-optin (high) — 팝업 per-site 토글 + options 동적화 + manifest(all_urls·activeTab·js 배열·version 0.9.0).

## 🔴 Invariant 점검 (프로파일 Invariants)
- **INV-1 (background 없이 content-script 단독)** — 지키는 법: 팝업은 `activeTab` 로 활성탭 hostname 읽기(background 핸들러 X), content 는 선언적 `content_scripts` + `storage.onChanged` 라이브 토글. 위반 위험 지점: 팝업→content 통신에 `runtime` 메시징/background 를 끌어들이면 위반 — storage 경유로만 통신할 것.
- **INV-2 (content 기본 inert; allowlist 서픽스 매칭일 때만 부수효과)** — 지키는 법: content.js 로드 즉시 `SitesKit.getSites()`+`isEnabled(location.hostname)` 확인, false 면 스캔·리스너·옵저버 0(단 `storage.onChanged` sites 리스너만 등록해 라이브 activate 대기). 위반 위험: 게이트 전에 MutationObserver/스캔을 붙이면 미허용 사이트에서 부수효과 발생.

## 묶음 근거 (bundle)
- **dependency/계약**: 팝업 토글이 쓰는 `usdKrwSites` allowlist 를 content 게이트가 읽음 — 두 todo 가 같은 storage 계약으로 맞물림.
- **domain**: 같은 컴포넌트(extension), 서로 다른 파일(content.js vs popup/options/manifest) — 충돌 없음.
- **E2E 성립**: "팝업 체크 → content 라이브 활성 → 가격 감지·환산" 은 둘 다 있어야 QA 가능. 단독이면 반쪽.

## 작업 path (예상 phase)
### Phase 1 — content.js 재작성 (content-generalize / spec T4)
- manifest js 배열이 currency/rates/sites 를 먼저 로드하는 전제로, 전역 `CurrencyKit/RatesKit/SitesKit` 소비.
- per-site 게이트: 로드 시 `isEnabled(location.hostname)` → inert or activate. `activate()/deactivate()` 로 리스너·옵저버·SSR틱·스캔 묶어 토글. `storage.onChanged`(sites) 로 라이브 전환.
- 다통화: 정규식→`buildPriceRegexes()`, `dataset.usd`→`dataset.amount`+`dataset.currency`, `readLiveUsd`→`readLivePrice`(interpret 사용). 호버: `getRates()`→`convertToKRW(amount,cur,rates)`→툴팁, rate 라인 `1 <cur> = X원`. KRW skip.
- prefs/테마/onChanged(prefs) 기존 로직 유지.

### Phase 2 — 팝업/옵션/manifest (popup-optin / spec T5)
- popup.html/js: 최상단 per-site 체크박스 + 매칭 도메인 표시. `tabs.query({active,currentWindow})`(activeTab)→hostname→`isEnabled` 반영, 토글→`setSite`. URL 없는 탭 disabled+안내. 환율/테마는 RatesKit/기존 유지. `<script src>` 로 currency/rates/sites 포함.
- options.js/html: rate 라인 미리보기 소스통화 반영 일반화, showRateInfo 유지.
- manifest.json: `content_scripts[0].matches=["<all_urls>"]`, `js=["currency.js","rates.js","sites.js","content.js"]`, `permissions += activeTab`(storage·open.er-api 유지), version→0.9.0.

> Phase 1·2 는 파일이 겹치지 않아 병렬 가능(같은 worktree 안).

## 다음 단계 결정 필요
- 없음 (spec + shared-core 인터페이스가 닫음). 참고: 팝업↔content 통신은 storage 경유만(INV-1).

## 완료 기준
- content-generalize 완료: QA 매트릭스(spec §Test Strategy) 1·3·4·5·7·8 — aliexpress 회귀(USD)·ISO+심볼·KRW skip·라이브 비활성·미허용 inert·rate 라인 소스통화.
- popup-optin 완료: QA 2·5·6 — 임의 사이트 팝업 체크→라이브 활성, 체크 해제→중단, 서브도메인 커버. 팝업이 활성탭 hostname 정확 표시.
- 전체 회귀: 시드 aliexpress 에서 기존 USD 호버 동작 유지 + 새 통화/사이트 정상.
- verify: `npx web-ext lint` errors 0 (matches/permissions/js 배열 검증 포함).
- ⚠️ all_urls → AMO 재심사 유발(ADR-0001) — description 권한 문구는 branding sprint 담당.

## 사용자 테스트
**변경 컴포넌트**: extension (user-runs — claude 가 Firefox 를 띄우지 않음).

**실행** (둘 중 하나):
```
# A) Firefox 임시 로드: about:debugging#/runtime/this-firefox
#    → "임시 부가 기능 로드" → 이 worktree 의 manifest.json 선택
# B) npx web-ext run   (dev Firefox 자동 기동 + 라이브 리로드)
```

**✅ 가시 확인** (완료 기준 매핑):
- ☐ **회귀·시드** — `aliexpress.com` 상품페이지: USD 가격 점선 밑줄 + 호버 시 원화 툴팁(기존 동작). 팝업 열면 "이 사이트에서 가격 변환 표시" 이미 체크·도메인 `aliexpress.com`.
- ☐ **per-site 활성(라이브)** — 임의 사이트(환율/해외쇼핑 페이지): 처음엔 밑줄 없음 → 툴바 아이콘 클릭 → 팝업 체크 → **리로드 없이** 가격 밑줄·호버 환산 시작.
- ☐ **다통화** — `€`·`£`·`¥`·ISO코드(`EUR 10`·`10 SGD`)가 각각 원화로 환산. showRateInfo ON 시 rate 라인이 `1 EUR = N원`처럼 소스통화 반영.
- ☐ **KRW skip** — `₩` 가격은 밑줄/툴팁 없음.
- ☐ **라이브 비활성** — 활성 사이트에서 팝업 체크 해제 → 호버 툴팁 안 뜸(리로드 후 밑줄도 사라짐).
- ☐ **서브도메인** — aliexpress 켠 상태에서 `m.aliexpress.com` 등 서브도메인도 동작.
- ☐ **미허용 inert** — 안 켠 사이트: 콘솔에 "content script loaded" 는 찍히되 "가격 발견" 로그 0.
- ☐ **팝업 환율** — 팝업에 `1 USD = N원` + 업데이트 시각, 새로고침 동작.
- ☐ **비지원 페이지** — `about:`/파일 페이지에서 팝업: 체크박스 비활성 + "이 페이지에선 사용할 수 없어요".

> 검증(개발자, 완료): `web-ext lint` 0/0/0 · 전 JS `node --check` OK · manifest 유효 JSON · 공유모듈 node 41/41(shared-core).

## 관련 todo / spec
- [content-generalize](../todo/2026-07-13-content-generalize.md) — content.js 다통화 + 게이트
- [popup-optin](../todo/2026-07-13-popup-optin.md) — 팝업 토글 + manifest
- [spec](../roadmap/universal-krw/spec.md) §Architecture·Detection·Rate layer·Data Model·Task Breakdown
- [wireframe](../roadmap/universal-krw/wireframe.md) — 팝업 UI
- 선행 완료: [shared-core](archive/2026-07-13-shared-core.md) (모듈 3종)
