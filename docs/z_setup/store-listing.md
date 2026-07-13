# AMO 스토어 리스팅 문구 (v0.9.x)

> 공개 스토어(addons.mozilla.org) 리스팅에 붙여넣는 요약·설명. 기능 변경 시 함께 갱신.

## 한국어 (ko)

### 요약 (Summary)
어떤 사이트에서든 원하는 통화(USD·EUR·JPY·GBP 등) 가격에 마우스를 올리면 원화(₩) 환산 금액을 툴팁으로 바로 보여줍니다. 사이트별로 켜서 쓰는 방식이라, 여러분이 켠 사이트에서만 동작합니다.

### 상세 설명 (Description)
**해외 쇼핑·가격 페이지의 외화를 원화로, 마우스 호버 한 번에.**

USD·EUR·JPY·GBP… 매번 계산기 두드리기 번거로우셨죠. 이 확장은 가격 위에 마우스를 올리기만 하면 실시간 환율로 환산한 원화 금액을 툴팁으로 보여줍니다.

**주요 기능**
- 🌐 모든 사이트 — 여러분이 켠 사이트라면 어디서든 동작 (AliExpress 는 기본 켜짐)
- 💱 다통화 지원 — `$` `€` `£` `¥` 기호는 물론 `USD`·`EUR`·`SGD` 등 통화 코드까지 자동 인식. 유럽식(`512,00 €`)·미국식(`$1,299.00`) 숫자 표기 모두 처리
- 🖱️ 부드러운 호버 툴팁 — 커서를 따라 자연스럽게 움직이는 원화 환산 표시
- 🔒 사이트별 켜기(opt-in) — 툴바 아이콘 → "이 사이트에서 가격 변환 표시" 체크. 켠 사이트에서만 동작
- 🎨 4가지 테마 — 다크 / 소프트 다크 / 블루 / 웜 그레이
- ⚙️ 환율 정보 라인 토글, 도구바 팝업에서 현재 환율 확인·새로고침

**사용법**
1. 가격을 원화로 보고 싶은 사이트로 이동
2. 툴바 아이콘 클릭 → "이 사이트에서 가격 변환 표시" 체크
3. 가격 위에 마우스를 올리면 원화 환산 툴팁 표시

**개인정보**
개인정보를 전혀 수집·전송하지 않습니다. 환율 정보만 공개 환율 API(open.er-api.com)에서 가져오며, 어떤 사용자 데이터도 외부로 보내지 않습니다. 백그라운드 스크립트 없이 동작합니다.

외부 라이브러리·프레임워크·CDN·추적 코드를 전혀 사용하지 않은 **순수 바닐라 JavaScript** 로 작성했으며, 브라우저 내장 기능만 사용합니다. 코드에서 이뤄지는 유일한 외부 통신은 위 환율 조회(받아오기)뿐입니다.

**권한 안내**
"모든 사이트 접근" 권한을 요청하지만, 실제로는 여러분이 직접 켠 사이트에서만 가격을 인식합니다. 켜기 전에는 어떤 사이트에서도 동작하지 않습니다.

---

## English (en)

### Summary
Hover over any currency price (USD, EUR, JPY, GBP, and more) on the sites you enable to instantly see the amount converted to Korean Won (₩) in a tooltip. It runs only on the sites you turn on.

### Description
**Turn foreign prices into Korean Won with a single hover.**

Tired of reaching for a calculator every time you shop abroad? Hover over any price and this add-on shows the Korean Won equivalent — using live exchange rates — right in a tooltip.

**Key features**
- 🌐 Any site — works anywhere you enable it (AliExpress is on by default)
- 💱 Multi-currency — recognizes symbols (`$` `€` `£` `¥`) and ISO codes (`USD`, `EUR`, `SGD`…). Handles both European (`512,00 €`) and US (`$1,299.00`) number formats
- 🖱️ Smooth hover tooltip that follows your cursor
- 🔒 Per-site opt-in — click the toolbar icon → check "Show price conversion on this site." Runs only where you turn it on
- 🎨 Four themes — Dark / Soft Dark / Blue / Warm Gray
- ⚙️ Toggle the rate info line; check and refresh the current rate from the toolbar popup

**How to use**
1. Go to a site where you want to see prices in KRW
2. Click the toolbar icon → check "Show price conversion on this site"
3. Hover over a price to see the KRW tooltip

**Privacy**
Collects and transmits no personal data. It only fetches exchange rates from a public API (open.er-api.com) and sends no user data anywhere. Runs without any background script.

Built with **pure vanilla JavaScript** — no external libraries, frameworks, CDNs, or tracking code, using only built-in browser APIs. The only outbound request the code makes is the exchange-rate lookup above.

**Permissions**
It requests "access to all sites," but in practice it only reads prices on the sites you enable yourself. Before you turn a site on, it does nothing anywhere.
