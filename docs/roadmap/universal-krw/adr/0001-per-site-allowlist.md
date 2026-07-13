# ADR-0001: per-site allowlist 게이트 (background 없이 INV-1 유지)

Status: accepted
Date: 2026-07-13 / 관련: spec.md §Architecture, §Data Model

## Context
전 사이트 동작이 필요하나 사용자는 사이트별 opt-in 을 원한다. Firefox MV2 에서 사이트별 활성 방식 후보:
1. `activeTab` + `action.onClicked` 프로그래매틱 주입 — action 핸들러는 background/event page 필요.
2. `browser.contentScripts.register()` 동적 등록 — extension page(background)에서만 호출 가능.
3. 선언적 `content_scripts: <all_urls>` + **런타임 allowlist 게이트** — 항상 주입되나 hostname 미허용이면 inert.

INV-1(background/service-worker 없이 content-script 단독)이 1·2 를 배제한다(둘 다 background 필요).

## Decision
**3안 채택.** content script 를 `<all_urls>` 로 선언(document_idle)하되, 로드 즉시 `location.hostname` 을 storage 의 `allowlist` 와 대조 — 미허용이면 스캔·리스너·옵저버를 **일절 붙이지 않고 inert 종료**. 허용이면 기존 스캔 파이프라인 기동.

토글은 팝업 체크박스 → storage `allowlist` 갱신 → content script 의 `storage.onChanged` 리스너(기존 prefs 동기와 동일 패턴)가 **리로드 없이** activate/deactivate.
- **activate(live)**: 스캔 실행 + mouseover/out/move·scroll 리스너 + MutationObserver + SSR틱 부착.
- **deactivate(live)**: 리스너·옵저버 detach + 툴팁 hide. 이미 래핑된 `.usdkrw-price` 밑줄/스팬은 리로드 시 사라짐(즉시 언랩은 비용 대비 무가치 — non-goal).

매칭 = **hostname 도메인 서픽스**: 저장값 `d` 에 대해 `host === d || host.endsWith("." + d)`. 기본 시드 = `aliexpress.com`, `aliexpress.us`(하위호환).

팝업이 현재 탭 hostname 을 읽기 위해 **`activeTab`** 권한 추가(팝업 열림 동안 활성탭 URL 접근 — background 불필요).

## Alternatives
- activeTab 주입(1) / 동적 등록(2): INV-1 위반. 기각.
- `optional_permissions` 로 사이트별 호스트 권한 요청: 동적 요청·등록에 background 필요 → INV-1 위반. 기각.

## Consequences
- ✅ INV-1 유지(순수 선언적, background 0).
- ✅ 미허용 사이트는 inert(스토리지 1회 read 후 종료) — 성능·시각 노이즈 0.
- ✅ 라이브 토글(리로드 불요) — 기존 onChanged 재사용.
- ⚠️ **정직한 한계**: 선언적 `<all_urls>` 라 **설치 시 "모든 사이트 데이터 접근" 권한 프롬프트가 여전히 뜬다**. allowlist 는 *동작* 게이트지 *권한* 게이트가 아니다. no-background 제약의 대가. → AMO 심사 강화 + 설명에 명시 필요.
- ⚠️ AMO listed 심사: matches 확대 → 리뷰어가 all_urls 정당성 확인. description 에 "사용자가 켠 사이트에서만 동작" 명시.

## Invariant impact
- **INV-1 (background 없이 content-script 단독)**: 지킴 — 본 결정이 1·2안을 배제한 이유가 곧 INV-1. 지키는 법 = 선언적 content_scripts + 런타임 게이트 + storage.onChanged.
- **신규 불변식 제안 → INV-2**: "content script 는 기본 inert; `location.hostname` 이 allowlist 서픽스 매칭일 때만 부수효과(스캔·리스너·DOM 변형)를 낸다." `.cling/profile.md` Invariants 에 추가 제안.

## Contract impact
없음(단일 컴포넌트, 공유 타입 경계 없음). storage 스키마는 컴포넌트 내부.
