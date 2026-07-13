---
title: 팝업 per-site 토글 + 옵션 동적화 + manifest 권한
status: done
completedAt: 2026-07-13
sprint: wire-multicurrency
area: extension
priority: high
source: spec-decompose
feature: universal-krw
related:
  - docs/roadmap/universal-krw/spec.md
  - docs/roadmap/universal-krw/wireframe.md
  - 2026-07-13-shared-core.md
---

# 팝업 per-site 토글 + 옵션 + manifest (spec T5)

사이트 opt-in 진입점(팝업 체크박스) + manifest 권한 확대.

## 변경
- **popup.html/js** (wireframe 참조):
  - 최상단 **"이 사이트에서 가격 변환 표시" 체크박스** + 매칭 도메인 표시줄.
  - `browser.tabs.query({active,currentWindow})`(activeTab)로 hostname → `SitesKit.isEnabled` 반영, 토글 → `SitesKit.setSite(domain,on)`(content live 반응).
  - URL 없는 탭(about:/파일/확장) → 체크박스 disabled + 회색 안내.
  - 환율/테마 유지, fetch/캐시는 `RatesKit.getRates` 로 교체.
  - `<script src>` 로 currency/rates/sites 포함(순서 주의).
- **options.js/html**: rate 라인 미리보기 문구 소스통화 반영 가능하게 일반화, showRateInfo 유지.
- **manifest.json**:
  - `content_scripts[0].matches=["<all_urls>"]`, `js=["currency.js","rates.js","sites.js","content.js"]`.
  - `permissions` += `activeTab` (storage·`*://open.er-api.com/*` 유지, 호스트는 all_urls 로 대체/포함).
  - version → `0.9.0`.

## acceptance
- QA 2·5·6: 팝업이 활성탭 hostname 정확 표시, 토글 시 content live on/off, 서브도메인 커버.
- `npx web-ext lint` error 0 (권한/matches 검증).
- ⚠️ all_urls → AMO 재심사 유발(ADR-0001) — description 권한 설명은 branding todo 에서.

## 의존
2026-07-13-shared-core.md (T2·T3, 표시 T1).
