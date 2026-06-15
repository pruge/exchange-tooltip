// 파싱 즉시 한 번 — 이게 안 찍히면 content script 자체가 주입되지 않은 것
console.log("[USD→KRW] init v0.8.4 (live USD re-parse) — script parsed @", location.href);

(() => {
  "use strict";

  // 인라인 가격: 문장 중간의 "$12.34" 형태
  const INLINE_PRICE_REGEX = /(?:US\s*\$|USD\s*|\$)\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/gi;
  // 전체 일치(요소 통째): " US $12.34 " 또는 " $12.34 " — 통화기호와 숫자만
  const WHOLE_PRICE_REGEX = /^\s*(?:US\s*\$|USD\s*|\$)\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*$/i;

  const PROCESSED_ATTR = "data-usdkrw-processed";
  const PRICE_CLASS = "usdkrw-price";
  const SCAN_DEBOUNCE_MS = 200;
  const MAX_TEXT_NODE_LEN = 200;
  const MAX_ELEMENT_TEXT_LEN = 40;

  const RATE_API = "https://open.er-api.com/v6/latest/USD";
  const CACHE_KEY = "usdKrwRate";
  const PREFS_KEY = "usdKrwPrefs";
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

  // 기본 설정
  const VALID_THEMES = ["dark", "soft-dark", "blue", "warm"];
  const DEFAULT_PREFS = { showRateInfo: false, theme: "warm" };
  let prefs = { ...DEFAULT_PREFS };

  function applyTheme() {
    if (!tooltipEl) return;
    for (const t of VALID_THEMES) {
      tooltipEl.classList.remove(`usdkrw-theme-${t}`);
    }
    const theme = VALID_THEMES.includes(prefs.theme) ? prefs.theme : DEFAULT_PREFS.theme;
    tooltipEl.classList.add(`usdkrw-theme-${theme}`);
  }

  async function loadPrefs() {
    try {
      const stored = await browser.storage.local.get(PREFS_KEY);
      if (stored && stored[PREFS_KEY]) {
        prefs = { ...DEFAULT_PREFS, ...stored[PREFS_KEY] };
      }
    } catch {
      /* 무시 — 기본값 유지 */
    }
    applyTheme();
  }

  // 옵션 페이지에서 변경되면 즉시 반영
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[PREFS_KEY]) {
        prefs = { ...DEFAULT_PREFS, ...changes[PREFS_KEY].newValue };
        applyTheme();
      }
    });
  }

  const DEBUG = (() => {
    try {
      return localStorage.getItem("usdkrwDebug") === "1";
    } catch {
      return false;
    }
  })();
  const log = (...args) => {
    if (DEBUG) console.log("[USD→KRW]", ...args);
  };

  let ratePromise = null;
  let scanTimer = null;
  let tooltipEl = null;

  async function loadCachedRate() {
    try {
      const stored = await browser.storage.local.get(CACHE_KEY);
      const entry = stored && stored[CACHE_KEY];
      if (!entry) return null;
      if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
      return entry;
    } catch {
      return null;
    }
  }

  async function fetchFreshRate() {
    const res = await fetch(RATE_API, { cache: "no-store" });
    if (!res.ok) throw new Error(`rate api ${res.status}`);
    const data = await res.json();
    const krw = data && data.rates && data.rates.KRW;
    if (typeof krw !== "number") throw new Error("KRW missing");
    const entry = { rate: krw, fetchedAt: Date.now() };
    try {
      await browser.storage.local.set({ [CACHE_KEY]: entry });
    } catch {
      /* storage 실패해도 환율은 사용 가능 */
    }
    return entry;
  }

  function getRate() {
    if (!ratePromise) {
      ratePromise = (async () => {
        const cached = await loadCachedRate();
        if (cached) {
          log("rate from cache", cached);
          return cached;
        }
        const fresh = await fetchFreshRate();
        log("rate from API", fresh);
        return fresh;
      })().catch((err) => {
        ratePromise = null;
        throw err;
      });
    }
    return ratePromise;
  }

  function formatKRW(amount) {
    return new Intl.NumberFormat("ko-KR", {
      style: "currency",
      currency: "KRW",
      maximumFractionDigits: 0,
    }).format(Math.round(amount));
  }

  function parseAmount(raw) {
    const cleaned = raw.replace(/[,\s]/g, "");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function ensureTooltip() {
    if (tooltipEl) return tooltipEl;
    tooltipEl = document.createElement("div");
    tooltipEl.className = "usdkrw-tooltip";
    tooltipEl.setAttribute("role", "tooltip");
    const main = document.createElement("div");
    main.className = "usdkrw-tooltip__main";
    const sub = document.createElement("div");
    sub.className = "usdkrw-tooltip__sub";
    tooltipEl.appendChild(main);
    tooltipEl.appendChild(sub);
    document.documentElement.appendChild(tooltipEl);
    applyTheme();
    return tooltipEl;
  }

  // 마우스 위치 추적 — 툴팁이 커서를 따라다니도록
  let mouseX = 0;
  let mouseY = 0;
  let positionRaf = null;
  const CURSOR_OFFSET = 18; // 커서로부터 떨어진 거리

  function showTooltip(mainText, subText) {
    const el = ensureTooltip();
    el.querySelector(".usdkrw-tooltip__main").textContent = mainText;
    const subEl = el.querySelector(".usdkrw-tooltip__sub");
    if (subText) {
      subEl.textContent = subText;
      subEl.style.display = "";
    } else {
      subEl.textContent = "";
      subEl.style.display = "none";
    }
    el.classList.add("usdkrw-tooltip--visible");
    positionAtMouse();
  }

  function hideTooltip() {
    if (!tooltipEl) return;
    tooltipEl.classList.remove("usdkrw-tooltip--visible");
  }

  function positionAtMouse() {
    if (!tooltipEl) return;
    const tipRect = tooltipEl.getBoundingClientRect();
    const viewportW = document.documentElement.clientWidth;

    // 커서 위 중앙
    let top = mouseY + window.scrollY - tipRect.height - CURSOR_OFFSET;
    let left = mouseX + window.scrollX - tipRect.width / 2;

    // 위쪽 공간 부족하면 커서 아래로
    if (top < window.scrollY + 4) {
      top = mouseY + window.scrollY + CURSOR_OFFSET;
    }
    // 좌우 화면 밖으로 안 나가게 클램프 (중앙 정렬 유지하면서)
    const minLeft = window.scrollX + 4;
    const maxLeft = window.scrollX + viewportW - tipRect.width - 4;
    if (left < minLeft) left = minLeft;
    if (left > maxLeft) left = maxLeft;

    tooltipEl.style.top = `${top}px`;
    tooltipEl.style.left = `${left}px`;
  }

  function scheduleReposition() {
    if (positionRaf) return;
    positionRaf = requestAnimationFrame(() => {
      positionRaf = null;
      if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) {
        positionAtMouse();
      }
    });
  }

  function findPriceTarget(node) {
    if (!(node instanceof HTMLElement)) return null;
    return node.closest(`.${PRICE_CLASS}`);
  }

  // 호버 시점의 textContent 에서 USD 를 다시 파싱.
  // 알리가 수량 변경 등으로 가격을 동적 업데이트 해도 정확한 값을 잡기 위함.
  // 못 잡으면 스캔 때 저장한 dataset.usd 로 fallback.
  const SINGLE_PRICE_REGEX = /(?:US\s*\$|USD\s*|\$)\s*(\d{1,3}(?:[,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)/i;
  function readLiveUsd(el) {
    const txt = el.textContent;
    if (txt) {
      const m = txt.match(WHOLE_PRICE_REGEX) || txt.match(SINGLE_PRICE_REGEX);
      if (m) {
        const live = parseAmount(m[1]);
        if (live !== null) {
          if (el.dataset.usd !== String(live)) {
            el.dataset.usd = String(live);
            log("dataset.usd refreshed", live);
          }
          return live;
        }
      }
    }
    const cached = parseFloat(el.dataset.usd);
    return Number.isFinite(cached) ? cached : null;
  }

  function handleMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) {
      scheduleReposition();
    }
  }

  function handleHover(event) {
    const el = findPriceTarget(event.target);
    if (!el) return;
    const usd = readLiveUsd(el);
    if (usd === null) return;

    // hover 진입 시점의 마우스 위치 캡처
    mouseX = event.clientX;
    mouseY = event.clientY;

    showTooltip("환율 조회 중…", null);
    getRate().then(
      ({ rate }) => {
        const krw = formatKRW(usd * rate);
        const sub = prefs.showRateInfo ? `1 USD = ${rate.toFixed(2)}원` : null;
        showTooltip(krw, sub);
      },
      (err) => {
        showTooltip("환율 조회 실패", String((err && err.message) || err));
      }
    );
  }

  function handleLeave(event) {
    if (findPriceTarget(event.target)) hideTooltip();
  }

  function isInsideSkipZone(el) {
    return Boolean(
      el.closest("script, style, noscript, textarea, input, .usdkrw-tooltip, .usdkrw-price")
    );
  }

  // ----- 패스 1: 텍스트 노드 안에서 부분 매칭 -----

  function wrapMatchesInTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.length > MAX_TEXT_NODE_LEN) return 0;
    INLINE_PRICE_REGEX.lastIndex = 0;
    if (!INLINE_PRICE_REGEX.test(text)) return 0;
    INLINE_PRICE_REGEX.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match;
    let count = 0;
    while ((match = INLINE_PRICE_REGEX.exec(text)) !== null) {
      const [full, amountStr] = match;
      const start = match.index;
      if (start > lastIdx) {
        frag.appendChild(document.createTextNode(text.slice(lastIdx, start)));
      }
      const amount = parseAmount(amountStr);
      if (amount === null) {
        frag.appendChild(document.createTextNode(full));
      } else {
        const span = document.createElement("span");
        span.className = PRICE_CLASS;
        span.dataset.usd = String(amount);
        span.textContent = full;
        frag.appendChild(span);
        count += 1;
      }
      lastIdx = start + full.length;
    }
    if (lastIdx < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx)));
    }
    const parent = textNode.parentNode;
    if (!parent) return 0;
    parent.setAttribute(PROCESSED_ATTR, "1");
    parent.replaceChild(frag, textNode);
    return count;
  }

  function scanTextNodes(root) {
    let count = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (isInsideSkipZone(parent)) return NodeFilter.FILTER_REJECT;
        if (parent.closest(`[${PROCESSED_ATTR}]`)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.includes("$")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const targets = [];
    let cur = walker.nextNode();
    while (cur) {
      targets.push(cur);
      cur = walker.nextNode();
    }
    for (const node of targets) count += wrapMatchesInTextNode(node);
    return count;
  }

  // ----- 패스 2: 작은 요소 통째 매칭 (split-span 케이스) -----

  function tagElementAsPrice(el, amount) {
    el.classList.add(PRICE_CLASS);
    el.dataset.usd = String(amount);
  }

  function tryTagAsPrice(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.classList.contains(PRICE_CLASS)) return false;
    if (isInsideSkipZone(el.parentElement ?? el)) return false;
    if (el.querySelector(`.${PRICE_CLASS}`)) return false;
    const txt = el.textContent;
    if (!txt) return false;
    if (txt.length > MAX_ELEMENT_TEXT_LEN) return false;
    if (!txt.includes("$")) return false;
    const m = txt.match(WHOLE_PRICE_REGEX);
    if (!m) return false;
    const amount = parseAmount(m[1]);
    if (amount === null) return false;
    tagElementAsPrice(el, amount);
    return true;
  }

  // 알리익스프레스에서 본 가격 클래스 fast path
  const ALI_PRICE_SELECTORS = [
    "[class*='PI-price-text']",
    "[class*='PI-ori-price-text']",
    "[class*='price-text']",
    "[class*='SnowPrice']",
    "[class*='snow-price']",
    "[class*='Price__main']",
  ].join(",");

  function scanElements(root) {
    let count = 0;
    // 1) 알리 전용 클래스 우선 시도
    for (const el of root.querySelectorAll(ALI_PRICE_SELECTORS)) {
      if (tryTagAsPrice(el)) count += 1;
    }
    // 2) 일반 작은 요소 전수 스캔 (구조가 달라도 잡히도록)
    for (const el of root.querySelectorAll("span, div, em, strong, b, p, a, bdi")) {
      if (tryTagAsPrice(el)) count += 1;
    }
    return count;
  }

  // ----- 통합 -----

  let totalTagged = 0;
  function scan(root = document.body) {
    if (!root) return;
    const t0 = performance.now();
    const inline = scanTextNodes(root);
    const whole = scanElements(root);
    const dt = (performance.now() - t0).toFixed(1);
    totalTagged += inline + whole;
    if (inline + whole > 0) {
      // 매칭이 생기면 무조건 한 줄 찍어 사용자가 동작 여부 확인 가능
      console.log(`[USD→KRW] +${inline + whole} 가격 발견 (누적 ${totalTagged}) — ${dt}ms`);
    } else if (DEBUG) {
      log(`scan in ${dt}ms — 0 매칭`);
    }
  }

  function scheduleScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  }

  function init() {
    // 확장이 로드됐는지 사용자가 즉시 확인할 수 있도록 무조건 한 줄 출력
    console.log(
      "[USD→KRW] content script loaded —",
      location.host,
      DEBUG ? "(debug ON)" : "(debug OFF · localStorage.usdkrwDebug='1' 로 켜기)"
    );
    loadPrefs(); // 비동기, 첫 호버 전엔 기본값으로 동작
    scan();

    // SSR/late-render 대응: 첫 30초 동안 주기적 재스캔
    let safetyTicks = 0;
    const safetyTimer = setInterval(() => {
      scan();
      safetyTicks += 1;
      if (safetyTicks >= 15) clearInterval(safetyTimer); // 2초 × 15 = 30초
    }, 2000);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (
          (m.type === "childList" && m.addedNodes.length) ||
          (m.type === "characterData")
        ) {
          scheduleScan();
          break;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    document.addEventListener("mouseover", handleHover, true);
    document.addEventListener("mouseout", handleLeave, true);
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener(
      "scroll",
      () => {
        if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) hideTooltip();
      },
      { passive: true }
    );

    // SPA 네비게이션 대응
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        log("URL changed, rescanning");
        scheduleScan();
      }
    }, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
