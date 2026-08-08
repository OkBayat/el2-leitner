(() => {
  'use strict';

  const SUPPORTED_MODES = Object.freeze(['box1', 'new']);
  const SESSION_STARTERS = Object.freeze({
    beginSessionBtn: 'scheduled',
    boxOnePracticeBtn: 'box1',
    practiceExtraBtn: 'box1'
  });
  const PracticeStage = Object.freeze({
    IDLE: 'idle',
    ANSWER: 'answer',
    FEEDBACK_CORRECT: 'feedback-correct',
    FEEDBACK_WRONG: 'feedback-wrong',
    FEEDBACK_WARNING: 'feedback-warning',
    REMEDIATION_CORRECTION: 'remediation-correction',
    REMEDIATION_RECALL: 'remediation-recall',
    REMEDIATION_COPY: 'remediation-copy',
    REMEDIATION_COMPLETED: 'remediation-completed'
  });
  const PracticeCommand = Object.freeze({
    NONE: 'none',
    RENDER: 'render',
    ADVANCE_PRIMARY: 'advance-primary'
  });
  const SKIP_WINDOW_MS = 430;

  function resolvePracticeMode(instruction = '') {
    const value = String(instruction || '');
    if (value.includes('تمرین آزاد')) return 'box1';
    if (value.includes('آزمون اولیه')) return 'new';
    if (value.includes('کلمه را بشنو')) return 'scheduled';
    return null;
  }

  function parsePersianInteger(value) {
    const normalized = String(value || '')
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[^\d]/g, '');
    return normalized ? Number(normalized) : null;
  }

  function sessionPosition(counterText) {
    const parts = String(counterText || '').split(/\s+از\s+/);
    if (parts.length !== 2) return null;
    const current = parsePersianInteger(parts[0]);
    const total = parsePersianInteger(parts[1]);
    return Number.isInteger(current) && Number.isInteger(total)
      ? { current, total }
      : null;
  }

  function queueMicrotaskSafely(windowObject, callback) {
    if (typeof windowObject.queueMicrotask === 'function') windowObject.queueMicrotask(callback);
    else Promise.resolve().then(callback);
  }

  function cloneWord(word) {
    if (!word?.id) return null;
    return {
      id: word.id,
      term: String(word.term || ''),
      accepted: Array.isArray(word.accepted) && word.accepted.length
        ? [...word.accepted]
        : [String(word.term || '')],
      category: String(word.category || ''),
      box: Number(word.box) || 0,
      notes: String(word.notes || '')
    };
  }

  class PracticeSessionWorkflow {
    constructor({ domain, policy = null, queue = null } = {}) {
      if (!domain?.RemediationAttempt || !domain?.SameSessionRecheckQueue) {
        throw new TypeError('VocoraPractice domain is required.');
      }
      this.domain = domain;
      this.policy = policy || new domain.SameSessionRecheckPolicy();
      this.queue = queue || new domain.SameSessionRecheckQueue();
      this.mode = null;
      this.feedback = null;
      this.active = null;
    }

    begin(mode) {
      this.reset();
      this.mode = mode || null;
      return this.result(PracticeCommand.RENDER);
    }

    reset() {
      this.mode = null;
      this.feedback = null;
      this.active = null;
      this.queue.clear();
      return this.snapshot();
    }

    primaryAnswered({ word, answer = '', correct = false, forcedWrong = false }) {
      if (this.stage() !== PracticeStage.ANSWER) return this.result(PracticeCommand.NONE);
      const copiedWord = cloneWord(word);
      if (!copiedWord) throw new TypeError('A primary word is required.');

      this.queue.advance();
      const kind = correct ? 'correct' : forcedWrong ? 'warning' : 'wrong';
      this.feedback = {
        kind,
        word: copiedWord,
        answer: String(answer || ''),
        spelling: copiedWord.accepted.join(' / ')
      };
      this.active = null;

      if (!correct && SUPPORTED_MODES.includes(this.mode)) {
        const attempt = this.domain.RemediationAttempt.immediate({
          wordId: copiedWord.id,
          accepted: copiedWord.accepted,
          initialAnswer: answer,
          policy: this.policy
        });
        this.active = {
          attempt,
          word: copiedWord,
          mode: this.mode,
          entry: null,
          outcome: null,
          presentationDeferred: true
        };
      }
      return this.result(PracticeCommand.RENDER);
    }

    continue({ flush = false } = {}) {
      const stage = this.stage();
      if (stage === PracticeStage.IDLE || stage === PracticeStage.ANSWER) {
        return this.result(PracticeCommand.NONE);
      }

      if (this.active?.presentationDeferred) {
        this.feedback = null;
        this.active.presentationDeferred = false;
        return this.result(PracticeCommand.RENDER);
      }

      if (this.active) {
        if (this.active.attempt.phase !== this.domain.RemediationPhase.COMPLETED) {
          return this.result(PracticeCommand.NONE);
        }
        this.active = null;
      }

      this.feedback = null;
      const due = this.queue.takeNext({ flush });
      if (due) {
        this.startRecheck(due);
        return this.result(PracticeCommand.RENDER);
      }
      return this.result(PracticeCommand.ADVANCE_PRIMARY);
    }

    acknowledge() {
      if (
        !this.active
        || this.active.presentationDeferred
        || this.active.attempt.phase !== this.domain.RemediationPhase.CORRECTION
      ) {
        return this.result(PracticeCommand.NONE);
      }
      this.active.attempt.acknowledgeCorrection();
      return this.result(PracticeCommand.RENDER);
    }

    submitRemediation(answer) {
      if (!this.active || this.active.presentationDeferred) {
        return this.result(PracticeCommand.NONE);
      }

      const phase = this.active.attempt.phase;
      if (phase === this.domain.RemediationPhase.RECALL) {
        this.active.attempt.submitRecall(answer);
      } else if (phase === this.domain.RemediationPhase.COPY) {
        this.active.attempt.submitCopy(answer);
      } else {
        return this.result(PracticeCommand.NONE);
      }

      if (
        this.active.attempt.phase === this.domain.RemediationPhase.COMPLETED
        && !this.active.outcome
      ) {
        const outcome = this.active.attempt.outcome();
        this.active.outcome = outcome;
        if (outcome.nextRecheck) {
          this.queue.schedule({
            word: this.active.word,
            mode: this.active.mode,
            recheckNumber: outcome.nextRecheck.number,
            originId: this.active.entry?.originId || this.active.entry?.id || null
          }, outcome.nextRecheck.gap);
        }
      }
      return this.result(PracticeCommand.RENDER);
    }

    scheduleRecheck({ word, mode = this.mode, recheckNumber = 1, originId = null }, gap) {
      return this.queue.schedule({
        word: cloneWord(word),
        mode,
        recheckNumber,
        originId
      }, gap);
    }

    startRecheck(entry) {
      const word = cloneWord(entry.word);
      if (!word) throw new TypeError('A recheck word is required.');
      const attempt = this.domain.RemediationAttempt.recheck({
        wordId: word.id,
        accepted: word.accepted,
        recheckNumber: entry.recheckNumber,
        policy: this.policy
      });
      this.feedback = null;
      this.active = {
        attempt,
        word,
        mode: entry.mode,
        entry,
        outcome: null,
        presentationDeferred: false
      };
      return this.result(PracticeCommand.RENDER);
    }

    stage() {
      if (!this.mode) return PracticeStage.IDLE;
      if (this.active) {
        if (this.active.presentationDeferred) return this.feedbackStage();
        const phase = this.active.attempt.phase;
        if (phase === this.domain.RemediationPhase.CORRECTION) {
          return PracticeStage.REMEDIATION_CORRECTION;
        }
        if (phase === this.domain.RemediationPhase.RECALL) {
          return PracticeStage.REMEDIATION_RECALL;
        }
        if (phase === this.domain.RemediationPhase.COPY) {
          return PracticeStage.REMEDIATION_COPY;
        }
        if (phase === this.domain.RemediationPhase.COMPLETED) {
          return PracticeStage.REMEDIATION_COMPLETED;
        }
      }
      if (this.feedback) return this.feedbackStage();
      return PracticeStage.ANSWER;
    }

    feedbackStage() {
      if (this.feedback?.kind === 'correct') return PracticeStage.FEEDBACK_CORRECT;
      if (this.feedback?.kind === 'warning') return PracticeStage.FEEDBACK_WARNING;
      return PracticeStage.FEEDBACK_WRONG;
    }

    activeSnapshot() {
      if (!this.active) return null;
      const attempt = this.active.attempt.snapshot();
      return {
        wordId: this.active.word.id,
        word: cloneWord(this.active.word),
        mode: this.active.mode,
        phase: attempt.phase,
        context: attempt.context,
        recheckNumber: attempt.recheckNumber,
        presentationDeferred: this.active.presentationDeferred,
        spelling: this.active.word.accepted.join(' / '),
        comparison: attempt.comparison,
        hint: attempt.hint,
        recallFailures: attempt.recallFailures,
        copyFailures: attempt.copyFailures,
        correctOnFirstRecall: attempt.correctOnFirstRecall,
        outcome: this.active.outcome
          ? {
              ...this.active.outcome,
              nextRecheck: this.active.outcome.nextRecheck
                ? { ...this.active.outcome.nextRecheck }
                : null
            }
          : null
      };
    }

    snapshot() {
      return {
        mode: this.mode,
        stage: this.stage(),
        feedback: this.feedback
          ? { ...this.feedback, word: cloneWord(this.feedback.word) }
          : null,
        active: this.activeSnapshot(),
        queue: this.queue.snapshot()
      };
    }

    result(command) {
      return { command, snapshot: this.snapshot() };
    }
  }

  class VocoraPracticeSessionPort {
    constructor({ window: windowObject, document: documentObject }) {
      this.window = windowObject;
      this.document = documentObject;
      this.explicitMode = null;
      this.allowNextClick = false;
    }

    setMode(mode) {
      this.explicitMode = mode || null;
    }

    mode() {
      return this.explicitMode
        || resolvePracticeMode(this.document.querySelector('#cardInstruction')?.textContent);
    }

    currentWord() {
      return cloneWord(this.window.VazheyarTest?.getCurrentWord?.());
    }

    isCorrect(answer, word, forcedWrong = false) {
      if (forcedWrong) return false;
      if (typeof this.window.VazheyarTest?.isCorrectAnswer === 'function') {
        return this.window.VazheyarTest.isCorrectAnswer(answer, word);
      }
      const normalize = this.window.VocoraPractice?.defaultNormalize
        || ((value) => String(value || '').trim().toLowerCase());
      const normalized = normalize(answer);
      return Boolean(normalized)
        && word.accepted.some((candidate) => normalize(candidate) === normalized);
    }

    isSessionVisible() {
      const session = this.document.querySelector('#reviewSession');
      return Boolean(session && !session.classList.contains('hidden'));
    }

    shouldFlushBeforeNext() {
      if (this.mode() !== 'new') return false;
      const position = sessionPosition(
        this.document.querySelector('#sessionCounter')?.textContent
      );
      const feedbackVisible = !this.document
        .querySelector('#answerFeedback')
        ?.classList.contains('hidden');
      return Boolean(
        position
        && feedbackVisible
        && position.current >= position.total
      );
    }

    advancePrimary() {
      const next = this.document.querySelector('#nextCardBtn');
      if (!next) return false;
      this.allowNextClick = true;
      try {
        next.click();
      } finally {
        this.allowNextClick = false;
      }
      return true;
    }

    speak(word) {
      if (
        !word?.term
        || !('speechSynthesis' in this.window)
        || typeof this.window.SpeechSynthesisUtterance !== 'function'
      ) {
        return false;
      }
      this.window.speechSynthesis.cancel?.();
      const utterance = new this.window.SpeechSynthesisUtterance(word.term);
      utterance.lang = 'en-GB';
      const configuredRate = Number(
        this.window.VazheyarTest?.getState?.()?.settings?.voiceRate
      );
      utterance.rate = Number.isFinite(configuredRate)
        ? Math.min(Math.max(configuredRate, 0.45), 1.2)
        : 0.85;
      const voices = this.window.speechSynthesis.getVoices?.() || [];
      utterance.voice = voices.find((voice) => /^en-GB/i.test(voice.lang))
        || voices.find((voice) => /^en/i.test(voice.lang))
        || null;
      this.window.speechSynthesis.speak?.(utterance);
      return true;
    }
  }

  class PracticeSessionController {
    constructor({
      window: windowObject,
      document: documentObject,
      workflow = null,
      port = null,
      view = null
    }) {
      if (!windowObject?.VocoraPractice) {
        throw new Error('VocoraPractice domain is required.');
      }
      if (!windowObject?.VocoraReviewSessionUx?.PracticeSessionView) {
        throw new Error('Vocora practice view is required.');
      }
      this.window = windowObject;
      this.document = documentObject;
      this.workflow = workflow
        || new PracticeSessionWorkflow({ domain: windowObject.VocoraPractice });
      this.port = port
        || new VocoraPracticeSessionPort({ window: windowObject, document: documentObject });
      this.view = view
        || new windowObject.VocoraReviewSessionUx.PracticeSessionView({
          window: windowObject,
          document: documentObject
        });
      this.pendingMode = null;
      this.pendingAssessment = null;
      this.skipTapCount = 0;
      this.skipTapTimer = null;
      this.sessionObserver = null;
      this.mounted = false;
    }

    mount() {
      if (this.mounted) return this;
      this.view.mount({
        acknowledge: () => this.acknowledge(),
        submit: (answer) => this.submitRemediationAnswer(answer),
        continue: () => this.continue(),
        listen: () => this.listen()
      });
      this.document.addEventListener('click', (event) => this.captureClick(event), true);
      this.document.addEventListener('submit', (event) => this.captureSubmit(event), true);
      this.document.querySelector('#answerInput')?.addEventListener('input', () => {
        this.clearSkipTap();
        this.view.updatePrimaryButton(Boolean(
          this.document.querySelector('#answerInput')?.value.trim()
        ));
      });
      this.window.addEventListener('pagehide', () => this.reset());
      this.observeSessionVisibility();
      this.mounted = true;
      this.bootstrap();
      return this;
    }

    observeSessionVisibility() {
      const sessionElement = this.document.querySelector('#reviewSession');
      if (!sessionElement || typeof this.window.MutationObserver !== 'function') return;
      this.sessionObserver = new this.window.MutationObserver(() => {
        if (this.port.isSessionVisible()) {
          this.activatePendingSession();
        } else if (this.workflow.stage() !== PracticeStage.IDLE) {
          this.reset();
        }
      });
      this.sessionObserver.observe(sessionElement, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    bootstrap() {
      if (!this.port.isSessionVisible()) return;
      this.pendingMode = this.port.mode();
      this.activatePendingSession();
    }

    activatePendingSession() {
      if (!this.port.isSessionVisible()) return false;
      const mode = this.pendingMode || this.port.mode();
      if (!mode) return false;
      if (
        this.workflow.stage() === PracticeStage.IDLE
        || this.workflow.mode !== mode
      ) {
        this.workflow.begin(mode);
      }
      this.port.setMode(mode);
      this.pendingMode = null;
      this.view.updatePrimaryButton(Boolean(
        this.document.querySelector('#answerInput')?.value.trim()
      ));
      this.render();
      return true;
    }

    beginSession(mode) {
      this.cancelPromptSpeech();
      this.clearSkipTap();
      this.pendingAssessment = null;
      this.workflow.reset();
      this.pendingMode = mode;
      this.port.setMode(mode);
      if (this.port.isSessionVisible()) this.activatePendingSession();
      else this.render();
    }

    reset() {
      this.cancelPromptSpeech();
      this.clearSkipTap();
      this.pendingMode = null;
      this.pendingAssessment = null;
      this.workflow.reset();
      this.port.setMode(null);
      this.render();
    }

    captureSubmit(event) {
      if (event.target?.id === 'newWordsForm') {
        this.beginSession('new');
        return;
      }
      if (event.target?.id !== 'answerForm') return;
      if (this.workflow.stage() !== PracticeStage.ANSWER) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const answer = this.document.querySelector('#answerInput')?.value || '';
      if (!answer.trim()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.armUnknown();
        return;
      }
      this.preparePrimaryAssessment({ answer, forcedWrong: false });
    }

    captureClick(event) {
      const starter = event.target?.closest?.('[id]');
      const starterMode = starter ? SESSION_STARTERS[starter.id] : null;
      if (starterMode) {
        this.beginSession(starterMode);
        return;
      }
      if (event.target?.closest?.('#exitSessionBtn')) {
        this.reset();
        return;
      }

      const primary = event.target?.closest?.('#answerForm button[type="submit"]');
      if (primary && !this.document.querySelector('#answerInput')?.value.trim()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.skipTapCount === 0) this.armUnknown();
        else this.submitUnknown();
        return;
      }

      if (event.target?.closest?.('#dontKnowBtn')) {
        this.preparePrimaryAssessment({ answer: '', forcedWrong: true });
        return;
      }

      if (!event.target?.closest?.('#nextCardBtn')) return;
      if (this.port.allowNextClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.continue();
    }

    preparePrimaryAssessment({ answer, forcedWrong }) {
      const word = this.port.currentWord();
      if (
        !word
        || this.pendingAssessment
        || this.workflow.stage() !== PracticeStage.ANSWER
      ) {
        return;
      }

      const assessment = {
        word,
        answer: String(answer || ''),
        forcedWrong: Boolean(forcedWrong),
        correct: this.port.isCorrect(answer, word, forcedWrong)
      };
      this.pendingAssessment = assessment;

      queueMicrotaskSafely(this.window, () => {
        if (this.pendingAssessment !== assessment) return;
        this.pendingAssessment = null;
        if (!this.port.isSessionVisible()) return;

        this.workflow.primaryAnswered(assessment);
        this.render();

        if (!assessment.correct && SUPPORTED_MODES.includes(this.workflow.mode)) {
          this.emit('vocora:spelling-remediation-started', {
            wordId: assessment.word.id,
            mode: this.workflow.mode,
            context: this.window.VocoraPractice.RemediationContext.IMMEDIATE,
            presentationDeferred: true
          });
        }
      });
    }

    continue() {
      const before = this.workflow.snapshot();
      const result = this.workflow.continue({
        flush: this.port.shouldFlushBeforeNext()
      });
      const after = result.snapshot;
      const revealed = Boolean(
        before.active?.presentationDeferred
        && after.active
        && !after.active.presentationDeferred
      );
      const beforeRecheck = before.active?.context === 'recheck'
        ? `${before.active.wordId}:${before.active.recheckNumber}`
        : null;
      const afterRecheck = after.active?.context === 'recheck'
        ? `${after.active.wordId}:${after.active.recheckNumber}`
        : null;
      const recheckStarted = afterRecheck && afterRecheck !== beforeRecheck;

      if (result.command === PracticeCommand.ADVANCE_PRIMARY) {
        this.render();
        this.port.advancePrimary();
        queueMicrotaskSafely(this.window, () => {
          if (!this.port.isSessionVisible()) {
            this.reset();
            return;
          }
          this.view.updatePrimaryButton(Boolean(
            this.document.querySelector('#answerInput')?.value.trim()
          ));
          this.render();
        });
        return true;
      }

      this.render();
      if (revealed) {
        this.emit('vocora:spelling-remediation-revealed', {
          wordId: after.active.wordId,
          mode: after.active.mode,
          context: after.active.context
        });
      }
      if (recheckStarted) {
        this.emit('vocora:same-session-recheck-started', {
          wordId: after.active.wordId,
          mode: after.active.mode,
          recheckNumber: after.active.recheckNumber
        });
      }
      return result.command !== PracticeCommand.NONE;
    }

    revealDeferredPresentation() {
      if (!this.workflow.snapshot().active?.presentationDeferred) return false;
      return this.continue();
    }

    startImmediate(word, answer = '') {
      if (!this.workflow.mode) {
        const mode = this.port.mode() || 'box1';
        this.workflow.begin(mode);
        this.port.setMode(mode);
      }
      const result = this.workflow.primaryAnswered({
        word,
        answer,
        correct: false,
        forcedWrong: false
      });
      this.render();
      if (result.command !== PracticeCommand.NONE) {
        this.emit('vocora:spelling-remediation-started', {
          wordId: word.id,
          mode: this.workflow.mode,
          context: this.window.VocoraPractice.RemediationContext.IMMEDIATE,
          presentationDeferred: true
        });
      }
      return this.snapshot();
    }

    startRecheck(entry) {
      this.workflow.startRecheck(entry);
      const active = this.workflow.snapshot().active;
      this.render();
      this.emit('vocora:same-session-recheck-started', {
        wordId: active.wordId,
        mode: active.mode,
        recheckNumber: active.recheckNumber
      });
      return this.snapshot();
    }

    get queue() {
      return this.workflow.queue;
    }

    acknowledge() {
      const result = this.workflow.acknowledge();
      this.render();
      return result.command !== PracticeCommand.NONE;
    }

    submitRemediationAnswer(answer) {
      const before = this.workflow.snapshot();
      const result = this.workflow.submitRemediation(answer);
      const after = result.snapshot;
      const completed = Boolean(
        before.active?.phase !== 'completed'
        && after.active?.phase === 'completed'
      );

      this.render();

      if (completed) {
        if (after.active.outcome?.nextRecheck) {
          this.emit('vocora:same-session-recheck-scheduled', {
            wordId: after.active.wordId,
            mode: after.active.mode,
            recheckNumber: after.active.outcome.nextRecheck.number,
            gap: after.active.outcome.nextRecheck.gap
          });
        }
        this.emit('vocora:spelling-remediation-completed', {
          wordId: after.active.wordId,
          mode: after.active.mode,
          context: after.active.context,
          recheckNumber: after.active.recheckNumber,
          correctOnFirstRecall: after.active.outcome?.correctOnFirstRecall ?? null,
          recallFailures: after.active.outcome?.recallFailures ?? 0,
          copyFailures: after.active.outcome?.copyFailures ?? 0
        });
      }
      return result.command !== PracticeCommand.NONE;
    }

    continueSession() {
      return this.continue();
    }

    listen() {
      const active = this.workflow.snapshot().active;
      return active ? this.port.speak(active.word) : false;
    }

    handleEnter(event) {
      if (!event || (event.key !== 'Enter' && event.code !== 'NumpadEnter')) {
        return false;
      }
      const snapshot = this.workflow.snapshot();
      if (snapshot.stage === PracticeStage.IDLE) return false;

      if (event.isComposing || event.keyCode === 229) {
        event.stopImmediatePropagation();
        return false;
      }
      if (event.repeat) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return false;
      }

      if (snapshot.stage === PracticeStage.ANSWER) {
        const input = this.document.querySelector('#answerInput');
        if (input?.value.trim()) return false;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.skipTapCount === 0) this.armUnknown();
        else this.submitUnknown();
        return true;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      if (snapshot.stage.startsWith('feedback-')) return this.continue();
      if (snapshot.stage === PracticeStage.REMEDIATION_CORRECTION) {
        return this.acknowledge();
      }
      if ([
        PracticeStage.REMEDIATION_RECALL,
        PracticeStage.REMEDIATION_COPY
      ].includes(snapshot.stage)) {
        const input = this.document.querySelector('#remediationInput');
        if (!input || input.disabled || !input.value.trim()) {
          input?.focus?.({ preventScroll: true });
          return true;
        }
        return this.submitRemediationAnswer(input.value);
      }
      if (snapshot.stage === PracticeStage.REMEDIATION_COMPLETED) {
        return this.continue();
      }
      return false;
    }

    armUnknown() {
      if (this.skipTapCount === 1) return;
      this.skipTapCount = 1;
      this.view.armUnknown(true);
      if (this.skipTapTimer) this.window.clearTimeout(this.skipTapTimer);
      this.skipTapTimer = this.window.setTimeout(
        () => this.clearSkipTap(),
        SKIP_WINDOW_MS
      );
    }

    submitUnknown() {
      this.clearSkipTap();
      this.document.querySelector('#answerInput')?.blur();
      this.document.querySelector('#dontKnowBtn')?.click();
    }

    clearSkipTap() {
      this.skipTapCount = 0;
      if (this.skipTapTimer) this.window.clearTimeout(this.skipTapTimer);
      this.skipTapTimer = null;
      this.view.armUnknown(false);
    }

    render() {
      const snapshot = this.workflow.snapshot();
      this.view.render(snapshot);
      return snapshot;
    }

    cancelPromptSpeech() {
      this.window.VocoraPracticeRecheckPromptCoordinator?.cancel?.({
        stopSpeech: true
      });
      this.window.speechSynthesis?.cancel?.();
    }

    emit(name, detail) {
      this.document.dispatchEvent(new this.window.CustomEvent(name, { detail }));
    }

    snapshot() {
      return this.workflow.snapshot();
    }
  }

  let bootPromise = null;

  function boot() {
    if (globalThis.VocoraPracticeRemediation) {
      return Promise.resolve(globalThis.VocoraPracticeRemediation);
    }
    if (bootPromise) return bootPromise;

    bootPromise = Promise.resolve(globalThis.VazheyarReady)
      .then(() => {
        if (globalThis.VocoraPracticeRemediation) {
          return globalThis.VocoraPracticeRemediation;
        }
        const controller = new PracticeSessionController({
          window: globalThis,
          document: globalThis.document
        }).mount();
        globalThis.VocoraPracticeRemediation = controller;
        return controller;
      })
      .catch((error) => {
        console.error('Could not start the practice-session workflow:', error);
        return null;
      });
    return bootPromise;
  }

  globalThis.VocoraPracticeUI = Object.freeze({
    SUPPORTED_MODES,
    SESSION_STARTERS,
    PracticeStage,
    PracticeCommand,
    SKIP_WINDOW_MS,
    resolvePracticeMode,
    parsePersianInteger,
    sessionPosition,
    cloneWord,
    PracticeSessionWorkflow,
    VocoraPracticeSessionPort,
    PracticeSessionController,
    boot
  });
  globalThis.VocoraPracticeRemediationReady = boot();
})();
