// /js/i18n.js
// Measure Master i18n (mm_lang unified)
// - Replaces elements with [data-i18n] using innerHTML
// - Replaces attributes via [data-i18n-attr], format: "attr=key, attr2=key2"
// - Loads page strings from /assets/data/{page}_strings_{lang}.json if window.I18N not provided

(() => {
  const STORAGE_KEY = "mm_lang";
  const DEFAULT_LANG = "en"; // 원하시면 "ko"로 바꾸세요.

  // 전역 번역 테이블(선택)
  // window.I18N = { en:{...}, ko:{...} } 형태면 그대로 사용
  // 없으면 JSON 파일 로드 시도
  const GLOBAL = () => (window.I18N && typeof window.I18N === "object") ? window.I18N : null;

  function getUrlLang() {
    try {
      return (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
    } catch {
      return "";
    }
  }

  function getLang() {
    const urlLang = getUrlLang();
    const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    const htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return (urlLang || saved || htmlLang || DEFAULT_LANG);
  }

  function setLang(lang) {
    const v = (lang || DEFAULT_LANG).toLowerCase();
    localStorage.setItem(STORAGE_KEY, v);
    document.documentElement.setAttribute("lang", v);
    document.documentElement.setAttribute("data-lang", v);
    markActiveLang(v);
  }

  function markActiveLang(lang) {
    document.querySelectorAll("[data-lang-btn]").forEach(btn => {
      btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
    });
  }

  function formatVars(str, vars) {
    let s = String(str ?? "");
    if (vars && typeof vars === "object") {
      for (const k of Object.keys(vars)) {
        s = s.replaceAll(`{${k}}`, String(vars[k]));
      }
    }
    return s;
  }

  function t(key, vars = {}) {
    const lang = getLang();
    const g = GLOBAL();
    const table = g && g[lang];
    const fallback = g && g[DEFAULT_LANG];

    let raw =
      (table && Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null) ??
      (fallback && Object.prototype.hasOwnProperty.call(fallback, key) ? fallback[key] : null) ??
      key;

    return formatVars(raw, vars);
  }

  // 페이지별 문자열 JSON 로드(선택)
  async function loadPageStringsIfNeeded() {
    // data-i18n 키 prefix에서 페이지명을 추정: "idx." -> "idx"
    const first = document.querySelector("[data-i18n], [data-i18n-attr]");
    if (!first) return;

    const guessKey =
      first.getAttribute("data-i18n") ||
      (first.getAttribute("data-i18n-attr") || "").split(",")[0]?.split("=")[1]?.trim() ||
      "";

    const page = (guessKey.split(".")[0] || "").trim();
    if (!page) return;

    // 이미 window.I18N 있으면 로드 불필요
    if (GLOBAL()) return;

    const lang = getLang();
    const url = `/assets/data/${page}_strings_${lang}.json`;

    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      if (!window.I18N) window.I18N = {};
      window.I18N[lang] = data;
    } catch {
      // 조용히 무시 (키 그대로 보이게 됨)
    }
  }

  function applyI18n() {
    // innerHTML 치환
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.innerHTML = t(key);
    });

    // 속성 치환
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      const spec = el.getAttribute("data-i18n-attr");
      if (!spec) return;

      spec.split(",").forEach(pair => {
        const [attr, key] = pair.split("=").map(s => s.trim());
        if (!attr || !key) return;
        el.setAttribute(attr, t(key));
      });
    });

    // <title data-i18n="...">
    const titleEl = document.querySelector("title[data-i18n]");
    if (titleEl) titleEl.textContent = t(titleEl.getAttribute("data-i18n"));

    // meta description
    const metaDesc = document.querySelector('meta[name="description"][data-i18n-attr]');
    if (metaDesc) {
      const spec = metaDesc.getAttribute("data-i18n-attr") || "";
      spec.split(",").forEach(pair => {
        const [attr, key] = pair.split("=").map(s => s.trim());
        if (!attr || !key) return;
        metaDesc.setAttribute(attr, t(key));
      });
    }
  }

  async function initI18n() {
    const lang = getLang();
    setLang(lang);

    // 버튼 클릭: URL 쿼리도 같이 갱신(공유/리로드 일관성)
    document.querySelectorAll("[data-lang-btn]").forEach(btn => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-lang-btn");
        if (!v) return;
        setLang(v);
        // URL 반영 (원치 않으면 아래 2줄 삭제)
        const u = new URL(location.href);
        u.searchParams.set("lang", v);
        location.href = u.toString();
      });
    });

    await loadPageStringsIfNeeded();
    applyI18n();
  }

  // 외부에서 쓰고 싶으면 window.mmI18n 사용
  window.mmI18n = {
    getLang,
    setLang,
    t,
    applyI18n,
    initI18n,
  };

  document.addEventListener("DOMContentLoaded", () => {
    initI18n();
    const year = document.getElementById("year");
    if (year) year.textContent = new Date().getFullYear();
  });
})();
