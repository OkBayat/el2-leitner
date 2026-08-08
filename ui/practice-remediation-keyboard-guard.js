(() => {
  'use strict';

  const LOADER = Symbol.for('vocora.practiceSession.compatibilityLoader');
  const RELEASE = '20260808-enter-router2';

  function appendScript(documentObject, id, src) {
    if (!documentObject?.createElement) return null;
    const existing = documentObject.getElementById?.(id);
    if (existing) return existing;
    const parent = documentObject.head || documentObject.documentElement;
    if (!parent?.append) return null;
    const script = documentObject.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    parent.append(script);
    return script;
  }

  function install(documentObject = globalThis.document, windowObject = documentObject?.defaultView || globalThis.window) {
    if (!documentObject || !windowObject) return false;
    if (windowObject[LOADER]) return false;

    // This legacy filename is intentionally kept as a compatibility bootstrap.
    // It no longer owns Enter. It only loads the single window-capture router
    // through a never-before-cached URL and keeps old HTML releases functional.
    if (!windowObject.VocoraPracticeKeyboardRouter) {
      appendScript(
        documentObject,
        'vocora-practice-session-keyboard-router',
        `practice-session-keyboard-router.js?v=${RELEASE}-${Date.now()}`
      );
    }

    if (!windowObject.VocoraReviewSessionUx) {
      appendScript(
        documentObject,
        'vocora-review-session-ux-script',
        `review-session-ux.js?v=${RELEASE}-${Date.now()}`
      );
    }

    Object.defineProperty(windowObject, LOADER, {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  globalThis.VocoraRemediationKeyboardGuard = Object.freeze({
    RELEASE,
    install,
    loadReviewSessionUx: install
  });

  install();
})();
