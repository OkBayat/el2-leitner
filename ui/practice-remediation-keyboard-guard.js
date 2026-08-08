(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.practiceRemediation.keyboardGuard');
  const REVIEW_UX_LOADER = Symbol.for('vocora.reviewSessionUx.loader');
  const REMEDIATION_ROOT = '#practiceRemediation';
  const FEEDBACK_CONTINUE = '#answerFeedback #nextCardBtn';
  const REVIEW_UX_SCRIPT_ID = 'vocora-review-session-ux-script';

  function ownsEnter(event) {
    return event?.key === 'Enter'
      && Boolean(event.target?.closest?.(REMEDIATION_ROOT));
  }

  function isDeferred(windowObject, documentObject) {
    const active = windowObject?.VocoraPracticeRemediation?.snapshot?.()?.active;
    return Boolean(
      active?.presentationDeferred
      || documentObject?.querySelector?.('#practiceRemediation.vocora-remediation-delayed')
    );
  }

  function install(documentObject = globalThis.document, windowObject = documentObject?.defaultView || globalThis.window) {
    if (!documentObject?.addEventListener) return false;
    if (documentObject[INSTALLATION]) return false;

    const handler = (event) => {
      if (event?.key !== 'Enter') return;
      const insideRemediation = Boolean(event.target?.closest?.(REMEDIATION_ROOT));
      const deferred = isDeferred(windowObject, documentObject);
      if (!insideRemediation && !deferred) return;

      if (deferred && !insideRemediation) {
        const continueButton = documentObject.querySelector?.(FEEDBACK_CONTINUE);
        if (continueButton) {
          event.preventDefault();
          continueButton.click();
        }
      }

      // Preserve the focused remediation control's native Enter behavior, while
      // preventing app-v2's later document shortcut from advancing the card.
      event.stopImmediatePropagation();
    };

    documentObject.addEventListener('keydown', handler);
    Object.defineProperty(documentObject, INSTALLATION, {
      value: handler,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  function loadReviewSessionUx(documentObject = globalThis.document) {
    if (!documentObject?.createElement) return false;
    if (globalThis.VocoraReviewSessionUx) return false;
    if (documentObject[REVIEW_UX_LOADER]) return false;
    if (documentObject.getElementById?.(REVIEW_UX_SCRIPT_ID)) return false;

    const parent = documentObject.head || documentObject.documentElement;
    if (!parent?.append) return false;

    const script = documentObject.createElement('script');
    script.id = REVIEW_UX_SCRIPT_ID;
    // A unique URL per page load prevents browser/CDN reuse of a stale review
    // coordinator while the rest of the deployment has already changed.
    script.src = `review-session-ux.js?v=${Date.now()}`;
    script.async = false;
    parent.append(script);

    Object.defineProperty(documentObject, REVIEW_UX_LOADER, {
      value: script,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  globalThis.VocoraRemediationKeyboardGuard = Object.freeze({
    ownsEnter,
    isDeferred,
    install,
    loadReviewSessionUx
  });

  install();
  loadReviewSessionUx();
})();
