---
created: 2026-07-13
status: in_progress
priority: high
kind: single
todos: [2026-07-13-shared-core]
worktree: shared-core
startedAt: 2026-07-13
related_sprints: []
---

# shared-core — 공유 순수 모듈 3종 (currency / rates / sites)
> 단독. 1 worktree = 1 sprint. universal-krw 의 foundation — content/popup todo 의 전제.

## scope
- 2026-07-13-shared-core (high) — 빌드 없는 확장이 content script(js 배열)와 팝업/옵션(`<script src>`)에서 공유하는 순수 로직을 전역 네임스페이스 모듈 3종으로 분리.

## 🔴 Invariant 점검 (프로파일 Invariants)
- **없음** — 순수 모듈(감지/환산/allowlist 헬퍼)이라 부수효과 없음. INV-1(background 없음)/INV-2(inert 게이트)는 이 모듈을 *소비하는* content-generalize todo 에서 구현·점검. 단 `sites.js` 는 INV-2 게이트에 쓰일 `isEnabled`(도메인 서픽스 매칭)를 제공하므로 그 계약(서픽스 매칭·기본 시드)을 정확히 지킬 것.

## 작업 path (예상 phase)
### Phase 1 — currency.js (`var CurrencyKit`)
- `SYMBOL_TO_CURRENCY` 심볼표(고유 + 모호기본값 $→USD, ¥→JPY) — ADR-0002.
- `buildPriceRegexes()` 통화토큰(심볼 ∪ ISO 패턴) + 금액 → INLINE/WHOLE/SINGLE 재구성.
- `detectCurrency()`(ISO>심볼, rates 키 검증) · `parseAmount()` 이관 · `convertToKRW(amount,src,rates)` 교차식+null · `formatKRW()` 이관.

### Phase 2 — rates.js (`var RatesKit`)
- `getRates(force?)` → `{rates,fetchedAt}`, `CACHE_KEY="usdKrwRate"`, TTL 1h, rates 맵 통째 캐시, 구형 엔트리 재fetch, content/popup storage 공유 — ADR-0003.

### Phase 3 — sites.js (`var SitesKit`)
- `SITES_KEY="usdKrwSites"`, `DEFAULT_SITES={aliexpress.com,aliexpress.us}`, `getSites()`, `isEnabled(host,sites)`(서픽스), `setSite(host,on)`, `currentDomain(host)` — ADR-0001.

> 3 모듈 서로 독립(로드 순서 무관). 전역 노출은 isolated world + extension page 양쪽 안전한 top-level `var`.

## 다음 단계 결정 필요
- 없음 (spec 이 인터페이스·상수·계약을 모두 닫음).

## 완료 기준
- 2026-07-13-shared-core 완료:
  - `npx web-ext lint` error 0.
  - `CurrencyKit.detectCurrency` — ISO코드(전 통화, rates 키 검증) / 고유심볼 / 모호기본값을 ADR-0002 대로 반환, KRW 반환 가능(소비측 skip).
  - `CurrencyKit.convertToKRW` — `amount*rates.KRW/rates[src]`, 미지원/누락 시 null.
  - `RatesKit.getRates` — rates 맵 통째 반환, TTL·구형엔트리 재fetch, storage 캐시 공유.
  - `SitesKit.isEnabled` — 도메인 서픽스 매칭(`host===d||host.endsWith("."+d)`), 기본 시드 aliexpress.com/.us.
- 전체 회귀: 이 sprint 는 신규 모듈만 추가(기존 content.js 미변경) → 기존 aliexpress USD 호버 동작 무영향(회귀 리스크 0). lint green 이 회귀 게이트.

## 사용자 테스트
> 비움 — `/cling:worktree` 개발 완료 보고 시 `/cling:notify --all` 로 채움.

## 관련 todo / spec
- [2026-07-13-shared-core](../todo/2026-07-13-shared-core.md) — 공유 모듈 3종
- [spec](../roadmap/universal-krw/spec.md) §Architecture·Detection·Rate layer·Data Model
- 하류: [content-generalize](../todo/2026-07-13-content-generalize.md) · [popup-optin](../todo/2026-07-13-popup-optin.md) (이 sprint 전제로 대기)
