(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  let activeSession = null;
  let completionObserver = null;
  let startPromise = null;
  let persistedCursor = null;
  let reviewWriteFailed = false;
  let pendingReviewRevision = null;
  let advancePromise = null;
  let advanceBypass = false;

  function parseLocalizedInteger(value) {
    const digits = String(value ?? "")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[^0-9-]/g, "");
    const parsed = Number(digits);
    return Number.isSafeInteger(parsed) ? parsed : 0;
  }

  function reviewFingerprint(event) {
    return JSON.stringify([
      event?.at ?? null,
      event?.day ?? null,
      event?.term ?? null,
      event?.answer ?? null,
      Boolean(event?.correct),
      event?.mode ?? null,
      event?.previousBox ?? null,
      event?.newBox ?? null,
      event?.mistakeNumber ?? null
    ]);
  }

  function cursorForState(state) {
    const history = Array.isArray(state?.history) ? state.history : [];
    return {
      historyLength: history.length,
      lastReviewFingerprint: history.length ? reviewFingerprint(history.at(-1)) : null
    };
  }

  function normalizeLearningForm(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("en")
      .replace(/[’‘]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function uniqueWordsByForm(words) {
    const index = new Map();
    for (const word of words) {
      const forms = [word?.term, ...(Array.isArray(word?.accepted) ? word.accepted : [])];
      for (const form of forms) {
        const normalized = normalizeLearningForm(form);
        if (!normalized) continue;
        if (!index.has(normalized)) {
          index.set(normalized, word);
          continue;
        }
        if (index.get(normalized)?.id !== word?.id) index.set(normalized, null);
      }
    }
    return index;
  }

  function repairHistoricalMastery(state) {
    const words = Array.isArray(state?.words) ? state.words : [];
    const history = Array.isArray(state?.history) ? state.history : [];
    if (!words.length || !history.length) return false;

    const wordsById = new Map(words.map((word) => [String(word?.id || ""), word]));
    const wordsByForm = uniqueWordsByForm(words);
    const finalReviewByWordId = new Map();

    for (const event of history) {
      if (!event?.correct || !event?.promoted || Number(event?.previousBox) !== 5 || Number(event?.newBox) !== 5) continue;
      let word = event.wordId ? wordsById.get(String(event.wordId)) : null;
      if (!word) word = wordsByForm.get(normalizeLearningForm(event.term)) || null;
      if (!word || Number(word.box) !== 5) continue;

      const key = String(word.id);
      const previous = finalReviewByWordId.get(key);
      const eventTime = String(event.at || event.day || "");
      const previousTime = String(previous?.at || previous?.day || "");
      if (!previous || eventTime < previousTime) finalReviewByWordId.set(key, event);
    }

    let changed = false;
    for (const word of words) {
      if (Number(word?.box) !== 5) continue;
      const finalReview = finalReviewByWordId.get(String(word.id));
      if (finalReview) {
        const masteredAt = finalReview.at || (finalReview.day ? new Date(`${finalReview.day}T12:00:00`).toISOString() : word.masteredAt);
        const lastPromotedDay = finalReview.day || word.lastPromotedDay || null;
        if (word.due !== null || word.blockedUntil !== null || word.masteredAt !== masteredAt || word.lastPromotedDay !== lastPromotedDay) {
          word.due = null;
          word.blockedUntil = null;
          word.masteredAt = masteredAt;
          word.lastPromotedDay = lastPromotedDay;
          changed = true;
        }
      } else if (word.due && word.masteredAt) {
        word.masteredAt = null;
        changed = true;
      }
    }
    return changed;
  }

  function responseWithPayload(response, payload) {
    const body = JSON.stringify(payload);
    if (typeof window.Response === "function") {
      return new window.Response(body, {
        status: response.status,
        statusText: response.statusText || "",
        headers: response.headers
      });
    }
    return {
      ok: response.ok,
      status: response.status,
      headers: response.headers,
      async json() { return JSON.parse(body); },
      async text() { return body; },
      clone() { return responseWithPayload(response, payload); }
    };
  }

  function sessionIsVisible() {
    const node = document.querySelector("#reviewSession");
    return Boolean(node && !node.classList.contains("hidden"));
  }

  function feedbackIsVisible() {
    const node = document.querySelector("#answerFeedback");
    return Boolean(node && !node.classList.contains("hidden"));
  }

  function isRemediationEvent(event) {
    return Boolean(event?.target?.closest?.("#practiceRemediation"));
  }

  function requestJson(path, options = {}) {
    return originalFetch(path, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    }).then(async (response) => {
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "Session persistence request failed.");
      return payload;
    });
  }

  async function acknowledgesRevision(response, expectedRevision) {
    if (!response.ok) return false;
    const payload = await response.clone().json().catch(() => null);
    const revision = Number(payload?.revision);
    return Number.isSafeInteger(revision) && revision === expectedRevision;
  }

  async function startSession(mode) {
    if (activeSession || startPromise) return startPromise;
    startPromise = new Promise((resolve) => setTimeout(resolve, 0))
      .then(async () => {
        if (!sessionIsVisible()) return null;
        const payload = await requestJson("/api/learning/sessions", {
          method: "POST",
          body: JSON.stringify({ mode })
        });
        activeSession = {
          id: payload.session.id,
          mode,
          startedAt: Date.now(),
          finishing: false
        };
        return activeSession;
      })
      .catch((error) => {
        console.warn("Could not start persisted practice session:", error);
        return null;
      })
      .finally(() => { startPromise = null; });
    return startPromise;
  }

  async function waitForStateWrites() {
    const waitForSaves = window.VazheyarTest?.waitForSaves;
    if (typeof waitForSaves === "function") await waitForSaves();
    return pendingReviewRevision === null && !reviewWriteFailed;
  }

  async function completeSession() {
    if (!activeSession || activeSession.finishing) return;
    activeSession.finishing = true;
    if (!(await waitForStateWrites())) {
      activeSession.finishing = false;
      return;
    }
    const correct = parseLocalizedInteger(document.querySelector("#completeCorrect")?.textContent);
    const wrong = parseLocalizedInteger(document.querySelector("#completeWrong")?.textContent);
    const durationSeconds = Math.max(0, Math.round((Date.now() - activeSession.startedAt) / 1000));
    const session = activeSession;
    try {
      await requestJson(`/api/learning/sessions/${encodeURIComponent(session.id)}/complete`, {
        method: "PUT",
        body: JSON.stringify({
          completedCount: correct + wrong,
          correctCount: correct,
          wrongCount: wrong,
          durationSeconds
        })
      });
      activeSession = null;
    } catch (error) {
      session.finishing = false;
      console.warn("Could not complete persisted practice session:", error);
    }
  }

  function abandonSession({ keepalive = false } = {}) {
    if (!activeSession || activeSession.finishing) return Promise.resolve();
    activeSession.finishing = true;
    const session = activeSession;
    const durationSeconds = Math.max(0, Math.round((Date.now() - session.startedAt) / 1000));
    activeSession = null;
    return originalFetch(`/api/learning/sessions/${encodeURIComponent(session.id)}/abandon`, {
      method: "POST",
      credentials: "include",
      keepalive,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ durationSeconds })
    }).catch((error) => console.warn("Could not abandon persisted practice session:", error));
  }

  async function trackStateRead(response) {
    if (!response.ok) return response;
    try {
      const payload = await response.clone().json();
      if (payload?.state) {
        // The history returned by the server is authoritative. Deriving the cursor
        // here self-heals stale cursor metadata instead of carrying it into writes.
        persistedCursor = cursorForState(payload.state);
        pendingReviewRevision = null;
        reviewWriteFailed = false;

        if (repairHistoricalMastery(payload.state)) {
          const revision = Number(payload.revision);
          if (!Number.isSafeInteger(revision) || revision < 0) return response;

          payload.state.persistenceCursor = payload.state.persistenceCursor || persistedCursor;
          payload.state.normalizedPersistenceVersion = Math.max(2, Number(payload.state.normalizedPersistenceVersion) || 0);
          const repairResponse = await originalFetch("/api/state", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state: payload.state, revision })
          });
          if (!repairResponse.ok) return response;

          const savedPayload = await repairResponse.clone().json().catch(() => null);
          const savedRevision = Number(savedPayload?.revision);
          if (!Number.isSafeInteger(savedRevision) || savedRevision <= revision) return response;

          payload.revision = savedRevision;
          persistedCursor = cursorForState(payload.state);
          return responseWithPayload(response, payload);
        }
      } else {
        persistedCursor = null;
        pendingReviewRevision = null;
        reviewWriteFailed = false;
      }
    } catch (error) {
      console.warn("Could not repair historical mastery state:", error);
      // The application owns response validation. Repair and cursor tracking are best-effort only.
    }
    return response;
  }

  function prepareStateWrite(init) {
    if (typeof init.body !== "string") return { init, state: null, payload: null };
    try {
      const payload = JSON.parse(init.body);
      if (!payload?.state || typeof payload.state !== "object") return { init, state: null, payload };
      const state = payload.state;
      state.persistenceCursor = persistedCursor || state.persistenceCursor || cursorForState(state);
      state.normalizedPersistenceVersion = Math.max(2, Number(state.normalizedPersistenceVersion) || 0);
      return { init: { ...init, body: JSON.stringify(payload) }, state, payload };
    } catch {
      return { init, state: null, payload: null };
    }
  }

  function cursorPosition(state, cursor) {
    const history = Array.isArray(state?.history) ? state.history : [];
    const length = Number(cursor?.historyLength);
    const fingerprint = cursor?.lastReviewFingerprint || null;
    if (!Number.isSafeInteger(length) || length < 0) return null;
    if (length === 0 && !fingerprint) return 0;
    if (length > 0 && length <= history.length && reviewFingerprint(history[length - 1]) === fingerprint) {
      return length;
    }
    if (!fingerprint) return null;
    for (let index = history.length - 1; index >= 0; index -= 1) {
      if (reviewFingerprint(history[index]) === fingerprint) return index + 1;
    }
    return null;
  }

  function reviewDeltaCount(state) {
    const cursor = persistedCursor || state?.persistenceCursor;
    const history = Array.isArray(state?.history) ? state.history : [];
    const position = cursorPosition(state, cursor);
    return position === null ? null : history.length - position;
  }

  function reviewCommandForState(payload, state) {
    if (reviewDeltaCount(state) !== 1) return null;
    const history = Array.isArray(state?.history) ? state.history : [];
    const event = history.at(-1);
    const word = Array.isArray(state?.words)
      ? state.words.find((item) => String(item?.id) === String(event?.wordId))
      : null;
    const daily = event?.day ? state?.daily?.[event.day] : null;
    const revision = Number(payload?.revision);
    if (!event || !word || !daily || !Number.isSafeInteger(revision) || revision < 0) return null;

    return {
      revision,
      practiceSessionId: activeSession?.id || null,
      word: {
        id: word.id,
        box: word.box,
        due: word.due,
        attempts: word.attempts,
        correct: word.correct,
        mistakes: word.mistakes,
        currentStreak: word.currentStreak,
        introducedOn: word.introducedOn,
        addedSource: word.addedSource,
        lastReviewed: word.lastReviewed,
        lastPromotedDay: word.lastPromotedDay,
        blockedUntil: word.blockedUntil,
        masteredAt: word.masteredAt
      },
      event: {
        at: event.at,
        day: event.day,
        wordId: event.wordId,
        term: event.term,
        answer: event.answer,
        correct: Boolean(event.correct),
        mode: event.mode,
        promoted: Boolean(event.promoted),
        previousBox: event.previousBox,
        newBox: event.newBox,
        mistakeNumber: event.mistakeNumber
      },
      daily: {
        attempts: daily.attempts,
        correct: daily.correct,
        wrong: daily.wrong,
        newAdded: daily.newAdded,
        sessions: daily.sessions,
        durationSeconds: daily.durationSeconds
      }
    };
  }

  async function sendCompactReview(command) {
    const options = {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command)
    };
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await originalFetch("/api/learning/reviews", options);
        if (response.status < 500 || attempt === 1) return response;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
    throw new Error("Review persistence failed.");
  }

  function installFetchContext() {
    window.fetch = async function vocoraFetch(input, init = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      const isStateEndpoint = /\/api\/state(?:\?|$)/u.test(url);

      if (isStateEndpoint && method === "GET") {
        return trackStateRead(await originalFetch(input, init));
      }

      if (isStateEndpoint && method === "PUT") {
        const prepared = prepareStateWrite(init);
        const compactReview = prepared.state ? reviewCommandForState(prepared.payload, prepared.state) : null;
        if (compactReview) {
          const expectedRevision = compactReview.revision + 1;
          pendingReviewRevision = expectedRevision;
          try {
            const response = await sendCompactReview(compactReview);
            const acknowledged = await acknowledgesRevision(response, expectedRevision);
            reviewWriteFailed = !acknowledged;
            if (acknowledged) {
              persistedCursor = cursorForState(prepared.state);
              pendingReviewRevision = null;
            }
            return response;
          } catch (error) {
            reviewWriteFailed = true;
            throw error;
          }
        }

        const reviewDelta = prepared.state ? reviewDeltaCount(prepared.state) : 0;
        const hasReviewDelta = Number(reviewDelta) > 0;
        const baseRevision = Number(prepared.payload?.revision);
        const expectedRevision = Number.isSafeInteger(baseRevision) && baseRevision >= 0 ? baseRevision + 1 : null;
        if (hasReviewDelta) {
          pendingReviewRevision = expectedRevision;
          if (expectedRevision === null) reviewWriteFailed = true;
        }
        const headers = new Headers(typeof input !== "string" ? input.headers : undefined);
        new Headers(prepared.init.headers || {}).forEach((value, key) => headers.set(key, value));
        if (activeSession) headers.set("X-Vocora-Session-Id", activeSession.id);
        try {
          const response = await originalFetch(input, { ...prepared.init, headers });
          if (hasReviewDelta && expectedRevision !== null) {
            const acknowledged = await acknowledgesRevision(response, expectedRevision);
            reviewWriteFailed = !acknowledged;
            if (acknowledged) pendingReviewRevision = null;
          }
          if (response.ok && prepared.state) persistedCursor = cursorForState(prepared.state);
          return response;
        } catch (error) {
          if (hasReviewDelta) reviewWriteFailed = true;
          throw error;
        }
      }

      return originalFetch(input, init);
    };
  }

  function bindSessionStarts() {
    document.querySelector("#beginSessionBtn")?.addEventListener("click", () => setTimeout(() => startSession("review"), 0));
    document.querySelector("#boxOnePracticeBtn")?.addEventListener("click", () => setTimeout(() => startSession("box1"), 0));
    document.querySelector("#practiceExtraBtn")?.addEventListener("click", () => setTimeout(() => startSession("box1"), 0));
    document.querySelector("#newWordsForm")?.addEventListener("submit", () => setTimeout(() => startSession("new"), 0));
  }

  function advanceAfterSave(button) {
    if (advancePromise) return advancePromise;
    button.disabled = true;
    advancePromise = waitForStateWrites()
      .then((canAdvance) => {
        if (!canAdvance) return;
        advanceBypass = true;
        button.disabled = false;
        button.click();
      })
      .finally(() => {
        button.disabled = false;
        advancePromise = null;
      });
    return advancePromise;
  }

  function bindReviewAdvanceBarrier() {
    const button = document.querySelector("#nextCardBtn");
    if (!button) return;

    button.addEventListener("click", (event) => {
      if (advanceBypass) {
        advanceBypass = false;
        return;
      }
      if (!feedbackIsVisible()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      advanceAfterSave(button);
    }, true);

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || !sessionIsVisible() || !feedbackIsVisible() || isRemediationEvent(event)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      advanceAfterSave(button);
    }, true);
  }

  function observeCompletion() {
    const completed = document.querySelector("#sessionComplete");
    if (!completed) return;
    completionObserver = new MutationObserver(() => {
      if (!completed.classList.contains("hidden")) completeSession();
    });
    completionObserver.observe(completed, { attributes: true, attributeFilter: ["class"] });
    document.querySelector("#exitSessionBtn")?.addEventListener("click", () => abandonSession());
    document.querySelectorAll('[data-go="dashboard"]').forEach((button) => {
      button.addEventListener("click", () => {
        if (sessionIsVisible()) abandonSession();
      });
    });
    window.addEventListener("pagehide", () => abandonSession({ keepalive: true }));
  }

  function boot() {
    installFetchContext();
    bindSessionStarts();
    bindReviewAdvanceBarrier();
    observeCompletion();
  }

  window.VocoraSessionPersistenceTest = {
    parseLocalizedInteger,
    reviewFingerprint,
    cursorForState,
    repairHistoricalMastery,
    cursorPosition,
    reviewCommandForState,
    reviewDeltaCount,
    getPersistedCursor: () => persistedCursor,
    getActiveSession: () => activeSession,
    getReviewWriteFailed: () => reviewWriteFailed,
    getPendingReviewRevision: () => pendingReviewRevision,
    waitForStateWrites,
    startSession,
    completeSession,
    abandonSession
  };
  boot();
})();