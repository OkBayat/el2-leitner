(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  let activeSession = null;
  let completionObserver = null;
  let startPromise = null;
  let persistedCursor = null;

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

  function sessionIsVisible() {
    const node = document.querySelector("#reviewSession");
    return Boolean(node && !node.classList.contains("hidden"));
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

  async function completeSession() {
    if (!activeSession || activeSession.finishing) return;
    activeSession.finishing = true;
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
        persistedCursor = payload.state.persistenceCursor || cursorForState(payload.state);
      } else {
        persistedCursor = null;
      }
    } catch {
      // The application owns response validation. Cursor tracking is best-effort only.
    }
    return response;
  }

  function prepareStateWrite(init) {
    if (typeof init.body !== "string") return { init, state: null };
    try {
      const payload = JSON.parse(init.body);
      if (!payload?.state || typeof payload.state !== "object") return { init, state: null };
      const state = payload.state;
      state.persistenceCursor = persistedCursor || state.persistenceCursor || cursorForState(state);
      state.normalizedPersistenceVersion = Math.max(2, Number(state.normalizedPersistenceVersion) || 0);
      return { init: { ...init, body: JSON.stringify(payload) }, state };
    } catch {
      return { init, state: null };
    }
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
        const headers = new Headers(typeof input !== "string" ? input.headers : undefined);
        new Headers(prepared.init.headers || {}).forEach((value, key) => headers.set(key, value));
        if (activeSession) headers.set("X-Vocora-Session-Id", activeSession.id);
        const response = await originalFetch(input, { ...prepared.init, headers });
        if (response.ok && prepared.state) persistedCursor = cursorForState(prepared.state);
        return response;
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
    observeCompletion();
  }

  window.VocoraSessionPersistenceTest = {
    parseLocalizedInteger,
    reviewFingerprint,
    cursorForState,
    getPersistedCursor: () => persistedCursor,
    getActiveSession: () => activeSession,
    startSession,
    completeSession,
    abandonSession
  };
  boot();
})();
