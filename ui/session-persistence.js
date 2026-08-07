(() => {
  "use strict";

  const originalFetch = window.fetch.bind(window);
  let activeSession = null;
  let completionObserver = null;
  let startPromise = null;

  function parseLocalizedInteger(value) {
    const digits = String(value ?? "")
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
      .replace(/[^0-9-]/g, "");
    const parsed = Number(digits);
    return Number.isSafeInteger(parsed) ? parsed : 0;
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

  function installFetchContext() {
    window.fetch = function vocoraFetch(input, init = {}) {
      const url = typeof input === "string" ? input : input?.url || "";
      const method = String(init.method || (typeof input !== "string" ? input?.method : "GET") || "GET").toUpperCase();
      if (activeSession && method === "PUT" && /\/api\/state(?:\?|$)/u.test(url)) {
        const headers = new Headers(typeof input !== "string" ? input.headers : undefined);
        new Headers(init.headers || {}).forEach((value, key) => headers.set(key, value));
        headers.set("X-Vocora-Session-Id", activeSession.id);
        return originalFetch(input, { ...init, headers });
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
    getActiveSession: () => activeSession,
    startSession,
    completeSession,
    abandonSession
  };
  boot();
})();
