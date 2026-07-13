# ADR-0004: 일반 브랜딩 — 이름 변경, gecko id 고정

Status: accepted
Date: 2026-07-13 / 관련: spec.md §Operations 영향, _locales

## Context
이름·설명이 AliExpress/USD 고정("AliExpress USD → KRW Hover")이라 전 사이트·다통화 기능과 불일치.

## Decision
- **display 이름·설명·툴바 타이틀 일반화** — `_locales/{ko,en}/messages.json` 의 `extensionName`·`extensionDescription`·`actionTitle` 수정.
  - 예(ko): "환율 호버 → 원화" / "어떤 사이트에서든 원하는 통화 가격에 마우스를 올리면 원화 환산을 툴팁으로 보여줍니다. 사이트별로 켜세요."
  - 예(en): "Currency → KRW Hover" / "Hover any currency price on sites you enable to see the Korean Won equivalent."
- **`browser_specific_settings.gecko.id` = `ali-usd-krw-hover@local` 고정** — 변경 시 AMO 상 별개 앱이 되어 기존 설치·리뷰 이력 단절. id 는 절대 안 바꾼다.
- README 도 일반화(제목·기능·구조·권한 표 갱신).
- description 에 **"사용자가 켠 사이트에서만 동작"** 문구 포함(ADR-0001 all_urls 권한 정당화 — AMO 심사 대비).

## Alternatives
- 이름 유지: 기능 불일치, 사용자 혼란. 기각.
- gecko id 변경: 신규 앱화 — 절대 불가.

## Consequences
- ✅ 기능과 이름 일치.
- ⚠️ AMO listed 는 이름 변경 시 재심사. description 의 권한 설명이 심사 통과에 중요.
- ✅ id 고정으로 기존 사용자 자동 업데이트 유지.

## Invariant impact
없음.

## Contract impact
없음.
