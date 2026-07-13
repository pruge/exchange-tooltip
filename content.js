// 파싱 즉시 한 번 — 이게 안 찍히면 content script 자체가 주입되지 않은 것
console.log("[→KRW] init v0.9.0 (multi-currency · per-site) — script parsed @", location.href);

(() => {
  "use strict";

  // 공유 모듈(manifest js 배열에서 content.js 앞에 로드): CurrencyKit · RatesKit · SitesKit.

  const PROCESSED_ATTR = "data-usdkrw-processed";
  const PRICE_CLASS = "usdkrw-price";
  const SCAN_DEBOUNCE_MS = 200;
  const MAX_TEXT_NODE_LEN = 200;
  const MAX_ELEMENT_TEXT_LEN = 40;

  const PREFS_KEY = "usdKrwPrefs";
  const VALID_THEMES = ["dark", "soft-dark", "blue", "warm"];
  const DEFAULT_PREFS = { showRateInfo: false, theme: "warm" };
  let prefs = { ...DEFAULT_PREFS };

  // 통화/가격 정규식 — 모듈에서 1회 빌드해 재사용. (inline=전역, whole/single=비전역)
  const regexes = CurrencyKit.buildPriceRegexes();
  // 텍스트 노드 fast-reject 힌트: 통화 심볼 또는 3연속 대문자(ISO 후보)가 있어야 가격 가능성.
  const CURRENCY_HINT = /[$€£¥₩₹₽₺฿₫₴₪]|[A-Z]{3}/;

  const DEBUG = (() => {
    try {
      return localStorage.getItem("usdkrwDebug") === "1";
    } catch {
      return false;
    }
  })();
  const log = (...args) => {
    if (DEBUG) console.log("[→KRW]", ...args);
  };

  // ----- 상태 -----
  let active = false;
  let tooltipEl = null;
  let scanTimer = null;
  let safetyTimer = null;
  let urlPollTimer = null;
  let observer = null;

  // ----- prefs/테마 -----

  function applyTheme() {
    if (!tooltipEl) return;
    for (const t of VALID_THEMES) tooltipEl.classList.remove(`usdkrw-theme-${t}`);
    const theme = VALID_THEMES.includes(prefs.theme) ? prefs.theme : DEFAULT_PREFS.theme;
    tooltipEl.classList.add(`usdkrw-theme-${theme}`);
  }

  async function loadPrefs() {
    try {
      const stored = await browser.storage.local.get(PREFS_KEY);
      if (stored && stored[PREFS_KEY]) prefs = { ...DEFAULT_PREFS, ...stored[PREFS_KEY] };
    } catch {
      /* 기본값 유지 */
    }
    applyTheme();
  }

  // ----- 툴팁 -----

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

  let mouseX = 0;
  let mouseY = 0;
  let positionRaf = null;
  const CURSOR_OFFSET = 18;

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
    let top = mouseY + window.scrollY - tipRect.height - CURSOR_OFFSET;
    let left = mouseX + window.scrollX - tipRect.width / 2;
    if (top < window.scrollY + 4) top = mouseY + window.scrollY + CURSOR_OFFSET;
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
      if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) positionAtMouse();
    });
  }

  // ----- 호버 -----

  function findPriceTarget(node) {
    if (!(node instanceof HTMLElement)) return null;
    return node.closest(`.${PRICE_CLASS}`);
  }

  // 호버 시점 textContent 재파싱 → {amount, currency}. 동적 가격 갱신 대응.
  // 못 잡으면 스캔 때 저장한 dataset 로 fallback.
  function readLivePrice(el) {
    const txt = el.textContent;
    if (txt) {
      const info = CurrencyKit.interpret(txt.match(regexes.whole) || txt.match(regexes.single));
      if (info && info.amount !== null && info.currency) {
        if (el.dataset.amount !== String(info.amount) || el.dataset.currency !== info.currency) {
          el.dataset.amount = String(info.amount);
          el.dataset.currency = info.currency;
          log("dataset refreshed", info.amount, info.currency);
        }
        return { amount: info.amount, currency: info.currency };
      }
    }
    const amt = parseFloat(el.dataset.amount);
    const cur = el.dataset.currency;
    return Number.isFinite(amt) && cur ? { amount: amt, currency: cur } : null;
  }

  function rateLine(cur, rates) {
    const per = rates.KRW / rates[cur];
    return `1 ${cur} = ${per.toFixed(2)}원`;
  }

  function handleMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) scheduleReposition();
  }

  function handleHover(event) {
    const el = findPriceTarget(event.target);
    if (!el) return;
    const info = readLivePrice(el);
    if (!info || info.currency === "KRW") return; // KRW→KRW skip

    mouseX = event.clientX;
    mouseY = event.clientY;

    showTooltip("환율 조회 중…", null);
    RatesKit.getRates().then(
      ({ rates }) => {
        const krwVal = CurrencyKit.convertToKRW(info.amount, info.currency, rates);
        if (krwVal === null) {
          showTooltip("미지원 통화", info.currency);
          return;
        }
        const sub = prefs.showRateInfo ? rateLine(info.currency, rates) : null;
        showTooltip(CurrencyKit.formatKRW(krwVal), sub);
      },
      (err) => showTooltip("환율 조회 실패", String((err && err.message) || err))
    );
  }

  function handleLeave(event) {
    if (findPriceTarget(event.target)) hideTooltip();
  }

  function handleScroll() {
    if (tooltipEl?.classList.contains("usdkrw-tooltip--visible")) hideTooltip();
  }

  // ----- 스캔 -----

  function isInsideSkipZone(el) {
    return Boolean(
      el.closest("script, style, noscript, textarea, input, .usdkrw-tooltip, .usdkrw-price")
    );
  }

  // 패스 1: 텍스트 노드 내 부분 매칭
  function wrapMatchesInTextNode(textNode) {
    const text = textNode.nodeValue;
    if (!text || text.length > MAX_TEXT_NODE_LEN) return 0;
    regexes.inline.lastIndex = 0;

    const frag = document.createDocumentFragment();
    let lastIdx = 0;
    let match;
    let count = 0;
    while ((match = regexes.inline.exec(text)) !== null) {
      const info = CurrencyKit.interpret(match);
      const full = match[0];
      const start = match.index;
      if (start > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, start)));
      if (!info || info.amount === null || !info.currency || info.currency === "KRW") {
        frag.appendChild(document.createTextNode(full)); // 파싱 실패/KRW → 그대로
      } else {
        const span = document.createElement("span");
        span.className = PRICE_CLASS;
        span.dataset.amount = String(info.amount);
        span.dataset.currency = info.currency;
        span.textContent = full;
        frag.appendChild(span);
        count += 1;
      }
      lastIdx = start + full.length;
    }
    if (count === 0) return 0; // 매칭 없으면 DOM 안 건드림
    if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
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
        const v = node.nodeValue;
        if (!v || !CURRENCY_HINT.test(v)) return NodeFilter.FILTER_REJECT;
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

  // 패스 2: 작은 요소 통째 매칭 (split-span 케이스)
  function tagElementAsPrice(el, amount, currency) {
    el.classList.add(PRICE_CLASS);
    el.dataset.amount = String(amount);
    el.dataset.currency = currency;
  }

  function tryTagAsPrice(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.classList.contains(PRICE_CLASS)) return false;
    if (isInsideSkipZone(el.parentElement ?? el)) return false;
    if (el.querySelector(`.${PRICE_CLASS}`)) return false;
    const txt = el.textContent;
    if (!txt || txt.length > MAX_ELEMENT_TEXT_LEN) return false;
    if (!CURRENCY_HINT.test(txt)) return false;
    const info = CurrencyKit.interpret(txt.match(regexes.whole));
    if (!info || info.amount === null || !info.currency || info.currency === "KRW") return false;
    tagElementAsPrice(el, info.amount, info.currency);
    return true;
  }

  // 알리익스프레스 fast path (무해 — 다른 사이트엔 매칭 안 됨)
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
    for (const el of root.querySelectorAll(ALI_PRICE_SELECTORS)) {
      if (tryTagAsPrice(el)) count += 1;
    }
    for (const el of root.querySelectorAll("span, div, em, strong, b, p, a, bdi")) {
      if (tryTagAsPrice(el)) count += 1;
    }
    return count;
  }

  let totalTagged = 0;
  function scan(root = document.body) {
    if (!root || !active) return;
    const t0 = performance.now();
    const inline = scanTextNodes(root);
    const whole = scanElements(root);
    const dt = (performance.now() - t0).toFixed(1);
    totalTagged += inline + whole;
    if (inline + whole > 0) {
      console.log(`[→KRW] +${inline + whole} 가격 발견 (누적 ${totalTagged}) — ${dt}ms`);
    } else if (DEBUG) {
      log(`scan in ${dt}ms — 0 매칭`);
    }
  }

  function scheduleScan() {
    if (scanTimer || !active) return;
    scanTimer = setTimeout(() => {
      scanTimer = null;
      scan();
    }, SCAN_DEBOUNCE_MS);
  }

  // ----- 활성/비활성 (per-site 게이트 — INV-2) -----

  function activate() {
    if (active) return;
    active = true;
    log("activate", location.hostname);
    scan();

    let safetyTicks = 0;
    safetyTimer = setInterval(() => {
      scan();
      safetyTicks += 1;
      if (safetyTicks >= 15) {
        clearInterval(safetyTimer);
        safetyTimer = null;
      }
    }, 2000);

    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if ((m.type === "childList" && m.addedNodes.length) || m.type === "characterData") {
          scheduleScan();
          break;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    document.addEventListener("mouseover", handleHover, true);
    document.addEventListener("mouseout", handleLeave, true);
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    let lastUrl = location.href;
    urlPollTimer = setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        scheduleScan();
      }
    }, 1000);
  }

  function deactivate() {
    if (!active) return;
    active = false;
    log("deactivate", location.hostname);
    if (safetyTimer) {
      clearInterval(safetyTimer);
      safetyTimer = null;
    }
    if (urlPollTimer) {
      clearInterval(urlPollTimer);
      urlPollTimer = null;
    }
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    document.removeEventListener("mouseover", handleHover, true);
    document.removeEventListener("mouseout", handleLeave, true);
    document.removeEventListener("mousemove", handleMouseMove, { passive: true });
    window.removeEventListener("scroll", handleScroll, { passive: true });
    hideTooltip();
    // 이미 래핑된 .usdkrw-price 밑줄/스팬은 리로드 시 제거(즉시 언랩 non-goal).
  }

  // ----- storage 동기 (prefs 즉시반영 + sites 라이브 토글) -----
  if (browser.storage && browser.storage.onChanged) {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[PREFS_KEY]) {
        prefs = { ...DEFAULT_PREFS, ...changes[PREFS_KEY].newValue };
        applyTheme();
      }
      if (changes[SitesKit.SITES_KEY]) {
        const sites = changes[SitesKit.SITES_KEY].newValue || {};
        if (SitesKit.isEnabled(location.hostname, sites)) activate();
        else deactivate();
      }
    });
  }

  // ----- 부트 (게이트) -----
  async function boot() {
    console.log(
      "[→KRW] content script loaded —",
      location.host,
      DEBUG ? "(debug ON)" : "(debug OFF · localStorage.usdkrwDebug='1' 로 켜기)"
    );
    loadPrefs(); // 테마 (비동기)
    const sites = await SitesKit.getSites();
    if (SitesKit.isEnabled(location.hostname, sites)) {
      activate();
    } else {
      log("inert — 이 사이트는 미허용 (팝업에서 켜기)");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
