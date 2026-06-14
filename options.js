const PREFS_KEY = "usdKrwPrefs";
const VALID_THEMES = ["dark", "soft-dark", "blue", "warm"];
const DEFAULT_PREFS = { showRateInfo: false, theme: "warm" };

const checkbox = document.getElementById("showRateInfo");
const previewTooltip = document.getElementById("previewTooltip");
const previewSub = document.getElementById("previewSub");
const statusEl = document.getElementById("status");
const themeCards = document.querySelectorAll(".theme-card");
const themeRadios = document.querySelectorAll('input[name="theme"]');

let statusTimer = null;
function flashStatus(text) {
  statusEl.textContent = text;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusEl.textContent = "";
  }, 1500);
}

function getSelectedTheme() {
  for (const r of themeRadios) {
    if (r.checked) return r.value;
  }
  return DEFAULT_PREFS.theme;
}

function applyPreview() {
  previewSub.style.display = checkbox.checked ? "" : "none";

  const theme = getSelectedTheme();
  for (const t of VALID_THEMES) {
    previewTooltip.classList.remove(`usdkrw-theme-${t}`);
  }
  previewTooltip.classList.add(`usdkrw-theme-${theme}`);

  for (const card of themeCards) {
    card.classList.toggle("selected", card.dataset.theme === theme);
  }
}

function setTheme(theme) {
  for (const r of themeRadios) {
    r.checked = r.value === theme;
  }
}

async function load() {
  let prefs = { ...DEFAULT_PREFS };
  try {
    const stored = await browser.storage.local.get(PREFS_KEY);
    if (stored && stored[PREFS_KEY]) {
      prefs = { ...DEFAULT_PREFS, ...stored[PREFS_KEY] };
    }
  } catch {
    /* 기본값 사용 */
  }
  checkbox.checked = Boolean(prefs.showRateInfo);
  setTheme(VALID_THEMES.includes(prefs.theme) ? prefs.theme : DEFAULT_PREFS.theme);
  applyPreview();
}

async function save() {
  const prefs = {
    showRateInfo: checkbox.checked,
    theme: getSelectedTheme(),
  };
  try {
    await browser.storage.local.set({ [PREFS_KEY]: prefs });
    flashStatus("저장됨");
  } catch (err) {
    flashStatus("저장 실패: " + (err && err.message ? err.message : err));
  }
  applyPreview();
}

checkbox.addEventListener("change", save);
for (const r of themeRadios) {
  r.addEventListener("change", save);
}

load();
