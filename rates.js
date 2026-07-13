// rates.js — 환율 fetch + 캐시 (RatesKit). content script + 팝업이 공유(동일 storage 캐시).
// er-api latest/USD 응답의 rates 맵(1 USD 기준 각 통화)을 통째 캐시. (ADR-0003)
var RatesKit = (() => {
  "use strict";

  const RATE_API = "https://open.er-api.com/v6/latest/USD";
  const CACHE_KEY = "usdKrwRate";
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1시간

  let inflight = null; // 동시 호출 dedup

  async function loadCached() {
    try {
      const stored = await browser.storage.local.get(CACHE_KEY);
      const entry = stored && stored[CACHE_KEY];
      // 구버전 엔트리(rates 맵 없이 단일 rate 필드)는 무효 처리 → 재fetch.
      if (!entry || !entry.rates || typeof entry.rates.KRW !== "number") return null;
      if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) return null;
      return entry;
    } catch {
      return null;
    }
  }

  async function fetchFresh() {
    const res = await fetch(RATE_API, { cache: "no-store" });
    if (!res.ok) throw new Error(`rate api ${res.status}`);
    const data = await res.json();
    const rates = data && data.rates;
    if (!rates || typeof rates.KRW !== "number") throw new Error("rates missing");
    const entry = { rates, fetchedAt: Date.now() };
    try {
      await browser.storage.local.set({ [CACHE_KEY]: entry });
    } catch {
      /* storage 실패해도 이번 세션 환율은 사용 가능 */
    }
    return entry;
  }

  // {rates, fetchedAt} 반환. force 면 캐시 무시하고 새로 fetch.
  async function getRates(force) {
    if (force) return fetchFresh();
    if (inflight) return inflight;
    inflight = (async () => {
      const cached = await loadCached();
      if (cached) return cached;
      return fetchFresh();
    })();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
  }

  return { RATE_API, CACHE_KEY, CACHE_TTL_MS, getRates };
})();
