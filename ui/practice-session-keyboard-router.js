(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.practiceSession.keyboardRouter');
  const RELEASE = '20260808-enter-router2';

  const SELECTORS = Object.freeze({
    reviewSession: '#reviewSession',
    answerInput: '#answerInput',
    feedback: '#answerFeedback',
    feedbackContinue: '#answerFeedback #nextCardBtn',
    remediation: '#practiceRemediation',
    remediationInput: '#practiceRemediation #remediationInput',
    remediationListen: '#practiceRemediation #remediationListenBtn',
    remediationAcknowledge: '#practiceRemediation #remediationAcknowledgeBtn',
    remediationContinue: '#practiceRemediation #remediationContinueBtn'
  });

  function isEnter(event) {
    return event?.key === 'Enter' || event?.code === 'NumpadEnter';
  }

  function isDomVisible(element) {
    if (!element || element.disabled) return false;
    let current = element;
    while (current?.nodeType === 1) {
      if (current.hidden || current.classList?.contains('hidden')) return false;
      current = current.parentElement;
    }
    return true;
  }

  function activeAttempt(windowObject = globalThis.window) {
    return windowObject?.VocoraPracticeRemediation?.snapshot?.()?.active || null;
  }

  function controller(windowObject = globalThis.window) {
    return windowObject?.VocoraPracticeRemediation || null;
  }

  function feedbackVisible(documentObject = globalThis.document) {
    return isDomVisible(documentObject?.querySelector?.(SELECTORS.feedback));
  }

  function remediationVisible(documentObject = globalThis.document) {
    return isDomVisible(documentObject?.querySelector?.(SELECTORS.remediation));
  }

  function sessionVisible(documentObject = globalThis.document) {
    return isDomVisible(documentObject?.querySelector?.(SELECTORS.reviewSession));
  }

  function focusedSecondaryAction(event, documentObject) {
    const button = event?.target?.closest?.('button');
    const remediation = documentObject?.querySelector?.(SELECTORS.remediation);
    if (!button || !remediation?.contains(button) || !isDomVisible(button)) return null;

    if (button.matches(SELECTORS.remediationListen)) return button;
    return null;
  }

  function resolveAction(event, windowObject, documentObject) {
    if (!isEnter(event) || !sessionVisible(documentObject)) return null;

    const active = activeAttempt(windowObject);
    const remediationController = controller(windowObject);
    const feedbackIsVisible = feedbackVisible(documentObject);
    const remediationIsVisible = remediationVisible(documentObject);

    // Normal cards remain owned by the native form and app-v2 shortcuts.
    if (!active) {
      if (!feedbackIsVisible) return null;
      const next = documentObject.querySelector?.(SELECTORS.feedbackContinue);
      return isDomVisible(next)
        ? { type: 'click', element: next, reason: 'ordinary-feedback-continue' }
        : null;
    }

    // The persistent domain snapshot is the source of truth. A deferred immediate
    // correction means the red/yellow feedback owns the screen, regardless of
    // focus, DOM races, or which coordinator loaded first.
    if (active.presentationDeferred) {
      return typeof remediationController?.revealDeferredPresentation === 'function'
        ? { type: 'controller', method: 'revealDeferredPresentation', reason: 'deferred-feedback-continue' }
        : null;
    }

    // A deliberately focused secondary remediation control keeps its own action.
    const secondary = focusedSecondaryAction(event, documentObject);
    if (secondary) return { type: 'click', element: secondary, reason: 'focused-secondary-action' };

    if (active.phase === 'correction') {
      return typeof remediationController?.acknowledge === 'function'
        ? { type: 'controller', method: 'acknowledge', reason: 'correction-acknowledge' }
        : null;
    }

    if (active.phase === 'recall' || active.phase === 'copy') {
      const input = documentObject.querySelector?.(SELECTORS.remediationInput);
      if (!isDomVisible(input)) return null;
      const value = String(input.value || '').trim();
      if (!value) return { type: 'focus', element: input, reason: 'empty-remediation-input' };
      return typeof remediationController?.submitRemediationAnswer === 'function'
        ? {
            type: 'controller',
            method: 'submitRemediationAnswer',
            args: [input.value],
            reason: `${active.phase}-submit`
          }
        : null;
    }

    if (active.phase === 'completed') {
      return typeof remediationController?.continueSession === 'function'
        ? { type: 'controller', method: 'continueSession', reason: 'remediation-continue' }
        : null;
    }

    // Defensive fallback for a cached adapter whose snapshot is incomplete.
    if (feedbackIsVisible) {
      const next = documentObject.querySelector?.(SELECTORS.feedbackContinue);
      if (isDomVisible(next)) return { type: 'click', element: next, reason: 'feedback-fallback' };
    }
    if (remediationIsVisible) {
      const acknowledge = documentObject.querySelector?.(SELECTORS.remediationAcknowledge);
      if (isDomVisible(acknowledge)) return { type: 'click', element: acknowledge, reason: 'correction-fallback' };
      const continueButton = documentObject.querySelector?.(SELECTORS.remediationContinue);
      if (isDomVisible(continueButton)) return { type: 'click', element: continueButton, reason: 'continue-fallback' };
    }
    return null;
  }

  function executeAction(action, event, windowObject) {
    if (!action) return false;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (action.type === 'controller') {
      const remediationController = controller(windowObject);
      remediationController?.[action.method]?.(...(action.args || []));
      return true;
    }
    if (action.type === 'click') {
      action.element?.click?.();
      return true;
    }
    if (action.type === 'focus') {
      action.element?.focus?.({ preventScroll: true });
      return true;
    }
    return false;
  }

  function handleKeydown(event, windowObject, documentObject) {
    if (!isEnter(event)) return false;

    if (event.isComposing || event.keyCode === 229) {
      // Do not submit an unfinished IME composition, but also do not let the
      // legacy global shortcut advance the card underneath it.
      if (activeAttempt(windowObject)) event.stopImmediatePropagation();
      return false;
    }

    if (event.repeat) {
      if (activeAttempt(windowObject)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      return false;
    }

    return executeAction(
      resolveAction(event, windowObject, documentObject),
      event,
      windowObject
    );
  }

  function install(windowObject = globalThis.window, documentObject = windowObject?.document || globalThis.document) {
    if (!windowObject?.addEventListener || !documentObject) return false;
    if (windowObject[INSTALLATION]) return false;

    const handler = (event) => handleKeydown(event, windowObject, documentObject);

    // Window capture runs before every document-level listener, independent of
    // script registration order. This prevents both the remediation adapter and
    // app-v2 from swallowing or misrouting Enter.
    windowObject.addEventListener('keydown', handler, true);
    Object.defineProperty(windowObject, INSTALLATION, {
      value: handler,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  globalThis.VocoraPracticeKeyboardRouter = Object.freeze({
    RELEASE,
    SELECTORS,
    isEnter,
    isDomVisible,
    activeAttempt,
    feedbackVisible,
    remediationVisible,
    resolveAction,
    executeAction,
    handleKeydown,
    install
  });

  install();
})();
