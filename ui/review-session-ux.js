(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.reviewSessionUx');
  const RELEASE = '20260808-ownership3';
  const STYLE_ID = 'vocora-review-session-ux-style';
  const STYLE_HREF = `review-session-ux.css?v=${RELEASE}`;
  const PRIMARY_SELECTOR = '#answerForm button[type="submit"]';
  const PRACTICE_INPUT_SELECTOR = '#answerInput, #remediationInput';
  const SKIP_WINDOW_MS = 430;

  const PracticeStage = Object.freeze({
    ANSWER: 'answer',
    FEEDBACK_CORRECT: 'feedback-correct',
    FEEDBACK_WRONG: 'feedback-wrong',
    FEEDBACK_WARNING: 'feedback-warning',
    REMEDIATION_CORRECTION: 'remediation-correction',
    REMEDIATION_RECALL: 'remediation-recall',
    REMEDIATION_COPY: 'remediation-copy',
    REMEDIATION_COMPLETED: 'remediation-completed'
  });

  const VALID_STAGES = new Set(Object.values(PracticeStage));

  function isVisible(element) {
    return Boolean(element && !element.classList.contains('hidden'));
  }

  function setHidden(element, hidden) {
    if (!element) return;
    element.classList.toggle('hidden', hidden);
    element.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    if (hidden) element.setAttribute('inert', '');
    else element.removeAttribute('inert');
  }

  function ensureStyles(documentObject = globalThis.document) {
    if (!documentObject?.head) return false;
    const existing = documentObject.getElementById(STYLE_ID);
    if (existing) {
      if (existing.getAttribute('href') !== STYLE_HREF) existing.setAttribute('href', STYLE_HREF);
      return false;
    }
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

  function remediationSnapshot(windowObject = globalThis.window) {
    return windowObject?.VocoraPracticeRemediation?.snapshot?.() || { active: null, queue: [] };
  }

  function activeRemediation(windowObject = globalThis.window) {
    return remediationSnapshot(windowObject).active || null;
  }

  function isDeferredRemediation(active) {
    return Boolean(active?.presentationDeferred);
  }

  function acceptedSpelling(windowObject = globalThis.window) {
    const word = currentWord(windowObject);
    if (!word) return '';
    const accepted = Array.isArray(word.accepted) && word.accepted.length
      ? word.accepted
      : [word.term];
    return accepted.filter(Boolean).join(' / ');
  }

  function stageForRemediationPhase(phase) {
    if (phase === 'correction') return PracticeStage.REMEDIATION_CORRECTION;
    if (phase === 'recall') return PracticeStage.REMEDIATION_RECALL;
    if (phase === 'copy') return PracticeStage.REMEDIATION_COPY;
    if (phase === 'completed') return PracticeStage.REMEDIATION_COMPLETED;
    return null;
  }

  function isImmediateCorrection(active) {
    return Boolean(active && active.context === 'immediate' && active.phase === 'correction');
  }

  class PracticeSessionComponent {
    constructor({ window: windowObject, document: documentObject }) {
      this.window = windowObject;
      this.document = documentObject;
      this.body = documentObject.body;
      this.root = documentObject.documentElement;
      this.reviewSession = documentObject.querySelector('#reviewSession');
      this.flashCard = documentObject.querySelector('#flashCard');
      this.answerForm = documentObject.querySelector('#answerForm');
      this.answerInput = documentObject.querySelector('#answerInput');
      this.feedback = documentObject.querySelector('#answerFeedback');
      this.dontKnowButton = documentObject.querySelector('#dontKnowBtn');
      this.stage = null;
    }

    get remediationRoot() {
      return this.document.querySelector('#practiceRemediation');
    }

    mount() {
      this.reviewSession?.classList.add('vocora-practice-component');
      this.ensureSessionChrome();
      this.ensurePrimaryControls();
      this.configurePracticeInputs();
      return this;
    }

    ensureSessionChrome() {
      const sessionBar = this.document.querySelector('.session-bar');
      const accuracy = this.document.querySelector('#sessionAccuracy');
      if (!sessionBar || !accuracy) return null;

      let badge = this.document.querySelector('#vocoraSessionAccuracy');
      if (!badge) {
        badge = this.document.createElement('div');
        badge.id = 'vocoraSessionAccuracy';
        badge.className = 'vocora-session-accuracy';
        badge.setAttribute('aria-label', 'دقت جلسه');
        sessionBar.append(badge);
      }
      if (accuracy.parentElement !== badge) badge.append(accuracy);
      return badge;
    }

    configureInput(input) {
      if (!input) return;
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocorrect', 'off');
      input.setAttribute('autocapitalize', 'none');
      input.setAttribute('spellcheck', 'false');
      input.setAttribute('inputmode', 'text');
      input.setAttribute('enterkeyhint', 'done');
      input.setAttribute('aria-autocomplete', 'none');
      input.setAttribute('data-form-type', 'other');
      input.setAttribute('data-lpignore', 'true');
      input.setAttribute('data-1p-ignore', 'true');
      input.setAttribute('data-bwignore', 'true');
      input.dataset.vocoraSpellingInput = 'true';
      input.form?.setAttribute('autocomplete', 'off');
    }

    configurePracticeInputs() {
      this.document.querySelectorAll(PRACTICE_INPUT_SELECTOR).forEach((input) => this.configureInput(input));
    }

    ensurePrimaryControls() {
      const button = this.document.querySelector(PRIMARY_SELECTOR);
      if (!button || !this.answerInput) return null;

      button.classList.add('vocora-primary-review-action');
      button.removeAttribute('disabled');
      this.answerInput.setAttribute('aria-label', 'پاسخ');
      this.configureInput(this.answerInput);

      let hint = this.document.querySelector('#vocoraDoubleTapHint');
      if (!hint) {
        hint = this.document.createElement('div');
        hint.id = 'vocoraDoubleTapHint';
        hint.className = 'vocora-double-tap-hint';
        hint.textContent = 'نمی‌دانی؟ دو بار روی دکمه بزن';
        hint.setAttribute('aria-live', 'polite');
      }

      if (button.nextElementSibling !== hint) button.insertAdjacentElement('afterend', hint);
      button.setAttribute('aria-describedby', hint.id);
      return button;
    }

    deferRemediation() {
      const remediationRoot = this.remediationRoot;
      setHidden(remediationRoot, true);
      remediationRoot?.classList.add('vocora-remediation-delayed');
      this.flashCard?.classList.remove('remediation-active');
    }

    setStage(stage) {
      if (!VALID_STAGES.has(stage) || !this.reviewSession) return false;
      const changed = this.stage !== stage || this.reviewSession.dataset.vocoraStage !== stage;
      this.stage = stage;
      this.reviewSession.dataset.vocoraStage = stage;
      this.body.dataset.vocoraPracticeStage = stage;
      this.normalizeStage(stage);
      return changed;
    }

    normalizeStage(stage) {
      const active = activeRemediation(this.window);
      const remediationRoot = this.remediationRoot;
      const remediationStage = stage.startsWith('remediation-');
      const feedbackStage = stage.startsWith('feedback-');

      if (remediationStage) {
        if (!active || isDeferredRemediation(active)) {
          this.deferRemediation();
          return;
        }
        setHidden(this.feedback, true);
        setHidden(this.answerForm, true);
        setHidden(this.dontKnowButton, true);
        remediationRoot?.classList.remove('vocora-remediation-delayed');
        setHidden(remediationRoot, false);
        this.flashCard?.classList.add('remediation-active');
        this.answerInput?.blur();
        return;
      }

      this.flashCard?.classList.remove('remediation-active');

      if (stage === PracticeStage.ANSWER) {
        setHidden(remediationRoot, true);
        if (!active) remediationRoot?.classList.remove('vocora-remediation-delayed');
        setHidden(this.feedback, true);
        setHidden(this.answerForm, false);
        if (this.answerInput) {
          this.answerInput.disabled = false;
          this.answerInput.readOnly = false;
        }
        return;
      }

      if (feedbackStage) {
        setHidden(remediationRoot, true);
        if (active && (isDeferredRemediation(active) || isImmediateCorrection(active))) {
          remediationRoot?.classList.add('vocora-remediation-delayed');
        }
        setHidden(this.answerForm, true);
        setHidden(this.dontKnowButton, true);
        setHidden(this.feedback, false);
        if (this.answerInput) {
          this.answerInput.readOnly = true;
          this.answerInput.blur();
        }
      }
    }

    clearStage() {
      this.stage = null;
      this.reviewSession?.removeAttribute('data-vocora-stage');
      delete this.body.dataset.vocoraPracticeStage;
      this.answerInput?.removeAttribute('readonly');
    }

    recoverPrimaryCard() {
      if (!currentWord(this.window) || activeRemediation(this.window)) return false;
      if (!this.reviewSession || !isVisible(this.reviewSession)) return false;

      this.flashCard?.classList.remove('remediation-active');
      setHidden(this.remediationRoot, true);
      this.remediationRoot?.classList.remove('vocora-remediation-delayed');
      setHidden(this.feedback, true);
      setHidden(this.answerForm, false);
      this.dontKnowButton?.classList.remove('hidden');
      if (this.answerInput) {
        this.answerInput.disabled = false;
        this.answerInput.readOnly = false;
      }
      this.setStage(PracticeStage.ANSWER);
      this.document.dispatchEvent(new this.window.CustomEvent('vocora:review-ui-recovered', {
        detail: { reason: 'blank-primary-card' }
      }));
      return true;
    }

    hasRenderableStage() {
      if (!this.stage) return false;
      if (this.stage === PracticeStage.ANSWER) return isVisible(this.answerForm);
      if (this.stage.startsWith('feedback-')) {
        return isVisible(this.feedback) && !isVisible(this.remediationRoot);
      }
      if (this.stage.startsWith('remediation-')) {
        return isVisible(this.remediationRoot) && !isVisible(this.feedback) && !isVisible(this.answerForm);
      }
      return false;
    }
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

    const component = new PracticeSessionComponent({ window: windowObject, document: documentObject }).mount();
    const state = {
      active: false,
      savedScrollY: 0,
      largestViewportHeight: 0,
      skipTapCount: 0,
      skipTapTimer: null,
      skipTriggered: false,
      observer: null,
      syncQueued: false
    };

    function activeAttempt() {
      return activeRemediation(windowObject);
    }

    function feedbackOwnsImmediateCorrection(active = activeAttempt()) {
      return Boolean(isImmediateCorrection(active) && isVisible(feedback));
    }

    function pendingImmediateCorrection(active = activeAttempt()) {
      return Boolean(isImmediateCorrection(active) && (isDeferredRemediation(active) || isVisible(feedback)));
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
      if (hint && hint.textContent !== 'نمی‌دانی؟ دو بار روی دکمه بزن') {
        hint.textContent = 'نمی‌دانی؟ دو بار روی دکمه بزن';
      }
      if (!keepTriggered) state.skipTriggered = false;
    }

    function updatePrimaryState() {
      const button = component.ensurePrimaryControls();
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
      const button = component.ensurePrimaryControls();
      const hint = documentObject.querySelector('#vocoraDoubleTapHint');
      if (!button) return;

      state.skipTapCount = 1;
      button.classList.add('skip-armed');
      button.textContent = 'یک بار دیگر بزن';
      if (hint && hint.textContent !== 'یک بار دیگر بزن تا «نمی‌دانم» ثبت شود') {
        hint.textContent = 'یک بار دیگر بزن تا «نمی‌دانم» ثبت شود';
      }
      if (state.skipTapTimer) windowObject.clearTimeout(state.skipTapTimer);
      state.skipTapTimer = windowObject.setTimeout(() => clearSkipTapState(), SKIP_WINDOW_MS);
    }

    function submitDontKnow() {
      clearSkipTapState({ keepTriggered: true });
      state.skipTriggered = true;
      answerInput.blur();
      dontKnowButton?.click();
    }

    function revealPendingRemediation() {
      const active = activeAttempt();
      if (!pendingImmediateCorrection(active)) return false;

      const remediationController = windowObject.VocoraPracticeRemediation;
      if (typeof remediationController?.revealDeferredPresentation === 'function') {
        const revealed = remediationController.revealDeferredPresentation();
        if (revealed) {
          state.skipTriggered = false;
          syncStableStage();
          return true;
        }
      }

      // Compatibility with a previously cached adapter: the old adapter already
      // prepared correction DOM. The review component still enforces a single
      // owner and performs the transition atomically.
      const remediationRoot = component.remediationRoot;
      setHidden(feedback, true);
      setHidden(answerForm, true);
      remediationRoot?.classList.remove('vocora-remediation-delayed');
      setHidden(remediationRoot, false);
      flashCard.classList.add('remediation-active');
      state.skipTriggered = false;
      const stage = stageForRemediationPhase(active?.phase);
      if (stage) component.setStage(stage);
      return Boolean(stage);
    }

    function handleClick(event) {
      const nextButton = event.target?.closest?.('#nextCardBtn');
      if (state.active && nextButton && pendingImmediateCorrection()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        revealPendingRemediation();
        return;
      }

      const button = event.target?.closest?.(PRIMARY_SELECTOR);
      if (!button || !state.active) return;

      if (answerInput.value.trim()) {
        clearSkipTapState();
        answerInput.blur();
        return;
      }

      event.preventDefault();
      if (state.skipTapCount === 0) armSkip();
      else submitDontKnow();
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

    function feedbackStage(type) {
      if (type === 'warning') return PracticeStage.FEEDBACK_WARNING;
      if (type === 'wrong') return PracticeStage.FEEDBACK_WRONG;
      if (type === 'correct') return PracticeStage.FEEDBACK_CORRECT;
      return null;
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

    function remediationStage(active = activeAttempt()) {
      if (!active || isDeferredRemediation(active)) return null;
      return stageForRemediationPhase(active.phase);
    }

    function syncStableStage() {
      if (!state.active) return null;
      component.configurePracticeInputs();

      const active = activeAttempt();

      // Feedback has explicit ownership of immediate correction until Continue.
      // This also protects clients that still have the previous adapter cached,
      // because visibility is derived from persistent state + actual DOM, not from
      // a one-shot event that might have fired before this module loaded.
      if (active && (isDeferredRemediation(active) || feedbackOwnsImmediateCorrection(active))) {
        component.deferRemediation();
        const type = feedbackType();
        if (type) {
          applyFeedbackCopy(type);
          const stage = feedbackStage(type);
          component.setStage(stage);
          return stage;
        }
      }

      const type = feedbackType();
      if (type) {
        applyFeedbackCopy(type);
        const stage = feedbackStage(type);
        component.setStage(stage);
        return stage;
      }

      const remediation = remediationStage(active);
      if (remediation) {
        component.setStage(remediation);
        return remediation;
      }

      if (isVisible(answerForm)) {
        state.skipTriggered = false;
        component.setStage(PracticeStage.ANSWER);
        return PracticeStage.ANSWER;
      }

      if (component.recoverPrimaryCard()) {
        state.skipTriggered = false;
        return PracticeStage.ANSWER;
      }
      return null;
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
      component.mount();
      syncVisualViewport();
    }

    function leaveSessionMode() {
      if (!state.active) return;
      state.active = false;
      state.skipTriggered = false;
      clearSkipTapState();
      body.classList.remove('vocora-session-active', 'vocora-keyboard-open');
      root.classList.remove('vocora-session-active');
      component.clearStage();
      if (answerInput) answerInput.readOnly = false;

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
      component.mount();
      updatePrimaryState();
      syncStableStage();
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
        component.configureInput(event.target);
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
    documentObject.addEventListener('click', handleClick, true);
    documentObject.addEventListener('submit', handleAnswerSubmit, true);
    documentObject.addEventListener('focusin', handleFocusIn, true);
    documentObject.addEventListener('focusout', handleFocusOut, true);
    documentObject.addEventListener('vocora:spelling-remediation-started', requestSync);
    documentObject.addEventListener('vocora:spelling-remediation-revealed', requestSync);
    documentObject.addEventListener('vocora:same-session-recheck-started', requestSync);
    documentObject.addEventListener('vocora:spelling-remediation-completed', requestSync);

    windowObject.addEventListener?.('resize', syncVisualViewport, { passive: true });
    windowObject.addEventListener?.('orientationchange', syncVisualViewport, { passive: true });
    windowObject.visualViewport?.addEventListener?.('resize', syncVisualViewport, { passive: true });
    windowObject.visualViewport?.addEventListener?.('scroll', syncVisualViewport, { passive: true });

    installObserver();
    syncAll();

    return Object.freeze({
      component,
      sync: syncAll,
      syncStableStage,
      syncVisualViewport,
      updatePrimaryState,
      revealDelayedRemediation: revealPendingRemediation,
      delayImmediateRemediation: requestSync,
      getState: () => {
        const active = activeAttempt();
        return {
          active: state.active,
          skipTriggered: state.skipTriggered,
          delayedRemediation: Boolean(active && (isDeferredRemediation(active) || feedbackOwnsImmediateCorrection(active))),
          stage: component.stage,
          renderable: component.hasRenderableStage()
        };
      }
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
    RELEASE,
    STYLE_ID,
    STYLE_HREF,
    SKIP_WINDOW_MS,
    PracticeStage,
    PracticeSessionComponent,
    stageForRemediationPhase,
    remediationSnapshot,
    activeRemediation,
    isDeferredRemediation,
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
