# 원화 환산 — 환율 호버

**켠 사이트에서** 어떤 통화 가격이든 마우스를 올리면 원화 환산 금액을 툴팁으로 보여주는 Firefox 확장 프로그램.

해외 쇼핑·가격 페이지에서 USD·EUR·JPY·GBP 같은 외화를 매번 원화로 환산해보기 번거로워서 만들었습니다. 기본적으로 아무 사이트도 건드리지 않고, **툴바 아이콘 → "이 사이트에서 가격 변환 표시"** 를 켠 사이트에서만 동작합니다.

## 기능

- **모든 사이트**(사용자가 켠 사이트)에서 가격 자동 감지 — 단일 텍스트, 여러 span 으로 쪼개진 가격 모두
- **다통화**: ISO 코드(`USD`·`EUR`·`SGD`…)는 전 통화 자동, 흔한 심볼(`$` `€` `£` `¥` `₹` `R$` …)도 감지. 모호한 `$`는 USD, `¥`는 JPY 기본
- 마우스 호버 시 원화 환산 툴팁 표시, 커서 위 중앙 유지하며 부드럽게 따라옴
- **사이트별 opt-in**: 툴바 팝업에서 현재 사이트 켜기/끄기 — 리로드 없이 즉시 반영. 한국 원화(₩) 가격은 변환하지 않음
- 환율 자동 fetch + 1시간 캐시 (`open.er-api.com`, 1 USD 기준 교차 환산)
- 4가지 테마: 다크 / 소프트 다크 / 블루 톤 / 웜 그레이
- 옵션: 환율 정보 라인(예: `1 USD = N원`) 표시/숨김 토글
- 도구바 팝업에서 현재 환율 확인 + 새로고침 + 테마 빠른 선택

## 설치

[Releases](https://github.com/pruge/exchange-tooltip/releases) 에서 최신 `.xpi` 다운로드 후:

1. Firefox 에서 `about:addons`
2. 우측 상단 톱니바퀴 ⚙ 클릭
3. **"파일에서 부가 기능 설치"** 선택
4. 다운로드한 `.xpi` 선택 → 추가

## 사용법

1. 가격을 원화로 보고 싶은 사이트로 이동
2. 도구바의 아이콘 클릭 → **"이 사이트에서 가격 변환 표시"** 체크
3. 가격 위에 마우스 hover → 원화 환산 툴팁 표시
4. 팝업에서 현재 환율 확인 + 테마 변경
5. `about:addons` → 확장 항목 → **환경설정** → 세부 옵션 (환율 정보 표시 토글)

> AliExpress(`aliexpress.com` / `aliexpress.us`)는 기본으로 켜져 있습니다.

## 권한

| 권한 | 용도 |
|---|---|
| `<all_urls>` | 사용자가 켠 사이트의 가격 스캔 (실제 동작은 켠 사이트에만 국한 — 켜기 전엔 아무 것도 하지 않음) |
| `activeTab` | 팝업에서 현재 탭 주소를 읽어 이 사이트가 켜졌는지 표시 |
| `storage` | 환율 캐시 + 사용자 옵션(테마·환율정보·켠 사이트 목록) 저장 |

환율 API(`open.er-api.com`) 호출은 `<all_urls>` 권한으로 커버됩니다. **백그라운드 스크립트 없이 content script 단독**으로 동작합니다.

## 개발

```bash
# 임시 로드 (개발용)
# about:debugging → "임시 부가 기능 로드" → manifest.json 선택
# 또는: npx web-ext run

# AMO 서명 (영구 설치용 XPI 생성)
npx web-ext sign \
  --api-key=<JWT_ISSUER> \
  --api-secret=<JWT_SECRET> \
  --channel=unlisted \
  --ignore-files "docs/**" ".cling/**" ".claude/**" "*.xpi" "web-ext-artifacts/**"
```

API 키는 https://addons.mozilla.org/developers/addon/api/key/ 에서 발급.

## 구조

```
manifest.json     # MV2
currency.js       # 통화 감지(심볼·ISO) · 교차 환산 · 포맷  (공유 모듈)
rates.js          # 환율 fetch + 캐시(rates 맵 통째)        (공유 모듈)
sites.js          # per-site allowlist 매칭 · 토글 · 시드     (공유 모듈)
content.js        # per-site 게이트 · DOM 스캔 · 호버 툴팁
tooltip.css       # 4가지 테마 (CSS 변수)
popup.html/.js    # 도구바 팝업 (사이트 토글 · 환율 · 테마)
options.html/.js  # 상세 옵션 페이지
icons/            # 아이콘
```

공유 모듈(`currency`·`rates`·`sites`)은 content script(manifest `js` 배열)와 팝업(`<script src>`)이 함께 소비합니다.

## 디버그

가격 페이지 콘솔에서:

```js
localStorage.usdkrwDebug = '1'
location.reload()
```

스캔 결과와 환율 조회 상세 로그가 콘솔에 찍힙니다.
