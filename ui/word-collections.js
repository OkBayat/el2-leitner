(() => {
  "use strict";

  const SOURCE_COLUMN_MARKER = "data-vocora-source-column";
  const tableBody = document.querySelector("#wordsTableBody");
  const previousFetch = window.fetch.bind(window);
  const DAILY_DEFAULTS = Object.freeze({
    attempts: 0,
    correct: 0,
    wrong: 0,
    newAdded: 0,
    sessions: 0,
    durationSeconds: 0
  });
  let sourcesByVocabularyId = new Map();
  let sourcesByTerm = new Map();
  let decorating = false;
  let refreshTimer = null;
  let lastSourceKey = "";
  let pendingActivationId = null;
  let persistedBaseline = null;

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

  function wordInvariant(word) {
    return JSON.stringify([
      word?.number ?? null,
      word?.term ?? null,
      Array.isArray(word?.accepted) ? word.accepted : [],
      word?.category ?? null,
      word?.notes ?? null,
      word?.createdAt ?? null,
      Number(word?.attempts) || 0,
      Number(word?.correct) || 0,
      Number(word?.mistakes) || 0,
      Number(word?.currentStreak) || 0,
      word?.lastReviewed ?? null,
      word?.masteredAt ?? null
    ]);
  }

  function progressSnapshot(word) {
    return {
      box: Number(word?.box) || 0,
      due: word?.due || null,
      introducedOn: word?.introducedOn || null,
      addedSource: word?.addedSource || null,
      lastPromotedDay: word?.lastPromotedDay || null,
      blockedUntil: word?.blockedUntil || null,
      invariant: wordInvariant(word)
    };
  }

  function historyCursor(history) {
    const events = Array.isArray(history) ? history : [];
    return {
      length: events.length,
      last: events.length ? JSON.stringify(events.at(-1)) : null
    };
  }

  function normalizedDaily(record) {
    return {
      attempts: Number(record?.attempts) || 0,
      correct: Number(record?.correct) || 0,
      wrong: Number(record?.wrong) || 0,
      newAdded: Number(record?.newAdded) || 0,
      sessions: Number(record?.sessions) || 0,
      durationSeconds: Number(record?.durationSeconds) || 0
    };
  }

  function capturePersistedBaseline(state) {
    if (!state || !Array.isArray(state.words)) return;
    persistedBaseline = {
      words: new Map(state.words.map((word) => [String(word.id), progressSnapshot(word)])),
      wordCount: state.words.length,
      settings: JSON.stringify(state.settings || {}),
      history: historyCursor(state.history),
      daily: new Map(Object.entries(state.daily || {}).map(([day, record]) => [day, normalizedDaily(record)]))
    };
  }

  function parseStateEnvelope(init) {
    if (typeof init.body !== "string") return null;
    try {
      const payload = JSON.parse(init.body);
      const revision = Number(payload?.revision);
      if (!payload?.state || !Array.isArray(payload.state.words) || !Number.isSafeInteger(revision) || revision < 0) {
        return null;
      }
      return { payload, state: payload.state, revision };
    } catch {
      return null;
    }
  }

  function compactActivationCommand(init, vocabularyId) {
    const envelope = parseStateEnvelope(init);
    if (!envelope || !vocabularyId) return null;
    const word = envelope.state.words.find((item) => String(item?.id) === String(vocabularyId));
    if (!word) return null;
    if (Number(word.box) !== 1
      || !word.introducedOn
      || word.addedSource !== "word-bank"
      || word.due !== word.introducedOn) {
      return null;
    }
    return {
      revision: envelope.revision,
      vocabularyId: String(vocabularyId),
      day: word.introducedOn
    };
  }

  function isAutomaticActivation(previous, current) {
    const source = current?.addedSource;
    const day = current?.introducedOn;
    if (!previous || !["daily", "home-selection"].includes(source) || !day) return false;
    return previous.box === 0
      && previous.introducedOn === null
      && previous.invariant === wordInvariant(current)
      && Number(current.box) === 1
      && current.due === day
      && current.lastPromotedDay === null
      && current.blockedUntil === null;
  }

  function dailyMatchesBatch(state, candidates) {
    const increments = new Map();
    candidates.forEach((word) => increments.set(word.introducedOn, (increments.get(word.introducedOn) || 0) + 1));
    const currentDaily = new Map(Object.entries(state.daily || {}).map(([day, record]) => [day, normalizedDaily(record)]));
    const days = new Set([...persistedBaseline.daily.keys(), ...currentDaily.keys()]);

    for (const day of days) {
      const before = persistedBaseline.daily.get(day) || { ...DAILY_DEFAULTS };
      const after = currentDaily.get(day) || { ...DAILY_DEFAULTS };
      const expected = { ...before, newAdded: before.newAdded + (increments.get(day) || 0) };
      if (JSON.stringify(after) !== JSON.stringify(expected)) return false;
    }
    return true;
  }

  function compactAutomaticActivationBatch(init) {
    const envelope = parseStateEnvelope(init);
    if (!envelope || !persistedBaseline) return null;
    const { state, revision } = envelope;
    if (state.words.length !== persistedBaseline.wordCount) return null;
    if (JSON.stringify(state.settings || {}) !== persistedBaseline.settings) return null;

    const currentHistory = historyCursor(state.history);
    if (currentHistory.length !== persistedBaseline.history.length || currentHistory.last !== persistedBaseline.history.last) {
      return null;
    }

    const candidates = [];
    for (const word of state.words) {
      const previous = persistedBaseline.words.get(String(word.id));
      if (!previous) return null;
      const current = progressSnapshot(word);
      if (JSON.stringify(current) === JSON.stringify(previous)) continue;
      if (!isAutomaticActivation(previous, word)) return null;
      candidates.push(word);
    }

    if (!candidates.length || candidates.length > 50) return null;
    const source = candidates[0].addedSource;
    const day = candidates[0].introducedOn;
    if (!candidates.every((word) => word.addedSource === source && word.introducedOn === day)) return null;
    if (!dailyMatchesBatch(state, candidates)) return null;

    return {
      envelope,
      command: {
        revision,
        vocabularyIds: candidates.map((word) => String(word.id)),
        day,
        source
      }
    };
  }

  async function captureStateRead(response) {
    if (!response.ok) return response;
    try {
      const payload = await response.clone().json();
      if (payload?.state) capturePersistedBaseline(payload.state);
    } catch {
      // State parsing remains owned by the application.
    }
    return response;
  }

  async function sendCompact(path, body) {
    return previousFetch(path, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function installActivationWriteInterceptor() {
    window.fetch = async function vocoraWordBankFetch(input, init = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      const isStateEndpoint = /\/api\/state(?:\?|$)/u.test(url);

      if (isStateEndpoint && method === "GET") {
        return captureStateRead(await previousFetch(input, init));
      }

      if (isStateEndpoint && method === "PUT") {
        const envelope = parseStateEnvelope(init);

        if (pendingActivationId) {
          const command = compactActivationCommand(init, pendingActivationId);
          if (command) {
            pendingActivationId = null;
            const response = await sendCompact("/api/learning/vocabulary-activations", command);
            if (response.ok && envelope?.state) capturePersistedBaseline(envelope.state);
            return response;
          }
        }

        const automaticBatch = compactAutomaticActivationBatch(init);
        if (automaticBatch) {
          const response = await sendCompact(
            "/api/learning/vocabulary-activation-batches",
            automaticBatch.command
          );
          if (response.ok) capturePersistedBaseline(automaticBatch.envelope.state);
          return response;
        }

        const response = await previousFetch(input, init);
        if (response.ok && envelope?.state) capturePersistedBaseline(envelope.state);
        return response;
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
    compactAutomaticActivationBatch,
    capturePersistedBaseline,
    getPendingActivationId: () => pendingActivationId
  };
  boot();
})();
