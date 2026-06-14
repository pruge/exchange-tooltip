# AliExpress USD → KRW Hover

알리익스프레스에서 달러 가격에 마우스를 올리면 원화 환산 금액을 툴팁으로 보여주는 Firefox 확장 프로그램.

알리익스프레스를 USD 로 설정하고 결제할 때 카드 환율이 더 유리한 경우가 있는데, 매번 환산해보기 번거로워서 만들었습니다.

## 기능

- AliExpress 의 모든 `$`, `US $`, `USD` 가격 자동 감지 (단일 텍스트, 여러 span 으로 쪼개진 가격 모두)
- 마우스 호버 시 원화 환산 툴팁 표시, 커서 위 중앙 유지하며 부드럽게 따라옴
- 환율 자동 fetch + 1시간 캐시 (`open.er-api.com`)
- 4가지 테마: 다크 / 소프트 다크 / 블루 톤 / 웜 그레이
- 옵션: 환율 정보 라인 표시/숨김 토글
- 도구바 팝업에서 현재 환율 확인 + 새로고침 + 테마 빠른 선택

## 설치

[Releases](https://github.com/pruge/exchange-tooltip/releases) 에서 최신 `.xpi` 다운로드 후:

1. Firefox 에서 `about:addons`
2. 우측 상단 톱니바퀴 ⚙ 클릭
3. **"파일에서 부가 기능 설치"** 선택
4. 다운로드한 `.xpi` 선택 → 추가

## 사용법

1. AliExpress 의 USD 표시 페이지로 이동
2. 가격 위에 마우스 hover → 원화 환산 툴팁 표시
3. 도구바의 말풍선 아이콘 클릭 → 현재 환율과 테마 변경
4. `about:addons` → 확장 항목 → **환경설정** → 세부 옵션 (환율 정보 표시 토글)

## 권한

| 권한 | 용도 |
|---|---|
| `*://*.aliexpress.com/*` `*://*.aliexpress.us/*` | 알리익스프레스 페이지 가격 스캔 |
| `*://open.er-api.com/*` | 환율 API 호출 |
| `storage` | 환율 캐시 + 사용자 옵션 저장 |

백그라운드 스크립트 없이 content script 단독으로 동작합니다.

## 개발

```bash
# 임시 로드 (개발용)
# about:debugging → "임시 부가 기능 로드" → manifest.json 선택

# AMO unlisted 서명 (영구 설치용 XPI 생성)
npx web-ext sign \
  --api-key=<JWT_ISSUER> \
  --api-secret=<JWT_SECRET> \
  --channel=unlisted \
  --ignore-files "docs/**" "*.xpi" "web-ext-artifacts/**"
```

API 키는 https://addons.mozilla.org/developers/addon/api/key/ 에서 발급.

## 구조

```
manifest.json     # MV2
content.js        # DOM 스캔, 가격 감지, 호버 툴팁
tooltip.css       # 4가지 테마 (CSS 변수)
popup.html/.js    # 도구바 팝업
options.html/.js  # 상세 옵션 페이지
icons/icon.svg    # 말풍선 아이콘
```

## 디버그

알리 페이지 콘솔에서:

```js
localStorage.usdkrwDebug = '1'
location.reload()
```

스캔 결과와 환율 조회 상세 로그가 콘솔에 찍힙니다.
