# universal-krw — brief

## 문제
현재 확장은 **AliExpress 에서 USD 가격만** 원화로 환산한다. 사용자는 *모든 사이트에서 어떤 통화든* 원화로 보고 싶어 한다. 단, 전 사이트 자동 실행은 원치 않고 **사이트별로 켜는(opt-in)** 방식을 원한다.

## 의도
- 통화 축: USD 전용 → **어떤 통화든**(ISO 코드 전 통화 + 흔한 심볼) → KRW.
- 사이트 축: AliExpress 고정 → **모든 사이트 가능하되 사용자가 켠 사이트에서만** 동작.
- 진입점: 툴바 아이콘 클릭 시 뜨는 팝업에 **"이 사이트에서 가격 변환 표시" 체크박스**.
- 기존 인프라(툴팁·테마·스캔·캐시) 최대 재사용.

## 라이프사이클
설치 → (기본 시드로 aliexpress 는 켜져 있음) → 사용자가 다른 사이트에서 아이콘 클릭 → 체크 → 그 사이트에서 즉시(리로드 없이) 가격 감지·호버 환산 시작. 체크 해제 → 즉시 중단.

## Scope / phase 경계
**단일 spec — 두 축(전 사이트 opt-in + 다통화)을 함께.** 두 축은 같은 코드 경로(정규식 일반화 + 환율 교차표 + 사이트 게이트)를 공유하므로 분리가 인위적이다. UI 변경(팝업 per-site 토글)도 포함.

## 재사용 map (Stage 0 — 재발명 금지)
| 자산 | 상태 |
|---|---|
| 툴팁 시스템(커서추적·포지셔닝·show/hide) | 그대로 |
| 4테마 + CSS 변수 (`tooltip.css`) | 그대로 |
| prefs (storage + `onChanged` 동기 + options + popup) | 확장(allowlist 추가) |
| 환율 캐시(TTL) | 일반화 — `rates` 맵 통째 저장 |
| 2-패스 스캔(텍스트노드+요소통째·MutationObserver·SSR틱·SPA감지) | 게이트 추가 + 정규식 일반화 |
| Ali fast-path 셀렉터 | 유지(무해) |
| DEBUG 로깅 | 그대로 |
| `open.er-api.com/v6/latest/USD` | 그대로 — 응답 `rates` 맵이 전 통화 교차표 |

**일반화 필요:** 정규식(USD 전용)·`dataset.usd`·환율캐시(KRW 단일값)·manifest matches·이름/locales.

## Non-goal (이번 spec 밖)
- 사이트/로케일 기반 모호심볼 자동보정(amazon.ca $→CAD). → future.
- 모호심볼 사용자 기본값 설정 UI(`$`→CAD 선택). → future.
- 원화 외 타겟 통화. → future.
- 오프라인/다중 환율 소스. → future.

## Future
- 모호심볼 보정(TLD/lang 휴리스틱 또는 사용자 설정).
- allowlist 관리 UI(options 에서 목록 편집·제거).
- 사이트별 소스통화 override.

## ADR 색인
- ADR-0001 — per-site allowlist 게이트 (background 없이 INV-1 유지)
- ADR-0002 — 통화 감지: 정규맵 + 모호심볼 기본값
- ADR-0003 — 환율 교차표 (rates 맵 통째 캐시)
- ADR-0004 — 일반 브랜딩 (이름 변경, gecko id 고정)
