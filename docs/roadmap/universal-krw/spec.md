# universal-krw — spec

> 결정-완결(TBD 제로). 실행은 이 문서만 읽고 진행 가능.

## Goal
AliExpress/USD 전용 확장을 **① 사용자가 켠 임의 사이트에서 ② 어떤 통화든 → KRW** 호버 환산하도록 일반화한다. 기존 툴팁·테마·스캔·캐시 인프라 재사용, background 없이(INV-1).

## Architecture
단일 컴포넌트 `extension`(바닐라 JS MV2). 공유 순수 로직을 작은 모듈로 분리해 content script 와 팝업/옵션이 공유.

```
manifest.json         matches=<all_urls>, permissions += activeTab
currency.js  [신규]   심볼/ISO 감지 · parse · convert · format  (공유)
rates.js     [신규]   환율 fetch + 캐시(rates 맵 통째)          (공유)
sites.js     [신규]   allowlist 매칭·토글·기본 시드             (공유)
content.js            per-site 게이트 + 다통화 스캔/호버 (currency/rates/sites 소비)
popup.html/.js        per-site 토글 체크박스 + 환율 표시 + 테마 (currency/rates/sites 소비)
options.html/.js      showRateInfo + 테마 (기존, rate 라인 동적화)
tooltip.css           그대로
_locales/{ko,en}      일반 이름/설명
```

**모듈 로딩(빌드 없음):**
- content script: `manifest.content_scripts[0].js = ["currency.js","rates.js","sites.js","content.js"]` — 같은 isolated scope, 앞 파일의 top-level `var NS` 가 뒤에서 보임.
- 팝업/옵션: `<script src="currency.js">` … 순서로 포함, 전역 네임스페이스로 노출.
- 각 모듈은 전역 네임스페이스 객체로 노출: `var CurrencyKit = {...}` · `var RatesKit = {...}` · `var SitesKit = {...}` (content isolated world / extension page 양쪽 안전).

## Components (영향/신규)
- 영향: `content.js`, `popup.html/js`, `options.js`, `manifest.json`, `_locales/*`, `README.md`.
- 신규: `currency.js`, `rates.js`, `sites.js`.

## Invariants (프로파일 verbatim + 신규)
- **INV-1 (기존)**: background/service-worker 없이 content-script 단독. → 지킴: 선언적 content_scripts + 런타임 게이트 + `storage.onChanged`, 팝업은 `activeTab`. (ADR-0001)
- **INV-2 (신규 제안)**: content script 는 기본 inert; `location.hostname` 이 allowlist 서픽스 매칭일 때만 부수효과(스캔·리스너·DOM 변형)를 낸다. → `.cling/profile.md` Invariants 에 추가.

## Detection (currency.js) — ADR-0002
- `SYMBOL_TO_CURRENCY`: 고유 심볼 단일 매핑 + 모호심볼 기본값(`$`→USD, `¥`→JPY). §ADR-0002 목록.
- ISO 코드: 숫자 인접 3-letter 대문자를 잡아 `rates` 키에 있으면 채택(전 통화). 코드 > 심볼 우선.
- `detectCurrency(matchContext) → "USD"|"EUR"|…|null`.
- 정규식: 통화토큰(심볼 집합 ∪ ISO패턴) + 금액. 기존 `INLINE`/`WHOLE`/`SINGLE` 3형태를 통화토큰 파라미터화로 재구성.
- `parseAmount(raw)`: 기존 재사용.
- **KRW skip**: 감지 통화가 KRW 면 래핑/환산하지 않음(₩ 및 ISO KRW).

## Rate layer (rates.js) — ADR-0003
- 캐시 엔트리 `{ rates:{...}, fetchedAt }`, `CACHE_KEY="usdKrwRate"`, TTL 1h.
- `getRates(force?) → Promise<{rates, fetchedAt}>`: 캐시 유효하면 캐시, 아니면 `fetch(latest/USD)`. 구형 엔트리(`rates` 없음)면 재fetch.
- `convertToKRW(amount, src, rates)`: `rates.KRW`·`rates[src]` 검증 → `amount * rates.KRW / rates[src]`, 실패 시 null.
- `formatKRW(amount)`: 기존 재사용.
- content.js·popup.js 가 공유(동일 storage 캐시).

## Data Model / storage (SoT: 확장 로컬 storage)
- `usdKrwPrefs` (기존): `{ showRateInfo, theme }` — 유지.
- `usdKrwRate` (기존, 확장): `{ rates:{...}, fetchedAt }`.
- **`usdKrwSites` (신규)**: `{ [domain: string]: true }` allowlist. 기본 시드 = `{ "aliexpress.com": true, "aliexpress.us": true }`.
  - write: 팝업 토글. read: content.js(게이트) + 팝업(체크상태).
  - 매칭: `isEnabled(host, sites) = Object.keys(sites).some(d => sites[d] && (host===d || host.endsWith("."+d)))`.
  - 최초 실행 시드: `usdKrwSites` 미존재면 SitesKit 이 기본 시드로 간주(저장은 첫 토글 때 또는 즉시 1회).

## Reuse map
brief §재사용 map 참조. 툴팁/테마/스캔골격/캐시/DEBUG = 그대로, 정규식·dataset·캐시구조·manifest·이름 = 일반화.

## Scope / Non-goals
- Non-goal: 모호심볼 자동보정(TLD/lang), 사용자 심볼 기본값 UI, 타겟통화 KRW 외, allowlist 편집 UI(제거는 팝업 재토글로), 오프라인.

## Operations 영향
- 신규 install/run/connect 명령 없음. verify = `npx web-ext lint` 동일.
- manifest 권한 변경(matches→all_urls, +activeTab) → `web-ext lint` 검증. AMO 재심사 유발(ADR-0001/0004).
- 프로파일 Operations 갱신 불요(명령 불변).

## Test Strategy (프로파일: 자동테스트 없음)
- **verify gate**: `npx web-ext lint` error 0.
- **수동 QA 매트릭스**(임시 로드 후):
  1. aliexpress(시드) — 기존대로 USD 밑줄+호버 환산 동작(회귀).
  2. 임의 사이트에서 아이콘 클릭 → 팝업 체크 → 리로드 없이 가격 감지·밑줄·호버 환산 시작.
  3. ISO 코드(`EUR 10`, `10 SGD`) + 심볼(`€`, `£`, `¥`) 감지·환산.
  4. KRW 페이지(₩ 가격) — 래핑/환산 안 함.
  5. 체크 해제(live) → 호버 툴팁 중단, 새 스캔 없음.
  6. 서브도메인(`m.aliexpress.com`) — 도메인 시드로 커버.
  7. 미허용 사이트 — content script inert(콘솔에 스캔 로그 0).
  8. showRateInfo ON — rate 라인이 소스통화 반영(`1 EUR = X원`).

## Task Breakdown (경로 = repo 루트; 프로파일 Source layout)

### T1 — currency.js (공유 감지/환산 순수 로직)
- Files: `currency.js`(신규).
- Produces: `CurrencyKit = { SYMBOL_TO_CURRENCY, detectCurrency, parseAmount, buildPriceRegexes(), formatKRW, convertToKRW }`.
- Consumes: rates 맵(런타임 주입), ISO 검증용 rates 키.
- Acceptance: `detectCurrency` 가 ISO코드/고유심볼/모호기본값을 §ADR-0002 대로 반환, KRW 는 감지하되 호출측이 skip 판단 가능(반환 "KRW"). `convertToKRW` 교차식·null 처리. web-ext lint green.
- 의존: 없음.

### T2 — rates.js (환율 교차표 캐시)
- Files: `rates.js`(신규). content.js·popup.js 의 fetch/캐시 로직 이관.
- Produces: `RatesKit = { getRates(force), CACHE_KEY }`.
- Acceptance: `getRates` 가 `{rates,fetchedAt}` 반환, TTL·구형엔트리 재fetch, storage 캐시 공유. web-ext lint green.
- 의존: 없음.

### T3 — sites.js (allowlist 매칭/토글/시드)
- Files: `sites.js`(신규).
- Produces: `SitesKit = { SITES_KEY, DEFAULT_SITES, getSites(), isEnabled(host,sites), setSite(host,on), currentDomain(host) }`.
- Acceptance: 도메인 서픽스 매칭, 기본 시드 aliexpress.com/.us, setSite 가 도메인(등록가능 도메인 근사=host 그대로 또는 상위) 저장. web-ext lint green.
- 의존: 없음.

### T4 — content.js 일반화 + per-site 게이트
- Files: `content.js`.
- Consumes: CurrencyKit, RatesKit, SitesKit.
- 변경:
  - 로드 시 `SitesKit.getSites()` → `isEnabled(location.hostname)` false 면 inert(리스너/스캔/옵저버 0), 단 `storage.onChanged`(sites) 리스너만 등록해 라이브 activate 대기.
  - activate/deactivate 함수로 리스너·옵저버·SSR틱·스캔 묶어 토글.
  - 정규식 → `CurrencyKit.buildPriceRegexes()`, `dataset.usd` → `dataset.amount`+`dataset.currency`, `readLiveUsd`→`readLivePrice`(통화 포함).
  - 호버: `RatesKit.getRates()` → `CurrencyKit.convertToKRW(amount, cur, rates)` → 툴팁. rate 라인 `1 <cur> = X원`(showRateInfo).
  - KRW 감지 시 skip.
- Acceptance: QA 매트릭스 1·2·3·4·5·7·8 통과. web-ext lint green.
- 의존: T1, T2, T3.

### T5 — 팝업 per-site 토글 + 옵션 동적화 + manifest
- Files: `popup.html`, `popup.js`, `options.js`, `manifest.json`.
- 변경:
  - popup: 상단에 **"이 사이트에서 가격 변환 표시" 체크박스**. `browser.tabs.query({active,currentWindow})`(activeTab)로 hostname → `SitesKit.isEnabled` 반영, 토글 시 `SitesKit.setSite` 저장(→ content live 반응). 무URL 탭(about: 등)이면 체크박스 disabled + 안내. 기존 환율/테마 유지, fetch/캐시는 RatesKit 로.
  - options: rate 라인 문구를 소스통화 반영 가능하게(미리보기 문구 일반화). showRateInfo 유지.
  - manifest: `content_scripts[0].matches=["<all_urls>"]`, `js` 배열에 currency/rates/sites 추가, `permissions` += `activeTab`(호스트 `open.er-api.com`·all_urls·storage 유지), version bump(0.9.0).
- Acceptance: QA 2·5·6, 팝업이 활성탭 hostname 정확 표시·토글, manifest web-ext lint green.
- 의존: T2, T3 (표시엔 T1).

### T6 — 브랜딩/locales/README (ADR-0004)
- Files: `_locales/ko/messages.json`, `_locales/en/messages.json`, `README.md`.
- 변경: extensionName·extensionDescription·actionTitle 일반화(gecko id 고정), description 에 "켠 사이트에서만 동작" 명시. README 제목·기능·구조·권한 표 갱신.
- Acceptance: web-ext lint green, 이름/설명 일반화 확인.
- 의존: 없음(독립).

## 의존 DAG
```
T1 ─┐
T2 ─┼─▶ T4 ─┐
T3 ─┘        ├─▶ (QA)
T2,T3(,T1) ─▶ T5 ─┘
T6 (독립, 아무때나)
```

## 외부 의존
- `open.er-api.com/v6/latest/USD` (기존) — 응답 `rates` 맵. 무료·키 불요·CORS 허용.
- 신규 라이브러리 0.
