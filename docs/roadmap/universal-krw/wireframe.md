# universal-krw — wireframe (popup)

툴바 아이콘 클릭 → 아이콘 밑 네이티브 팝업(`browser_action.default_popup`). 신규 = 최상단 per-site 토글.

```
┌──────────────────────────────┐
│  💱  환율 → 원화               │   ← 헤더(기존)
├──────────────────────────────┤
│ ☑ 이 사이트에서 가격 변환 표시  │   ← 신규. 활성탭 hostname 기준
│    aliexpress.com             │   ← 매칭 도메인(작은 글씨)
├──────────────────────────────┤
│  1 USD = 1,380.00 원          │   ← 기존 환율 표시(RatesKit)
│  업데이트: 2026-07-13 …        │
│  [ 새로고침 ]                  │
├──────────────────────────────┤
│  테마:  ● 웜  ○ 다크  ○ …      │   ← 기존 테마 빠른 선택
│  자세한 옵션 →                 │   ← options 링크(기존)
└──────────────────────────────┘
```

## 상태
- **활성탭이 http(s)** : 체크박스 enabled. 체크상태 = `SitesKit.isEnabled(host)`. 토글 → `SitesKit.setSite(domain, on)` → content script live activate/deactivate.
- **활성탭이 about:/파일/확장페이지 등 URL 없음** : 체크박스 disabled + "이 페이지에선 사용할 수 없어요" 회색 안내.
- 매칭 도메인 줄 = `SitesKit.currentDomain(host)`(저장 단위) 표시 → 사용자가 무엇이 켜지는지 명확.

## 인터랙션
- 체크 ON → 즉시(리로드 없이) 그 사이트 가격 감지 시작(storage.onChanged).
- 체크 OFF → 즉시 툴팁 중단·새 스캔 없음(기존 밑줄은 리로드 시 제거).

접근성: 체크박스 `<label>` 연결, 키보드 포커스 가능, disabled 시 aria-disabled.
