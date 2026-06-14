const RATE_API = "https://open.er-api.com/v6/latest/USD";
const CACHE_KEY = "usdKrwRate";
const PREFS_KEY = "usdKrwPrefs";
const CACHE_TTL_MS = 60 * 60 * 1000;
const VALID_THEMES = ["dark", "soft-dark", "blue", "warm"];
const DEFAULT_PREFS = { showRateInfo: false, theme: "warm" };

const rateEl = document.getElementById("rate");
const metaEl = document.getElementById("meta");
const btnRefresh = document.getElementById("refresh");
const themeRadios = document.querySelectorAll('input[name="theme"]');
const themePicks = document.querySelectorAll(".theme-pick");
const linkOptions = document.getElementById("openOptions");

// ---------- 환율 ----------

async function getCached() {
  const stored = await browser.storage.local.get(CACHE_KEY);
  const entry = stored && stored[CACHE_KEY];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
  return entry;
}

async function fetchFresh() {
  const res = await fetch(RATE_API, { cache: "no-store" });
  if (!res.ok) throw new Error(`rate api ${res.status}`);
  const data = await res.json();
  const krw = data && data.rates && data.rates.KRW;
  if (typeof krw !== "number") throw new Error("KRW missing");
  const entry = { rate: krw, fetchedAt: Date.now() };
  await browser.storage.local.set({ [CACHE_KEY]: entry });
  return entry;
}

async function loadRate(forceRefresh) {
  rateEl.textContent = "조회 중…";
  metaEl.textContent = "";
  rateEl.classList.remove("error");
  try {
    let entry = forceRefresh ? null : await getCached();
    if (!entry) entry = await fetchFresh();
    rateEl.textContent = `1 USD = ${entry.rate.toFixed(2)} 원`;
    metaEl.textContent = `업데이트: ${new Date(entry.fetchedAt).toLocaleString("ko-KR")}`;
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
    if (stored && stored[PREFS_KEY]) {
      prefs = { ...DEFAULT_PREFS, ...stored[PREFS_KEY] };
    }
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

loadRate(false);
loadPrefs();
