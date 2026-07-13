---
title: 공유 순수 모듈 3종 (currency / rates / sites)
status: done
completedAt: 2026-07-13
sprint: shared-core
area: extension
priority: high
source: spec-decompose
feature: universal-krw
related:
  - docs/roadmap/universal-krw/spec.md
  - 2026-07-13-content-generalize.md
  - 2026-07-13-popup-optin.md
---

# 공유 순수 모듈 3종 — universal-krw 기반 (spec T1·T2·T3)

빌드 없는 확장이라 content script(js 배열) 와 팝업/옵션(`<script src>`)이 **공유하는 순수 로직을 전역 네임스페이스 모듈**로 분리. 이후 todo(content/popup)의 토대.

## T1 — `currency.js` → `var CurrencyKit`
- `SYMBOL_TO_CURRENCY`: 고유심볼 단일매핑(€→EUR, £→GBP, ₩→KRW, ₹→INR, ₽→RUB, ₺→TRY, ฿→THB, ₫→VND, ₴→UAH, ₪→ILS, R$→BRL, CHF→CHF) + 모호기본값($→USD, ¥→JPY, US$/USD→USD). (ADR-0002)
- `buildPriceRegexes()`: 통화토큰(심볼집합 ∪ ISO 3-letter 패턴) + 금액 → INLINE/WHOLE/SINGLE 3형태 재구성(기존 정규식 일반화).
- `detectCurrency(text|match)`: ISO코드(rates 키 검증) > 심볼 우선 → ISO 문자열 or null.
- `parseAmount(raw)`: 기존 로직 이관.
- `convertToKRW(amount, src, rates)`: `rates.KRW`·`rates[src]` 검증 → `amount*rates.KRW/rates[src]`, 실패 null.
- `formatKRW(amount)`: 기존 이관.

## T2 — `rates.js` → `var RatesKit`
- `getRates(force?)`: `{rates, fetchedAt}` 반환. `CACHE_KEY="usdKrwRate"`, TTL 1h, `rates` 맵 통째 캐시(ADR-0003). 구형 엔트리(rates 없음) 재fetch. content/popup storage 캐시 공유.

## T3 — `sites.js` → `var SitesKit`
- `SITES_KEY="usdKrwSites"`, `DEFAULT_SITES={"aliexpress.com":true,"aliexpress.us":true}`.
- `getSites()`, `isEnabled(host,sites)`(도메인 서픽스: `host===d||host.endsWith("."+d)`), `setSite(host,on)`, `currentDomain(host)`.

## acceptance
- `npx web-ext lint` error 0.
- 3 모듈 전역 노출(isolated world + extension page 양쪽), 서로 독립 로드 가능.
- detectCurrency/convertToKRW/isEnabled 가 ADR-0002/0003/0001 명세대로.

## 의존
없음 (첫 착수 대상). 실행 준비 완료 — spec 이 인터페이스를 닫음.
