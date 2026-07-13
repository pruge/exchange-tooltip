# ADR-0002: 통화 감지 — 정규맵 + 모호심볼 기본값

Status: accepted
Date: 2026-07-13 / 관련: spec.md §Detection, currency.js

## Context
"어떤 통화든" 감지가 필요하나 심볼이 모호하다: `$`=USD/CAD/AUD/MXN/SGD…, `¥`=JPY/CNY, `kr`=SEK/NOK/DKK. 정확한 자동 판별은 사이트/로케일 휴리스틱이 필요해 복잡하다.

## Decision
**정규맵 + 모호심볼 기본값 (KISS).**
1. **ISO 코드는 항상 정확** — 숫자 인접 3-letter 대문자 코드를 감지하고 er-api `rates` 맵의 키로 검증(예: `EUR 12.34`, `12.34 SGD`). rates 맵이 ~160 통화를 주므로 **ISO 코드 감지 = 전 통화 자동 지원**.
2. **큐레이트 심볼표(~15)** — 흔한 심볼→ISO 단일 매핑:
   - 고유(비모호): `€`→EUR, `£`→GBP, `₩`→KRW(→skip), `₹`→INR, `₽`→RUB, `₺`→TRY, `฿`→THB, `₫`→VND, `₴`→UAH, `₪`→ILS, `R$`→BRL, `CHF`→CHF.
   - 모호 → **기본값**: `$`→USD, `¥`→JPY, `US $`/`USD`→USD.
3. 우선순위: 명시적 ISO 코드 > 심볼. (`US $` 는 USD 로 명확.)
4. `parseAmount` 는 기존 로직 재사용(콤마·공백 제거, 양수 검증).

## Alternatives
- TLD/lang 휴리스틱 모호보정: 정확도↑ 복잡도↑ → future(non-goal).
- 모호심볼 사용자 설정: UI 추가 → future(non-goal).

## Consequences
- ✅ 온도(정상 케이스)만 맞으면 90%+ 커버. ISO 코드 사이트는 100%.
- ✅ 단일 심볼표 + rates-키 검증 = 유지보수 단순.
- ⚠️ CAD/AUD 를 `$` 로만 쓰는 사이트는 USD 로 오환산 — future 보정 대상. 밑줄+툴팁이 "USD 기준"임을 rate 라인으로 힌트(showRateInfo).
- ⚠️ 오탐 방지: `$`+숫자 최소 형태만, 기존 정규식 경계 재사용.

## Invariant impact
없음(INV-1 무관 — 순수 파싱 로직).

## Contract impact
없음. 심볼표는 `currency.js` 내부 상수(컴포넌트 내). rates 맵 형태는 외부 API(er-api) 계약 — 이미 소비 중.
