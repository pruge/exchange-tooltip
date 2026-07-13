---
title: content.js 다통화 일반화 + per-site 게이트
status: in_progress
sprint: wire-multicurrency
area: extension
priority: high
source: spec-decompose
feature: universal-krw
related:
  - docs/roadmap/universal-krw/spec.md
  - 2026-07-13-shared-core.md
---

# content.js 일반화 + per-site 게이트 (spec T4)

CurrencyKit·RatesKit·SitesKit 을 소비해 content script 를 전 통화 + 사이트 게이트로 재작성.

## 변경
- **per-site 게이트 (INV-1/INV-2)**: 로드 시 `SitesKit.getSites()` → `isEnabled(location.hostname)` false 면 inert. 단 `storage.onChanged`(sites) 리스너만 등록 → 라이브 activate 대기.
- **activate()/deactivate()**: 스캔·mouseover/out/move·scroll 리스너·MutationObserver·SSR 세이프티틱·SPA 폴을 한 묶음으로 토글. deactivate 시 툴팁 hide + detach(기존 밑줄은 리로드 시 제거 — 즉시 언랩 non-goal).
- **다통화**: 정규식 → `CurrencyKit.buildPriceRegexes()`. `dataset.usd`→`dataset.amount`+`dataset.currency`. `readLiveUsd`→`readLivePrice`(통화 재파싱 포함).
- **호버**: `RatesKit.getRates()` → `CurrencyKit.convertToKRW(amount,cur,rates)` → 툴팁. rate 라인 `1 <cur> = X원`(showRateInfo). 환산 null 시 "미지원 통화"/"환율 조회 실패".
- **KRW skip**: 감지 통화 KRW 면 래핑/환산 안 함.
- prefs/테마/onChanged(prefs) 기존 로직 유지.

## acceptance
QA 매트릭스(spec §Test Strategy) 1·2·3·4·5·7·8 통과:
- 1 aliexpress 회귀(USD), 2 임의사이트 라이브 활성, 3 ISO+심볼, 4 KRW skip, 5 라이브 비활성, 7 미허용 inert(스캔로그 0), 8 rate 라인 소스통화.
- `npx web-ext lint` error 0.

## 의존
2026-07-13-shared-core.md (T1·T2·T3).
