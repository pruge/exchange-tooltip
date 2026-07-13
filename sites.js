// sites.js — per-site allowlist 매칭/토글/시드 (SitesKit). content 게이트(INV-2) + 팝업 토글이 공유.
// 도메인+서브도메인 매칭. 기본 시드 = aliexpress(하위호환). (ADR-0001)
var SitesKit = (() => {
  "use strict";

  const SITES_KEY = "usdKrwSites";
  const DEFAULT_SITES = { "aliexpress.com": true, "aliexpress.us": true };

  // 흔한 2단계 TLD의 2번째 레이블(co.kr, com.au, co.uk …) — 등록가능 도메인 근사에 사용.
  const SECOND_LEVEL = new Set(["co", "com", "org", "net", "gov", "edu", "ac", "or", "ne", "go"]);

  // storage 미존재면 기본 시드 사본 반환(시드는 첫 setSite 때 영구화됨).
  async function getSites() {
    try {
      const stored = await browser.storage.local.get(SITES_KEY);
      if (stored && stored[SITES_KEY]) return { ...stored[SITES_KEY] };
    } catch {
      /* 기본 시드로 폴백 */
    }
    return { ...DEFAULT_SITES };
  }

  // host 가 allowlist 에 걸리나 — 도메인 서픽스 매칭(host===d || host.endsWith("."+d)).
  function isEnabled(host, sites) {
    if (!host || !sites) return false;
    return Object.keys(sites).some(
      (d) => sites[d] && (host === d || host.endsWith("." + d))
    );
  }

  // host → 저장 단위 도메인(등록가능 도메인 근사). www.aliexpress.com → aliexpress.com,
  // www.amazon.co.jp → amazon.co.jp.
  function currentDomain(host) {
    if (!host) return "";
    const parts = host.split(".").filter(Boolean);
    if (parts.length <= 2) return parts.join(".");
    const secondLast = parts[parts.length - 2];
    const last = parts[parts.length - 1];
    if (SECOND_LEVEL.has(secondLast) && last.length === 2) {
      return parts.slice(-3).join("."); // 2단계 TLD → 3레이블
    }
    return parts.slice(-2).join(".");
  }

  // host 가 속한 도메인을 on/off. 저장 단위 = currentDomain(host).
  async function setSite(host, on) {
    const domain = currentDomain(host);
    const sites = await getSites();
    if (on) {
      sites[domain] = true;
    } else {
      delete sites[domain];
      delete sites[host]; // 혹시 정확 hostname 으로 저장돼 있던 항목도 정리
    }
    try {
      await browser.storage.local.set({ [SITES_KEY]: sites });
    } catch {
      /* 저장 실패는 상위에서 안내 */
    }
    return sites;
  }

  return { SITES_KEY, DEFAULT_SITES, getSites, isEnabled, setSite, currentDomain };
})();
