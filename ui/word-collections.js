(() => {
  "use strict";

  const SOURCE_COLUMN_MARKER = "data-vocora-source-column";
  const tableBody = document.querySelector("#wordsTableBody");
  let sourcesByVocabularyId = new Map();
  let sourcesByTerm = new Map();
  let decorating = false;

  function normalize(value) {
    return String(value ?? "")
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/[’‘]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  async function apiRequest(path) {
    const response = await fetch(path, { credentials: "include" });
    if (response.status === 401) return { sources: [] };
    if (!response.ok) throw new Error("Could not load vocabulary sources.");
    return response.json();
  }

  function indexSources(sources) {
    sourcesByVocabularyId = new Map();
    sourcesByTerm = new Map();
    for (const source of sources || []) {
      const collections = Array.isArray(source.collections) ? source.collections : [];
      if (source.vocabularyId) sourcesByVocabularyId.set(String(source.vocabularyId), collections);
      const term = normalize(source.term);
      if (term) sourcesByTerm.set(term, collections);
    }
  }

  function ensureHeader() {
    const headerRow = document.querySelector("#view-words thead tr");
    if (!headerRow || headerRow.querySelector(`[${SOURCE_COLUMN_MARKER}]`)) return;
    const header = document.createElement("th");
    header.setAttribute(SOURCE_COLUMN_MARKER, "true");
    header.textContent = "مجموعه‌ها";
    const categoryHeader = headerRow.children[1];
    categoryHeader?.after(header);
  }

  function rowIdentity(row) {
    const idButton = row.querySelector("button[data-id]");
    const vocabularyId = idButton?.dataset.id || null;
    const term = normalize(row.cells[0]?.textContent?.split("/")[0]);
    return { vocabularyId, term };
  }

  function sourceCell(collections) {
    const cell = document.createElement("td");
    cell.setAttribute(SOURCE_COLUMN_MARKER, "true");
    cell.className = "word-source-cell";
    if (!collections?.length) {
      cell.innerHTML = '<span class="word-source-empty">واژه‌های من</span>';
      return cell;
    }
    cell.innerHTML = `<div class="word-source-chips">${collections
      .map((collection) => `<a class="word-source-chip" href="library.html#${encodeURIComponent(collection.id)}" title="${escapeHtml(collection.title)}">${escapeHtml(collection.title)}</a>`)
      .join("")}</div>`;
    return cell;
  }

  function decorateRows() {
    if (!tableBody || decorating) return;
    decorating = true;
    try {
      ensureHeader();
      for (const row of tableBody.querySelectorAll("tr")) {
        row.querySelector(`td[${SOURCE_COLUMN_MARKER}]`)?.remove();
        const { vocabularyId, term } = rowIdentity(row);
        const collections = (vocabularyId && sourcesByVocabularyId.get(vocabularyId)) || sourcesByTerm.get(term) || [];
        const cell = sourceCell(collections);
        row.cells[1]?.after(cell);
      }
    } finally {
      decorating = false;
    }
  }

  async function refreshSources() {
    try {
      const payload = await apiRequest("/api/library/vocabulary-sources");
      indexSources(payload.sources || []);
      decorateRows();
    } catch (error) {
      console.warn("Could not decorate vocabulary sources:", error);
      decorateRows();
    }
  }

  function boot() {
    if (!tableBody) return;
    const observer = new MutationObserver(() => {
      if (!decorating) decorateRows();
    });
    observer.observe(tableBody, { childList: true });
    ["#wordSearch", "#boxFilter", "#sortWords", "#prevPage", "#nextPage"].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("input", decorateRows);
      document.querySelector(selector)?.addEventListener("change", decorateRows);
      document.querySelector(selector)?.addEventListener("click", decorateRows);
    });
    refreshSources();
  }

  window.VocoraWordCollectionsTest = { normalize, indexSources, rowIdentity };
  boot();
})();
