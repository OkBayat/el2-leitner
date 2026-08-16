(() => {
  "use strict";

  const SOURCE_COLUMN_MARKER = "data-vocora-source-column";
  const tableBody = document.querySelector("#wordsTableBody");
  const previousFetch = window.fetch.bind(window);
  let sourcesByVocabularyId = new Map();
  let sourcesByTerm = new Map();
  let decorating = false;
  let refreshTimer = null;
  let lastSourceKey = "";
  let pendingActivationId = null;

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

  function requestJson(path) {
    return previousFetch(path, { credentials: "include" }).then(async (response) => {
      if (response.status === 401) return { sources: [] };
      if (!response.ok) throw new Error("Could not load vocabulary sources.");
      return response.json();
    });
  }

  function mergeSources(sources) {
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

  function visibleVocabularyIds() {
    if (!tableBody) return [];
    return [...new Set(
      [...tableBody.querySelectorAll("tr")]
        .map((row) => rowIdentity(row).vocabularyId)
        .filter(Boolean)
    )].slice(0, 50);
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
    const ids = visibleVocabularyIds();
    const key = ids.join(",");
    if (!ids.length || key === lastSourceKey) {
      decorateRows();
      return;
    }
    lastSourceKey = key;
    try {
      const params = new URLSearchParams({ ids: key });
      const payload = await requestJson(`/api/library/vocabulary-sources?${params.toString()}`);
      mergeSources(payload.sources || []);
      decorateRows();
    } catch (error) {
      lastSourceKey = "";
      console.warn("Could not decorate vocabulary sources:", error);
      decorateRows();
    }
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refreshSources, 0);
  }

  function compactActivationCommand(init, vocabularyId) {
    if (typeof init.body !== "string" || !vocabularyId) return null;
    try {
      const payload = JSON.parse(init.body);
      const revision = Number(payload?.revision);
      const words = Array.isArray(payload?.state?.words) ? payload.state.words : [];
      const word = words.find((item) => String(item?.id) === String(vocabularyId));
      if (!Number.isSafeInteger(revision) || revision < 0 || !word) return null;
      if (Number(word.box) !== 1
        || !word.introducedOn
        || word.addedSource !== "word-bank"
        || word.due !== word.introducedOn) {
        return null;
      }
      return {
        revision,
        vocabularyId: String(vocabularyId),
        day: word.introducedOn
      };
    } catch {
      return null;
    }
  }

  function installActivationWriteInterceptor() {
    window.fetch = async function vocoraWordBankFetch(input, init = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      if (pendingActivationId && method === "PUT" && /\/api\/state(?:\?|$)/u.test(url)) {
        const command = compactActivationCommand(init, pendingActivationId);
        if (command) {
          pendingActivationId = null;
          return previousFetch("/api/learning/vocabulary-activations", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(command)
          });
        }
      }
      return previousFetch(input, init);
    };
  }

  function bindWordBankActivationIntent() {
    tableBody?.addEventListener("click", (event) => {
      const button = event.target.closest(".add-to-box-one[data-id]");
      if (button) pendingActivationId = button.dataset.id;
    }, true);
  }

  function boot() {
    installActivationWriteInterceptor();
    if (!tableBody) return;
    bindWordBankActivationIntent();
    const observer = new MutationObserver(() => {
      if (!decorating) {
        decorateRows();
        scheduleRefresh();
      }
    });
    observer.observe(tableBody, { childList: true });
    ["#wordSearch", "#boxFilter", "#sortWords", "#prevPage", "#nextPage"].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("input", scheduleRefresh);
      document.querySelector(selector)?.addEventListener("change", scheduleRefresh);
      document.querySelector(selector)?.addEventListener("click", scheduleRefresh);
    });
    refreshSources();
  }

  window.VocoraWordCollectionsTest = {
    normalize,
    mergeSources,
    rowIdentity,
    visibleVocabularyIds,
    compactActivationCommand,
    getPendingActivationId: () => pendingActivationId
  };
  boot();
})();
