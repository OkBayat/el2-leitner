(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.practiceRemediation.keyboardGuard');
  const REVIEW_UX_LOADER = Symbol.for('vocora.reviewSessionUx.loader');
  const REMEDIATION_ROOT = '#practiceRemediation';
  const REVIEW_UX_SCRIPT_ID = 'vocora-review-session-ux-script';
  const REVIEW_UX_SCRIPT_SRC = 'review-session-ux.js';

  function ownsEnter(event) {
    return event?.key === 'Enter'
      && Boolean(event.target?.closest?.(REMEDIATION_ROOT));
  }

  function install(documentObject = globalThis.document) {
    if (!documentObject?.addEventListener) return false;
    if (documentObject[INSTALLATION]) return false;

    const handler = (event) => {
      if (!ownsEnter(event)) return;

      // The focused button/input has already received the bubbling event. Stop only
      // later document-level shortcuts; do not prevent the native click/form action.
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
    if (documentObject[REVIEW_UX_LOADER]) return false;
    if (documentObject.getElementById?.(REVIEW_UX_SCRIPT_ID)) return false;

    const parent = documentObject.head || documentObject.documentElement;
    if (!parent?.append) return false;

    const script = documentObject.createElement('script');
    script.id = REVIEW_UX_SCRIPT_ID;
    script.src = REVIEW_UX_SCRIPT_SRC;
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
    install,
    loadReviewSessionUx
  });

  install();
  loadReviewSessionUx();
})();
