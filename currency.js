// currency.js — 공유 통화 감지/환산 순수 로직 (CurrencyKit)
// content script(manifest js 배열) + 팝업/옵션(<script src>) 양쪽에서 전역으로 소비.
// 브라우저 API 의존 없음 — 순수 함수. (ADR-0002)
var CurrencyKit = (() => {
  "use strict";

  // 심볼 → ISO. 모호심볼은 기본값($→USD, ¥→JPY). 다글자 심볼(US$·R$)은 공백 제거 후 키 매칭.
  const SYMBOL_TO_CURRENCY = {
    "US$": "USD",
    "R$": "BRL",
    "$": "USD", // 모호 → 기본 USD
    "¥": "JPY", // 모호 → 기본 JPY (CNY 아님)
    "€": "EUR",
    "£": "GBP",
    "₩": "KRW",
    "₹": "INR",
    "₽": "RUB",
    "₺": "TRY",
    "฿": "THB",
    "₫": "VND",
    "₴": "UAH",
    "₪": "ILS",
  };

  // ISO 4217 활성 코드 — ISO 코드 감지 = 전 통화 자동 지원. 실제 환산 가능 여부는
  // convertToKRW 가 rates 맵으로 최종 검증(미지원이면 null). 오탐 최소화용 화이트리스트.
  const KNOWN_CODES = new Set(
    ("AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB " +
      "BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP " +
      "DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HRK HTG " +
      "HUF IDR ILS IMP INR IQD IRR ISK JEP JMD JOD JPY KES KGS KHR KMF KPW KRW KWD " +
      "KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK " +
      "MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON " +
      "RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SYP SZL THB " +
      "TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD " +
      "XOF XPF YER ZAR ZMW ZWL").split(" ")
  );

  // 금액 패턴: 미국식(1,234.56)·유럽식(1.234,56·512,00) 모두 캡처.
  // 구분자(. , 공백)로 천단위 그룹(정확히 3자리, +로 최소 1개) → 소수부(., 1~2자리) 옵션,
  // 또는 그룹 없는 정수 + 소수부(. 또는 ,). 실제 소수/천단위 판별은 parseAmount 가 함.
  // 천단위 그룹에 + 요구 → 구분자 없는 "5000" 이 "500" 으로 잘리지 않고 둘째 대안으로.
  const NUM = "\\d{1,3}(?:[.,\\s]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d+)?";

  // 심볼 대안(정규식 source, 이미 이스케이프됨). 다글자(US$·R$) 먼저.
  const SYM = ["US\\s*\\$", "R\\$", "\\$", "€", "£", "¥", "₩", "₹", "₽", "₺", "฿", "₫", "₴", "₪"];
  const symAlt = SYM.join("|");

  // ISO 코드 경계: prefix 는 앞 경계만(그래야 "EUR12" 도 잡히고 "EUROPE 12" 는 안 잡힘),
  // suffix 는 뒤 경계만(그래야 "12EUR" 잡히고 "12 EURO" 는 안 잡힘). i 플래그 금지(대문자 코드만).
  // prefix: ISO코드(+선택적 심볼, 예 "USD $")  또는  심볼. 코드는 앞 경계만(→ "EUR12" 도 잡힘).
  const PRE_TOKEN = `(?:\\b[A-Z]{3}(?:\\s*(?:${symAlt}))?|${symAlt})`;
  const SUF_TOKEN = `(?:${symAlt}|[A-Z]{3}\\b)`;
  const PREFIX = `(${PRE_TOKEN})\\s*(${NUM})`; // g1=token, g2=amount
  const SUFFIX = `(${NUM})\\s*(${SUF_TOKEN})`; // g3=amount, g4=token
  const COMBINED = `(?:${PREFIX}|${SUFFIX})`;

  // 매 호출 새 RegExp — lastIndex 공유 사고 방지.
  function buildPriceRegexes() {
    return {
      inline: new RegExp(COMBINED, "g"), // 텍스트 노드 내 부분 매칭(전역)
      whole: new RegExp(`^\\s*${COMBINED}\\s*$`), // 요소 통째 매칭(앵커)
      single: new RegExp(COMBINED), // 첫 매칭 재파싱
    };
  }

  function detectCurrency(token) {
    if (!token) return null;
    const t = token.replace(/\s+/g, ""); // "USD $" → "USD$", "US $" → "US$"
    if (SYMBOL_TO_CURRENCY[t]) return SYMBOL_TO_CURRENCY[t]; // "US$"·"$"·"€"·"R$"…
    // 코드+심볼 혼합("USD$")이거나 순수 코드("EUR") → ISO 코드 우선.
    const code = t.match(/[A-Z]{3}/);
    if (code && KNOWN_CODES.has(code[0])) return code[0];
    return null;
  }

  // 단일 구분자 해석: "512,00"→소수(1~2자리) vs "1,234"→천단위(3자리).
  function resolveSingle(s, sep) {
    const parts = s.split(sep);
    if (parts.length === 2 && parts[1].length <= 2 && parts[0].length >= 1) {
      return parts[0] + "." + parts[1]; // 소수 구분자
    }
    return parts.join(""); // 천단위 → 제거
  }

  // 미국식(1,234.56)·유럽식(1.234,56·512,00) 금액 문자열 → number.
  function parseAmount(raw) {
    let s = String(raw).replace(/\s/g, ""); // nbsp 포함 공백 제거
    if (!s) return null;
    const hasDot = s.includes(".");
    const hasComma = s.includes(",");
    if (hasDot && hasComma) {
      // 마지막에 오는 구분자가 소수점.
      if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
        s = s.replace(/\./g, "").replace(/,/g, "."); // 유럽식: 콤마=소수
      } else {
        s = s.replace(/,/g, ""); // 미국식: 점=소수
      }
    } else if (hasComma) {
      s = resolveSingle(s, ",");
    } else if (hasDot) {
      s = resolveSingle(s, ".");
    }
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  // buildPriceRegexes 로 얻은 정규식의 match 배열을 해석 → {raw, token, amountStr, amount, currency}
  function interpret(m) {
    if (!m) return null;
    const isPre = m[1] !== undefined;
    const token = isPre ? m[1] : m[4];
    const amountStr = isPre ? m[2] : m[3];
    return {
      raw: m[0],
      token,
      amountStr,
      amount: parseAmount(amountStr),
      currency: detectCurrency(token),
    };
  }

  // amount(src 통화) → KRW. rates = er-api latest/USD 의 rates 맵(1 USD 기준 각 통화). (ADR-0003)
  function convertToKRW(amount, src, rates) {
    if (!rates || typeof amount !== "number" || !Number.isFinite(amount)) return null;
    const krwPerUsd = rates.KRW;
    const srcPerUsd = rates[src];
    if (typeof krwPerUsd !== "number" || typeof srcPerUsd !== "number" || srcPerUsd === 0) {
      return null;
    }
    return (amount * krwPerUsd) / srcPerUsd;
  }

  function formatKRW(amount) {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  }

  return {
    SYMBOL_TO_CURRENCY,
    KNOWN_CODES,
    buildPriceRegexes,
    detectCurrency,
    parseAmount,
    interpret,
    convertToKRW,
    formatKRW,
  };
})();
