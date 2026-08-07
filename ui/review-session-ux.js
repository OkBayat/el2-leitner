(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.reviewSessionUx');
  const STYLE_ID = 'vocora-review-session-ux-style';
  const STYLE_HREF = 'review-session-ux.css';
  const PRIMARY_SELECTOR = '#answerForm button[type="submit"]';
  const PRACTICE_INPUT_SELECTOR = '#answerInput, #remediationInput';
  const SKIP_WINDOW_MS = 430;

  function isVisible(element) {
    return Boolean(element && !element.classList.contains('hidden'));
  }

  function ensureStyles(documentObject = globalThis.document) {
    if (!documentObject?.head || documentObject.getElementById(STYLE_ID)) return false;
    const link = documentObject.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = STYLE_HREF;
    documentObject.head.append(link);
    return true;
  }

  function currentWord(windowObject = globalThis.window) {
    return windowObject?.VazheyarTest?.getCurrentWord?.() || null;
  }

  function acceptedSpelling(windowObject = globalThis.window) {
    const word = currentWord(windowObject);
    if (!word) return '';
    const accepted = Array.isArray(word.accepted) && word.accepted.length
      ? word.accepted
      : [word.term];
    return accepted.filter(Boolean).join(' / ');
  }

  function createController(windowObject = globalThis.window, documentObject = globalThis.document) {
    if (!windowObject || !documentObject) return null;

    const body = documentObject.body;
    const root = documentObject.documentElement;
    const reviewSession = documentObject.querySelector('#reviewSession');
    const reviewView = documentObject.querySelector('#view-review');
    const flashCard = documentObject.querySelector('#flashCard');
    const answerForm = documentObject.querySelector('#answerForm');
    const answerInput = documentObject.querySelector('#answerInput');
    const feedback = documentObject.querySelector('#answerFeedback');
    const dontKnowButton = documentObject.querySelector('#dontKnowBtn');

    if (!body || !root || !reviewSession || !flashCard || !answerForm || !answerInput || !feedback) {
      return null;
    }

    const state = {
      active: false,
      savedScrollY: 0,
      largestViewportHeight: 0,
      skipTapCount: 0,
      skipTapTimer: null,
      skipTriggered: false,
      delayedRemediation: false,
      observer: null,
      syncQueued: false
    };

    function ensureSessionChrome() {
      const sessionBar = documentObject.querySelector('.session-bar');
      const accuracy = documentObject.querySelector('#sessionAccuracy');
      if (!sessionBar || !accuracy) return;

      let badge = documentObject.querySelector('#vocoraSessionAccuracy');
      if (!badge) {
        badge = documentObject.createElement('div');
        badge.id = 'vocoraSessionAccuracy';
        badge.className = 'vocora-session-accuracy';
        badge.setAttribute('aria-label', 'دقت جلسه');
        sessionBar.append(badge);
      }
      if (accuracy.parentElement !== badge) badge.append(accuracy);
    }

    function ensurePrimaryControls() {
      const button = documentObject.querySelector(PRIMARY_SELECTOR);
      if (!button) return null;

      button.classList.add('vocora-primary-review-action');
      button.removeAttribute('disabled');
      answerInput.setAttribute('aria-label', 'پاسخ');

      let hint = documentObject.querySelector('#vocoraDoubleTapHint');
      if (!hint) {
        hint = documentObject.createElement('div');
        hint.id = 'vocoraDoubleTapHint';
        hint.className = 'vocora-double-tap-hint';
        hint.textContent = 'نمی‌دانی؟ دو بار روی دکمه بزن';
        hint.setAttribute('aria-live', 'polite');
        button.insertAdjacentElement('afterend', hint);
      }

      button.setAttribute('aria-describedby', hint.id);
      return button;
    }

    function clearSkipTapState({ keepTriggered = false } = {}) {
      state.skipTapCount = 0;
      if (state.skipTapTimer) {
        windowObject.clearTimeout(state.skipTapTimer);
        state.skipTapTimer = null;
      }
      const button = documentObject.querySelector(PRIMARY_SELECTOR);
      const hint = documentObject.querySelector('#vocoraDoubleTapHint');
      button?.classList.remove('skip-armed');
      if (button && button.textContent !== 'بررسی پاسخ') button.textContent = 'بررسی پاسخ';
      if (hint) hint.textContent = 'نمی‌دانی؟ دو بار روی دکمه بزن';
      if (!keepTriggered) state.skipTriggered = false;
    }

    function updatePrimaryState() {
      const button = ensurePrimaryControls();
      if (!button) return;
      const hasAnswer = answerInput.value.trim().length > 0;
      answerForm.classList.toggle('vocora-has-answer', hasAnswer);
      button.classList.toggle('is-empty', !hasAnswer);
      button.dataset.empty = hasAnswer ? 'false' : 'true';
      button.setAttribute(
        'aria-label',
        hasAnswer
          ? 'بررسی پاسخ'
          : 'پاسخی ننوشته‌ای. برای انتخاب نمی‌دانم دو بار روی این دکمه بزن.'
      );
      if (hasAnswer) clearSkipTapState();
    }

    function armSkip() {
      const button = ensurePrimaryControls();
      const hint = documentObject.querySelector('#vocoraDoubleTapHint');
      if (!button) return;

      state.skipTapCount = 1;
      button.classList.add('skip-armed');
      button.textContent = 'یک بار دیگر بزن';
      if (hint) hint.textContent = 'یک بار دیگر بزن تا «نمی‌دانم» ثبت شود';

      if (state.skipTapTimer) windowObject.clearTimeout(state.skipTapTimer);
      state.skipTapTimer = windowObject.setTimeout(() => clearSkipTapState(), SKIP_WINDOW_MS);
    }

    function submitDontKnow() {
      clearSkipTapState({ keepTriggered: true });
      state.skipTriggered = true;
      answerInput.blur();
      if (dontKnowButton) dontKnowButton.click();
    }

    function handlePrimaryClick(event) {
      const button = event.target?.closest?.(PRIMARY_SELECTOR);
      if (!button || !state.active) return;

      if (answerInput.value.trim()) {
        clearSkipTapState();
        answerInput.blur();
        return;
      }

      event.preventDefault();
      if (state.skipTapCount === 0) {
        armSkip();
        return;
      }
      submitDontKnow();
    }

    function handleAnswerSubmit(event) {
      if (event.target !== answerForm || !state.active) return;
      if (!answerInput.value.trim()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (state.skipTapCount === 0) armSkip();
        return;
      }
      clearSkipTapState();
      answerInput.blur();
    }

    function feedbackType() {
      if (!isVisible(feedback)) return null;
      if (state.skipTriggered) return 'warning';
      return feedback.classList.contains('wrong') ? 'wrong' : 'correct';
    }

    function setTextIfChanged(element, text) {
      if (element && element.textContent !== text) element.textContent = text;
    }

    function restoreCorrectSpelling() {
      const spelling = acceptedSpelling(windowObject);
      const target = documentObject.querySelector('#correctAnswer');
      if (spelling && target && !target.textContent.trim()) target.textContent = spelling;
    }

    function applyFeedbackCopy(type) {
      const title = documentObject.querySelector('#feedbackTitle');
      const detail = documentObject.querySelector('#feedbackDetail');
      const icon = documentObject.querySelector('#feedbackIcon');
      const next = documentObject.querySelector('#nextCardBtn');

      if (type === 'correct') {
        setTextIfChanged(title, 'عالیه!');
        if (!detail?.textContent?.trim()) setTextIfChanged(detail, 'درست نوشتی.');
        setTextIfChanged(icon, '✓');
      } else if (type === 'warning') {
        setTextIfChanged(title, 'اشکالی ندارد');
        setTextIfChanged(detail, 'این کلمه برای مرور دوباره برمی‌گردد.');
        setTextIfChanged(icon, '!');
        restoreCorrectSpelling();
      } else if (type === 'wrong') {
        setTextIfChanged(title, 'اشتباه بود');
        setTextIfChanged(detail, 'پاسخ درست را یک بار با دقت ببین.');
        setTextIfChanged(icon, '×');
        restoreCorrectSpelling();
      }
      setTextIfChanged(next, 'ادامه');
    }

    function clearFeedbackClasses() {
      body.classList.remove(
        'vocora-feedback-open',
        'vocora-review-correct',
        'vocora-review-wrong',
        'vocora-review-warning'
      );
      answerInput.classList.remove(
        'vocora-answer-correct',
        'vocora-answer-wrong',
        'vocora-answer-warning'
      );
      answerForm.classList.remove('vocora-feedback-form');
    }

    function syncFeedback() {
      const remediationActive = flashCard.classList.contains('remediation-active');
      if (remediationActive && !state.delayedRemediation) {
        clearFeedbackClasses();
        return;
      }

      const type = feedbackType();
      if (!type) {
        clearFeedbackClasses();
        answerInput.readOnly = false;
        if (!state.delayedRemediation) state.skipTriggered = false;
        return;
      }

      body.classList.add('vocora-feedback-open');
      body.classList.toggle('vocora-review-correct', type === 'correct');
      body.classList.toggle('vocora-review-wrong', type === 'wrong');
      body.classList.toggle('vocora-review-warning', type === 'warning');
      answerInput.classList.toggle('vocora-answer-correct', type === 'correct');
      answerInput.classList.toggle('vocora-answer-wrong', type === 'wrong');
      answerInput.classList.toggle('vocora-answer-warning', type === 'warning');
      answerForm.classList.add('vocora-feedback-form');
      answerInput.readOnly = true;
      answerInput.blur();
      applyFeedbackCopy(type);
    }

    function ensureRemediationPreviewButton(remediationRoot) {
      if (!remediationRoot) return null;
      let button = remediationRoot.querySelector('#vocoraRemediationPreviewContinue');
      if (button) return button;

      button = documentObject.createElement('button');
      button.id = 'vocoraRemediationPreviewContinue';
      button.className = 'btn btn-primary wide vocora-remediation-preview-continue';
      button.type = 'button';
      button.textContent = 'ادامه';
      button.addEventListener('click', revealDelayedRemediation);
      remediationRoot.append(button);
      return button;
    }

    function delayImmediateRemediation() {
      const remediationRoot = documentObject.querySelector('#practiceRemediation');
      if (!remediationRoot || !isVisible(remediationRoot)) return;

      state.delayedRemediation = true;
      flashCard.classList.remove('remediation-active');
      remediationRoot.classList.add('vocora-remediation-delayed');
      feedback.classList.add('vocora-previewing-remediation');
      ensureRemediationPreviewButton(remediationRoot)?.classList.remove('hidden');
      restoreCorrectSpelling();
      syncFeedback();
    }

    function revealDelayedRemediation() {
      if (!state.delayedRemediation) return;
      const remediationRoot = documentObject.querySelector('#practiceRemediation');
      state.delayedRemediation = false;
      state.skipTriggered = false;
      feedback.classList.remove('vocora-previewing-remediation');
      remediationRoot?.classList.remove('vocora-remediation-delayed');
      remediationRoot?.querySelector('#vocoraRemediationPreviewContinue')?.classList.add('hidden');
      flashCard.classList.add('remediation-active');
      clearFeedbackClasses();
      windowObject.setTimeout(() => {
        remediationRoot?.querySelector('#remediationAcknowledgeBtn:not(.hidden)')?.focus();
      }, 0);
    }

    function syncRemediation() {
      const remediationRoot = documentObject.querySelector('#practiceRemediation');
      if (!remediationRoot) return;
      if (state.delayedRemediation) {
        ensureRemediationPreviewButton(remediationRoot);
        return;
      }
      if (remediationRoot.classList.contains('hidden')) {
        feedback.classList.remove('vocora-previewing-remediation');
      }
    }

    function practiceInputFocused() {
      const activeElement = documentObject.activeElement;
      return Boolean(activeElement?.matches?.(PRACTICE_INPUT_SELECTOR));
    }

    function syncVisualViewport() {
      const visualViewport = windowObject.visualViewport;
      const height = Math.round(visualViewport?.height || windowObject.innerHeight || 0);
      const offsetTop = Math.round(visualViewport?.offsetTop || 0);

      if (height > 0) {
        root.style.setProperty('--vocora-review-viewport-height', `${height}px`);
        root.style.setProperty('--vocora-review-viewport-top', `${offsetTop}px`);
      }

      if (!practiceInputFocused() && height > 0) {
        state.largestViewportHeight = Math.max(state.largestViewportHeight, height);
      } else if (state.largestViewportHeight === 0 && height > 0) {
        state.largestViewportHeight = Math.max(height, Number(windowObject.innerHeight) || height);
      }

      const materiallyReduced = state.largestViewportHeight > 0
        && height > 0
        && height < state.largestViewportHeight - 140;
      body.classList.toggle(
        'vocora-keyboard-open',
        state.active && (practiceInputFocused() || materiallyReduced)
      );

      if (state.active && typeof windowObject.scrollTo === 'function') {
        try { windowObject.scrollTo(0, 0); } catch {}
      }
    }

    function enterSessionMode() {
      if (state.active) return;
      state.active = true;
      state.savedScrollY = Number(windowObject.scrollY) || 0;
      body.classList.add('vocora-session-active');
      root.classList.add('vocora-session-active');
      ensureSessionChrome();
      ensurePrimaryControls();
      syncVisualViewport();
    }

    function leaveSessionMode() {
      if (!state.active) return;
      state.active = false;
      state.delayedRemediation = false;
      state.skipTriggered = false;
      clearSkipTapState();
      clearFeedbackClasses();
      body.classList.remove('vocora-session-active', 'vocora-keyboard-open');
      root.classList.remove('vocora-session-active');
      const remediationRoot = documentObject.querySelector('#practiceRemediation');
      remediationRoot?.classList.remove('vocora-remediation-delayed');
      feedback.classList.remove('vocora-previewing-remediation');
      answerInput.readOnly = false;

      if (typeof windowObject.scrollTo === 'function') {
        windowObject.setTimeout(() => {
          try { windowObject.scrollTo(0, state.savedScrollY); } catch {}
        }, 0);
      }
    }

    function syncSessionMode() {
      const reviewIsActive = Boolean(reviewView?.classList.contains('active'));
      if (reviewIsActive && isVisible(reviewSession)) enterSessionMode();
      else leaveSessionMode();
    }

    function syncAll() {
      state.syncQueued = false;
      syncSessionMode();
      if (!state.active) return;
      ensureSessionChrome();
      ensurePrimaryControls();
      updatePrimaryState();
      syncRemediation();
      syncFeedback();
      syncVisualViewport();
    }

    function requestSync() {
      if (state.syncQueued) return;
      state.syncQueued = true;
      if (typeof windowObject.requestAnimationFrame === 'function') {
        windowObject.requestAnimationFrame(syncAll);
      } else {
        windowObject.setTimeout(syncAll, 0);
      }
    }

    function handleFocusIn(event) {
      if (event.target?.matches?.(PRACTICE_INPUT_SELECTOR)) {
        body.classList.add('vocora-keyboard-open');
        requestSync();
      }
    }

    function handleFocusOut(event) {
      if (!event.target?.matches?.(PRACTICE_INPUT_SELECTOR)) return;
      windowObject.setTimeout(syncVisualViewport, 40);
    }

    function installObserver() {
      if (typeof windowObject.MutationObserver !== 'function') return;
      state.observer = new windowObject.MutationObserver(requestSync);
      state.observer.observe(reviewSession, {
        attributes: true,
        attributeFilter: ['class'],
        childList: true,
        subtree: true,
        characterData: true
      });
      if (reviewView) {
        state.observer.observe(reviewView, { attributes: true, attributeFilter: ['class'] });
      }
    }

    answerInput.addEventListener('input', updatePrimaryState);
    documentObject.addEventListener('click', handlePrimaryClick, true);
    documentObject.addEventListener('submit', handleAnswerSubmit, true);
    documentObject.addEventListener('focusin', handleFocusIn, true);
    documentObject.addEventListener('focusout', handleFocusOut, true);
    documentObject.addEventListener('vocora:spelling-remediation-started', delayImmediateRemediation);

    windowObject.addEventListener?.('resize', syncVisualViewport, { passive: true });
    windowObject.addEventListener?.('orientationchange', syncVisualViewport, { passive: true });
    windowObject.visualViewport?.addEventListener?.('resize', syncVisualViewport, { passive: true });
    windowObject.visualViewport?.addEventListener?.('scroll', syncVisualViewport, { passive: true });

    installObserver();
    ensureSessionChrome();
    ensurePrimaryControls();
    updatePrimaryState();
    syncAll();

    return Object.freeze({
      sync: syncAll,
      syncVisualViewport,
      updatePrimaryState,
      delayImmediateRemediation,
      revealDelayedRemediation,
      getState: () => ({
        active: state.active,
        skipTriggered: state.skipTriggered,
        delayedRemediation: state.delayedRemediation
      })
    });
  }

  function install(windowObject = globalThis.window, documentObject = globalThis.document) {
    if (!windowObject || !documentObject) return null;
    if (documentObject[INSTALLATION]) return documentObject[INSTALLATION];

    ensureStyles(documentObject);
    const controller = createController(windowObject, documentObject);
    if (!controller) return null;

    Object.defineProperty(documentObject, INSTALLATION, {
      value: controller,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return controller;
  }

  globalThis.VocoraReviewSessionUx = Object.freeze({
    STYLE_ID,
    STYLE_HREF,
    SKIP_WINDOW_MS,
    ensureStyles,
    createController,
    install
  });

  function boot() {
    const controller = install();
    if (!controller && globalThis.document?.readyState === 'loading') {
      globalThis.document.addEventListener('DOMContentLoaded', () => install(), { once: true });
    }
  }

  boot();
})();
