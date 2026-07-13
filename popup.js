// popup.js — 공유 모듈(RatesKit·SitesKit)은 popup.html 에서 먼저 로드됨.
const PREFS_KEY = "usdKrwPrefs";
const VALID_THEMES = ["dark", "soft-dark", "blue", "warm"];
const DEFAULT_PREFS = { showRateInfo: false, theme: "warm" };

const rateEl = document.getElementById("rate");
const metaEl = document.getElementById("meta");
const btnRefresh = document.getElementById("refresh");
const themeRadios = document.querySelectorAll('input[name="theme"]');
const themePicks = document.querySelectorAll(".theme-pick");
const linkOptions = document.getElementById("openOptions");
const siteToggle = document.getElementById("siteToggle");
const siteDomainEl = document.getElementById("siteDomain");

let currentHost = "";

// ---------- per-site 토글 ----------

async function initSiteToggle() {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const url = tabs && tabs[0] && tabs[0].url;
    let host = "";
    try {
      if (url) host = new URL(url).hostname;
    } catch {
      /* 파싱 실패 */
    }
    if (!host || !/^https?:/i.test(url || "")) {
      // about:/file:/확장 페이지 등 — 지원 불가
      siteToggle.checked = false;
      siteToggle.disabled = true;
      siteDomainEl.textContent = "이 페이지에선 사용할 수 없어요";
      return;
    }
    currentHost = host;
    const sites = await SitesKit.getSites();
    siteToggle.checked = SitesKit.isEnabled(host, sites);
    siteDomainEl.textContent = SitesKit.currentDomain(host);
  } catch {
    siteToggle.disabled = true;
    siteDomainEl.textContent = "";
  }
}

siteToggle.addEventListener("change", async () => {
  if (!currentHost) return;
  // content script 는 storage.onChanged 로 라이브 반응(리로드 불요).
  await SitesKit.setSite(currentHost, siteToggle.checked);
});

// ---------- 환율 ----------

async function loadRate(forceRefresh) {
  rateEl.textContent = "조회 중…";
  metaEl.textContent = "";
  rateEl.classList.remove("error");
  try {
    const { rates, fetchedAt } = await RatesKit.getRates(forceRefresh);
    rateEl.textContent = `1 USD = ${rates.KRW.toFixed(2)} 원`;
    metaEl.textContent = `업데이트: ${new Date(fetchedAt).toLocaleString("ko-KR")}`;
  } catch (err) {
    rateEl.textContent = "환율 조회 실패";
    rateEl.classList.add("error");
    metaEl.textContent = String((err && err.message) || err);
  }
}

// ---------- 테마 ----------

function getSelectedTheme() {
  for (const r of themeRadios) if (r.checked) return r.value;
  return DEFAULT_PREFS.theme;
}

function setSelectedTheme(theme) {
  for (const r of themeRadios) r.checked = r.value === theme;
  for (const card of themePicks) {
    card.classList.toggle("selected", card.dataset.theme === theme);
  }
}

async function loadPrefs() {
  let prefs = { ...DEFAULT_PREFS };
  try {
    const stored = await browser.storage.local.get(PREFS_KEY);
    if (stored && stored[PREFS_KEY]) prefs = { ...DEFAULT_PREFS, ...stored[PREFS_KEY] };
  } catch {
    /* keep default */
  }
  setSelectedTheme(VALID_THEMES.includes(prefs.theme) ? prefs.theme : DEFAULT_PREFS.theme);
}

async function saveTheme() {
  const theme = getSelectedTheme();
  setSelectedTheme(theme);
  try {
    const stored = await browser.storage.local.get(PREFS_KEY);
    const current = (stored && stored[PREFS_KEY]) || {};
    await browser.storage.local.set({
      [PREFS_KEY]: { ...DEFAULT_PREFS, ...current, theme },
    });
  } catch {
    /* ignore */
  }
}

// ---------- 이벤트 ----------

btnRefresh.addEventListener("click", () => loadRate(true));

for (const r of themeRadios) {
  r.addEventListener("change", saveTheme);
}

linkOptions.addEventListener("click", () => {
  if (browser.runtime.openOptionsPage) {
    browser.runtime.openOptionsPage();
    window.close();
  }
});

// ---------- 시작 ----------

initSiteToggle();
loadRate(false);
loadPrefs();
