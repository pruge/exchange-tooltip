# ADR-0003: 환율 교차표 — rates 맵 통째 캐시

Status: accepted
Date: 2026-07-13 / 관련: spec.md §Rate layer, rates.js

## Context
현재 캐시는 단일 값(`{ rate: <KRW per USD>, fetchedAt }`)만 저장한다. 다통화 환산에는 소스통화별 환율이 필요하다.

## Decision
`open.er-api.com/v6/latest/USD` 응답의 **`rates` 맵 전체(1 USD 기준 각 통화)를 통째 캐시**한다.
- 캐시 엔트리: `{ rates: {...}, fetchedAt }` (`CACHE_KEY = "usdKrwRate"` 유지 — 구조만 확장. 구버전 엔트리(단일 rate 필드)는 무시하고 재fetch).
- 환산: `krw = amount × (rates.KRW / rates[SRC])`. (`SRC="USD"` 면 `rates.KRW` 와 동일 — 하위호환.)
- **한 번 fetch 로 전 통화 교차환산.** 추가 네트워크 0.
- `rates[SRC]` 없거나(미지원 통화) `rates.KRW` 없으면 환산 실패 처리(툴팁 "환율 조회 실패"/"미지원 통화").
- 캐시·fetch 로직을 `rates.js` 로 추출해 content.js 와 popup.js 가 **동일 캐시 공유**(storage 키 공유 → 한쪽이 fetch 하면 다른 쪽도 이득).

## Alternatives
- 소스통화별 개별 fetch(`latest/EUR` 등): N배 요청 + 캐시 폭증. 기각(단일 USD-base 로 교차 계산 가능).
- KRW-base fetch(`latest/KRW`): 역수 필요, 동일 결과. USD-base 유지(기존 호환).

## Consequences
- ✅ 전 통화 지원에 네트워크 비용 증가 0.
- ✅ content/popup 캐시 공유로 중복 fetch 제거.
- ⚠️ 캐시 엔트리 크기↑(~160 키, 수 KB) — storage.local 여유 충분.
- ⚠️ 구버전 캐시 엔트리 형식 불일치 → 첫 로드 시 1회 재fetch(무해).

## Invariant impact
없음(INV-1: fetch 는 content script 에서 직접 — 기존과 동일, background 불필요).

## Contract impact
없음(외부 API 응답 형태 소비 확대 — `rates.KRW` 만 쓰던 것을 맵 전체로. 계약 채널 신설 아님).
