(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.practiceRemediation.keyboardGuard');
  const REVIEW_UX_LOADER = Symbol.for('vocora.reviewSessionUx.loader');
  const REVIEW_UX_SCRIPT_ID = 'vocora-review-session-ux-script';

  const SELECTORS = Object.freeze({
    reviewSession: '#reviewSession',
    feedback: '#answerFeedback',
    feedbackContinue: '#answerFeedback #nextCardBtn',
    remediation: '#practiceRemediation',
    remediationForm: '#practiceRemediation #remediationForm',
    remediationInput: '#practiceRemediation #remediationInput',
    remediationSubmit: '#practiceRemediation #remediationSubmitBtn',
    remediationAcknowledge: '#practiceRemediation #remediationAcknowledgeBtn',
    remediationContinue: '#practiceRemediation #remediationContinueBtn'
  });

  function ownsEnter(event) {
    return event?.key === 'Enter'
      && Boolean(event.target?.closest?.(SELECTORS.remediation));
  }

  function isDeferred(windowObject, documentObject) {
    const active = windowObject?.VocoraPracticeRemediation?.snapshot?.()?.active;
    return Boolean(
      active?.presentationDeferred
      || documentObject?.querySelector?.('#practiceRemediation.vocora-remediation-delayed')
    );
  }

  function isAvailable(element) {
    if (!element || element.disabled) return false;
    let current = element;
    while (current?.nodeType === 1) {
      if (current.hidden || current.classList?.contains('hidden')) return false;
      current = current.parentElement;
    }
    return true;
  }

  function repairInteractivePath(element) {
    let current = element;
    while (current?.nodeType === 1) {
      if (current.hidden || current.classList?.contains('hidden')) break;
      current.removeAttribute?.('inert');
      if (current.getAttribute?.('aria-hidden') === 'true') {
        current.setAttribute('aria-hidden', 'false');
      }
      if (current.matches?.(SELECTORS.reviewSession)) break;
      current = current.parentElement;
    }
  }

  function remediationSnapshot(windowObject) {
    return windowObject?.VocoraPracticeRemediation?.snapshot?.()?.active || null;
  }

  function visibleStage(documentObject, windowObject) {
    const session = documentObject.querySelector?.(SELECTORS.reviewSession);
    const declared = session?.dataset?.vocoraStage || '';
    const feedback = documentObject.querySelector?.(SELECTORS.feedback);
    const remediation = documentObject.querySelector?.(SELECTORS.remediation);
    const feedbackVisible = isAvailable(feedback);
    const remediationVisible = isAvailable(remediation);
    const active = remediationSnapshot(windowObject);

    if (active?.presentationDeferred && feedbackVisible) return 'feedback';
    if (declared.startsWith('feedback-') && feedbackVisible) return 'feedback';
    if (declared.startsWith('remediation-') && remediationVisible) return 'remediation';
    if (feedbackVisible) return 'feedback';
    if (remediationVisible) return 'remediation';
    return null;
  }

  function visibleElement(documentObject, selector) {
    const element = documentObject.querySelector?.(selector);
    return isAvailable(element) ? element : null;
  }

  function resolveEnterAction(event, documentObject, windowObject) {
    if (event?.key !== 'Enter') return null;

    const stage = visibleStage(documentObject, windowObject);
    if (!stage) return null;

    if (stage === 'feedback') {
      const button = visibleElement(documentObject, SELECTORS.feedbackContinue);
      return button ? { type: 'click', element: button, reason: 'feedback-continue' } : null;
    }

    const remediation = visibleElement(documentObject, SELECTORS.remediation);
    if (!remediation) return null;

    const target = event.target;
    const focusedButton = target?.closest?.('button');
    if (focusedButton && remediation.contains(focusedButton) && isAvailable(focusedButton)) {
      return { type: 'click', element: focusedButton, reason: 'focused-remediation-button' };
    }

    const form = visibleElement(documentObject, SELECTORS.remediationForm);
    const input = visibleElement(documentObject, SELECTORS.remediationInput);
    const submit = visibleElement(documentObject, SELECTORS.remediationSubmit);
    if (form && input && (target === input || input.contains?.(target))) {
      return { type: 'submit', form, submitter: submit, reason: 'remediation-input' };
    }

    const acknowledge = visibleElement(documentObject, SELECTORS.remediationAcknowledge);
    if (acknowledge) return { type: 'click', element: acknowledge, reason: 'correction-acknowledge' };

    const continueButton = visibleElement(documentObject, SELECTORS.remediationContinue);
    if (continueButton) return { type: 'click', element: continueButton, reason: 'remediation-continue' };

    if (form && input) {
      if (String(input.value || '').trim()) {
        return { type: 'submit', form, submitter: submit, reason: 'remediation-form-value' };
      }
      return { type: 'focus', element: input, reason: 'remediation-form-empty' };
    }

    return null;
  }

  function requestSubmit(form, submitter, windowObject) {
    if (typeof form?.requestSubmit === 'function') {
      form.requestSubmit(submitter || undefined);
      return;
    }
    form?.dispatchEvent?.(new windowObject.Event('submit', { bubbles: true, cancelable: true }));
  }

  function executeEnterAction(action, event, windowObject) {
    if (!action) return false;
    event.preventDefault();
    event.stopImmediatePropagation();

    repairInteractivePath(action.element || action.form);
    if (action.type === 'click') action.element.click();
    else if (action.type === 'submit') requestSubmit(action.form, action.submitter, windowObject);
    else if (action.type === 'focus') action.element.focus?.({ preventScroll: true });
    return true;
  }

  function handleEnter(event, documentObject, windowObject) {
    if (event?.key !== 'Enter') return false;
    const stage = visibleStage(documentObject, windowObject);
    if (!stage) return false;

    if (event.isComposing || event.keyCode === 229) {
      event.stopImmediatePropagation();
      return true;
    }

    if (event.repeat) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }

    return executeEnterAction(
      resolveEnterAction(event, documentObject, windowObject),
      event,
      windowObject
    );
  }

  function install(documentObject = globalThis.document, windowObject = documentObject?.defaultView || globalThis.window) {
    if (!documentObject?.addEventListener) return false;
    if (documentObject[INSTALLATION]) return false;

    const handler = (event) => handleEnter(event, documentObject, windowObject);

    // One capture-phase router invokes the visible control's real click/submit
    // handler before the adapter or app-v2 can swallow Enter or advance the card.
    documentObject.addEventListener('keydown', handler, true);
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
    SELECTORS,
    ownsEnter,
    isDeferred,
    isAvailable,
    repairInteractivePath,
    visibleStage,
    resolveEnterAction,
    executeEnterAction,
    handleEnter,
    install,
    loadReviewSessionUx
  });

  install();
  loadReviewSessionUx();
})();
