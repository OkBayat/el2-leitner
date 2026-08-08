(() => {
  'use strict';

  const RELEASE = '20260808-workflow1';
  const STYLE_ID = 'vocora-review-session-ux-style';
  const STYLE_HREF = `review-session-ux.css?v=${RELEASE}`;
  const PRIMARY_SELECTOR = '#answerForm button[type="submit"]';
  const PRACTICE_INPUT_SELECTOR = '#answerInput, #remediationInput';

  function setVisible(element, visible) {
    if (!element) return;
    element.classList.toggle('hidden', !visible);
    element.setAttribute('aria-hidden', visible ? 'false' : 'true');
    if (visible) element.removeAttribute('inert');
    else element.setAttribute('inert', '');
  }

  function isVisible(element) {
    return Boolean(element && !element.classList.contains('hidden') && !element.hasAttribute('hidden'));
  }

  function ensureStyles(documentObject = globalThis.document) {
    if (!documentObject?.head) return false;
    let link = documentObject.getElementById(STYLE_ID);
    if (!link) {
      link = documentObject.createElement('link');
      link.id = STYLE_ID;
      link.rel = 'stylesheet';
      documentObject.head.append(link);
    }
    link.href = STYLE_HREF;
    return true;
  }

  class PracticeViewport {
    constructor({ window: windowObject, document: documentObject }) {
      this.window = windowObject;
      this.document = documentObject;
      this.root = documentObject.documentElement;
      this.body = documentObject.body;
      this.active = false;
      this.savedScrollY = 0;
      this.largestHeight = 0;
      this.boundSync = () => this.sync();
      this.boundFocusIn = (event) => {
        if (event.target?.matches?.(PRACTICE_INPUT_SELECTOR)) {
          this.body.classList.add('vocora-keyboard-open');
          this.sync();
        }
      };
      this.boundFocusOut = (event) => {
        if (event.target?.matches?.(PRACTICE_INPUT_SELECTOR)) this.window.setTimeout(() => this.sync(), 40);
      };
      this.installed = false;
    }

    install() {
      if (this.installed) return;
      this.installed = true;
      this.window.addEventListener?.('resize', this.boundSync, { passive: true });
      this.window.addEventListener?.('orientationchange', this.boundSync, { passive: true });
      this.window.visualViewport?.addEventListener?.('resize', this.boundSync, { passive: true });
      this.window.visualViewport?.addEventListener?.('scroll', this.boundSync, { passive: true });
      this.document.addEventListener('focusin', this.boundFocusIn, true);
      this.document.addEventListener('focusout', this.boundFocusOut, true);
    }

    enter() {
      this.install();
      if (!this.active) this.savedScrollY = Number(this.window.scrollY) || 0;
      this.active = true;
      this.root.classList.add('vocora-session-active');
      this.body.classList.add('vocora-session-active');
      this.sync();
    }

    leave() {
      if (!this.active) return;
      this.active = false;
      this.root.classList.remove('vocora-session-active');
      this.body.classList.remove('vocora-session-active', 'vocora-keyboard-open');
      delete this.body.dataset.vocoraPracticeStage;
      this.window.setTimeout(() => {
        try { this.window.scrollTo?.(0, this.savedScrollY); } catch {}
      }, 0);
    }

    sync() {
      if (!this.active) return;
      const viewport = this.window.visualViewport;
      const height = Math.round(viewport?.height || this.window.innerHeight || 0);
      const offsetTop = Math.round(viewport?.offsetTop || 0);
      if (height > 0) {
        this.root.style.setProperty('--vocora-review-viewport-height', `${height}px`);
        this.root.style.setProperty('--vocora-review-viewport-top', `${offsetTop}px`);
      }
      const focused = this.document.activeElement?.matches?.(PRACTICE_INPUT_SELECTOR) || false;
      if (!focused && height > 0) this.largestHeight = Math.max(this.largestHeight, height);
      else if (!this.largestHeight && height > 0) this.largestHeight = Math.max(height, Number(this.window.innerHeight) || height);
      const reduced = this.largestHeight > 0 && height > 0 && height < this.largestHeight - 140;
      this.body.classList.toggle('vocora-keyboard-open', focused || reduced);
      try { this.window.scrollTo?.(0, 0); } catch {}
    }
  }

  class PracticeSessionView {
    constructor({ window: windowObject, document: documentObject }) {
      this.window = windowObject;
      this.document = documentObject;
      this.body = documentObject.body;
      this.reviewSession = documentObject.querySelector('#reviewSession');
      this.flashCard = documentObject.querySelector('#flashCard');
      this.answerForm = documentObject.querySelector('#answerForm');
      this.answerInput = documentObject.querySelector('#answerInput');
      this.feedback = documentObject.querySelector('#answerFeedback');
      this.dontKnowButton = documentObject.querySelector('#dontKnowBtn');
      this.viewport = new PracticeViewport({ window: windowObject, document: documentObject });
      this.handlers = null;
      this.remediationRoot = null;
      this.mounted = false;
      this.lastStage = null;
    }

    mount(handlers = {}) {
      if (this.mounted) {
        this.handlers = { ...this.handlers, ...handlers };
        return this;
      }
      this.handlers = handlers;
      ensureStyles(this.document);
      this.reviewSession?.classList.add('vocora-practice-component');
      this.ensureAccuracyBadge();
      this.ensurePrimaryControls();
      this.mountRemediation();
      this.configureInputs();
      this.mounted = true;
      return this;
    }

    ensureAccuracyBadge() {
      const bar = this.document.querySelector('.session-bar');
      const accuracy = this.document.querySelector('#sessionAccuracy');
      if (!bar || !accuracy) return;
      let badge = this.document.querySelector('#vocoraSessionAccuracy');
      if (!badge) {
        badge = this.document.createElement('div');
        badge.id = 'vocoraSessionAccuracy';
        badge.className = 'vocora-session-accuracy';
        badge.setAttribute('aria-label', 'دقت جلسه');
        bar.append(badge);
      }
      if (accuracy.parentElement !== badge) badge.append(accuracy);
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
      input.form?.setAttribute('autocomplete', 'off');
    }

    configureInputs() {
      this.document.querySelectorAll(PRACTICE_INPUT_SELECTOR).forEach((input) => this.configureInput(input));
    }

    ensurePrimaryControls() {
      const primary = this.document.querySelector(PRIMARY_SELECTOR);
      if (!primary || !this.answerInput) return;
      primary.classList.add('vocora-primary-review-action');
      primary.removeAttribute('disabled');
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
      if (primary.nextElementSibling !== hint) primary.insertAdjacentElement('afterend', hint);
      primary.setAttribute('aria-describedby', hint.id);
    }

    mountRemediation() {
      if (this.remediationRoot) return this.remediationRoot;
      const existing = this.document.querySelector('#practiceRemediation');
      if (existing) {
        this.remediationRoot = existing;
        return existing;
      }
      if (!this.feedback) throw new Error('Vocora answer feedback container was not found.');
      const root = this.document.createElement('section');
      root.id = 'practiceRemediation';
      root.className = 'practice-remediation hidden';
      root.setAttribute('aria-live', 'polite');
      root.setAttribute('aria-labelledby', 'remediationTitle');
      root.innerHTML = `
        <div class="remediation-heading"><span id="remediationKicker" class="remediation-kicker"></span><h3 id="remediationTitle"></h3><p id="remediationDescription"></p></div>
        <div id="remediationComparison" class="remediation-comparison hidden"><div class="remediation-spelling-row wrong-spelling" dir="ltr"><small>پاسخ تو</small><div id="remediationUserSpelling" class="remediation-spelling"></div></div><div class="remediation-spelling-row correct-spelling-row" dir="ltr"><small>املای صحیح</small><div id="remediationCorrectSpelling" class="remediation-spelling"></div></div></div>
        <p id="remediationHint" class="remediation-hint"></p>
        <button id="remediationListenBtn" class="remediation-listen" type="button"><span aria-hidden="true">▶</span><span>پخش تلفظ</span></button>
        <form id="remediationForm" class="remediation-form hidden" autocomplete="off"><label id="remediationInputLabel" for="remediationInput"></label><input id="remediationInput" class="answer-input" type="text" lang="en" dir="ltr"><p id="remediationValidation" class="remediation-validation" role="alert"></p><button id="remediationSubmitBtn" class="btn btn-primary wide" type="submit"></button></form>
        <div class="remediation-actions"><button id="remediationAcknowledgeBtn" class="btn btn-primary wide hidden" type="button">متوجه شدم؛ حالا از حفظ می‌نویسم</button><button id="remediationContinueBtn" class="btn btn-primary wide hidden" type="button">ادامهٔ تمرین</button></div>`;
      this.feedback.insertAdjacentElement('afterend', root);
      this.remediationRoot = root;
      this.configureInput(root.querySelector('#remediationInput'));
      root.querySelector('#remediationAcknowledgeBtn').addEventListener('click', () => this.handlers?.acknowledge?.());
      root.querySelector('#remediationContinueBtn').addEventListener('click', () => this.handlers?.continue?.());
      root.querySelector('#remediationListenBtn').addEventListener('click', () => this.handlers?.listen?.());
      root.querySelector('#remediationForm').addEventListener('submit', (event) => { event.preventDefault(); this.handlers?.submit?.(root.querySelector('#remediationInput').value); });
      return root;
    }

    query(selector) { return this.remediationRoot?.querySelector(selector) || null; }

    render(snapshot) {
      this.mount(this.handlers || {});
      const stage = snapshot.stage;
      this.lastStage = stage;
      if (stage === 'idle') {
        this.reviewSession?.removeAttribute('data-vocora-stage');
        this.viewport.leave();
        return;
      }
      this.viewport.enter();
      this.reviewSession.dataset.vocoraStage = stage;
      this.body.dataset.vocoraPracticeStage = stage;
      if (stage === 'answer') this.renderAnswer();
      else if (stage.startsWith('feedback-')) this.renderFeedback(snapshot);
      else if (stage.startsWith('remediation-')) this.renderRemediation(snapshot);
      this.viewport.sync();
    }

    renderAnswer() {
      this.flashCard?.classList.remove('remediation-active');
      setVisible(this.answerForm, true); setVisible(this.feedback, false); setVisible(this.remediationRoot, false); setVisible(this.dontKnowButton, true);
      if (this.answerInput) { this.answerInput.disabled = false; this.answerInput.readOnly = false; }
    }

    renderFeedback(snapshot) {
      this.flashCard?.classList.remove('remediation-active');
      setVisible(this.answerForm, false); setVisible(this.feedback, true); setVisible(this.remediationRoot, false); setVisible(this.dontKnowButton, false);
      if (this.answerInput) { this.answerInput.readOnly = true; this.answerInput.blur(); }
      const feedback = snapshot.feedback || {};
      const title = this.document.querySelector('#feedbackTitle'); const detail = this.document.querySelector('#feedbackDetail'); const icon = this.document.querySelector('#feedbackIcon'); const spelling = this.document.querySelector('#correctAnswer'); const next = this.document.querySelector('#nextCardBtn');
      if (feedback.kind === 'correct') { if (title) title.textContent = 'عالیه!'; if (icon) icon.textContent = '✓'; }
      else if (feedback.kind === 'warning') { if (title) title.textContent = 'اشکالی ندارد'; if (detail) detail.textContent = 'این کلمه برای مرور دوباره برمی‌گردد.'; if (icon) icon.textContent = '!'; }
      else { if (title) title.textContent = 'اشتباه بود'; if (detail) detail.textContent = 'پاسخ درست را یک بار با دقت ببین.'; if (icon) icon.textContent = '×'; }
      if (spelling && feedback.spelling) spelling.textContent = feedback.spelling;
      const spellingBox = spelling?.closest?.('.correct-spelling');
      if (spellingBox) spellingBox.style.setProperty('display', 'block', 'important');
      if (next) next.textContent = 'ادامه';
    }

    renderRemediation(snapshot) {
      const active = snapshot.active;
      if (!active) throw new Error('Remediation stage requires an active attempt.');
      setVisible(this.answerForm, false); setVisible(this.feedback, false); setVisible(this.dontKnowButton, false); setVisible(this.remediationRoot, true);
      this.flashCard?.classList.add('remediation-active');
      const phase = active.phase;
      const comparisonVisible = phase === 'correction' || phase === 'copy';
      const formVisible = phase === 'recall' || phase === 'copy';
      setVisible(this.query('#remediationComparison'), comparisonVisible); setVisible(this.query('#remediationForm'), formVisible); setVisible(this.query('#remediationAcknowledgeBtn'), phase === 'correction'); setVisible(this.query('#remediationContinueBtn'), phase === 'completed'); setVisible(this.query('#remediationListenBtn'), phase !== 'completed');
      this.query('#remediationValidation').textContent = '';
      this.updateMeta(active.word);
      if (comparisonVisible && active.comparison) this.renderComparison(active.comparison);
      else { this.query('#remediationUserSpelling').replaceChildren(); this.query('#remediationCorrectSpelling').replaceChildren(); }
      if (phase === 'correction') {
        this.setHeading('اصلاح فوری', 'اشتباه را دقیق ببین', 'قبل از ادامه، تفاوت پاسخ خودت با املای صحیح را بررسی کن.'); this.query('#remediationHint').textContent = active.hint || ''; this.focusSoon('#remediationAcknowledgeBtn');
      } else if (phase === 'recall') {
        const recheck = active.context === 'recheck';
        this.setHeading(recheck ? `بازآزمایی ${this.fa(active.recheckNumber)}` : 'بازیابی از حافظه', 'حالا بدون دیدن پاسخ بنویس', recheck ? 'به تلفظ گوش کن و کلمه‌ای را که الان می‌شنوی از حافظه بنویس.' : 'املای صحیح پنهان شده است. به تلفظ گوش کن و کل کلمه را از حافظه تایپ کن.');
        this.query('#remediationHint').textContent = 'هیچ حرف یا گزینه‌ای نمایش داده نمی‌شود؛ کل کلمه را خودت تولید کن.'; this.configureForm(recheck ? 'املای کلمه‌ای که الان می‌شنوی' : 'املای کلمه از حافظه', 'کلمه را کامل بنویس…', 'بررسی املای من'); this.focusSoon('#remediationInput');
      } else if (phase === 'copy') {
        this.setHeading('رونویسی متمرکز', 'یک بار دقیق رونویسی کن', 'پاسخ صحیح را از چپ به راست نگاه کن و همان را یک بار کامل بنویس.'); this.query('#remediationHint').textContent = active.hint || ''; this.configureForm('رونویسی دقیق املای صحیح', 'املای صحیح را رونویسی کن…', 'رونویسی و پنهان‌کردن پاسخ');
        if (active.copyFailures > 0) this.query('#remediationValidation').textContent = 'رونویسی هنوز دقیقاً مطابق املای صحیح نیست؛ دوباره با دقت مقایسه کن.'; else if (active.recallFailures > 0) this.query('#remediationValidation').textContent = 'این بار هم درست نبود؛ ابتدا یک رونویسی متمرکز انجام بده.'; this.focusSoon('#remediationInput');
      } else {
        const gap = active.outcome?.nextRecheck?.gap;
        this.setHeading(active.context === 'recheck' ? 'بازآزمایی کامل شد' : 'اصلاح کامل شد', 'این بار درست نوشتی', active.context === 'recheck' ? (active.outcome?.nextRecheck ? `برای تثبیت بیشتر، این کلمه پس از ${this.fa(gap)} کارت دیگر یک بار دیگر بررسی می‌شود.` : 'بازآزمایی این کلمه در همین جلسه با موفقیت تمام شد.') : `خطای اصلی ثبت شد و منطق جعبهٔ لایتنر دست‌نخورده ماند. این کلمه پس از ${this.fa(gap ?? 3)} کارت دیگر دوباره بررسی می‌شود.`);
        this.query('#remediationHint').textContent = ''; this.focusSoon('#remediationContinueBtn');
      }
    }

    updateMeta(word) { const category = this.document.querySelector('#cardCategory'); const box = this.document.querySelector('#cardBox'); if (category) category.textContent = word?.category || 'تمرین املا'; if (box) box.textContent = word?.box ? `خانهٔ ${this.fa(word.box)}` : 'تمرین همان جلسه'; }
    configureForm(label, placeholder, buttonText) { const input = this.query('#remediationInput'); this.query('#remediationInputLabel').textContent = label; input.value = ''; input.placeholder = placeholder; this.query('#remediationSubmitBtn').textContent = buttonText; }
    setHeading(kicker, title, description) { this.query('#remediationKicker').textContent = kicker; this.query('#remediationTitle').textContent = title; this.query('#remediationDescription').textContent = description; }
    renderComparison(comparison) { this.renderTokens(this.query('#remediationUserSpelling'), comparison.answerTokens, 'پاسخی ثبت نشد'); this.renderTokens(this.query('#remediationCorrectSpelling'), comparison.targetTokens, comparison.target); }
    renderTokens(container, tokens, emptyLabel) { container.replaceChildren(); if (!tokens?.length) { const empty = this.document.createElement('span'); empty.className = 'spelling-empty'; empty.textContent = emptyLabel; container.append(empty); return; } tokens.forEach(({ value, status }) => { const token = this.document.createElement('span'); token.className = `spelling-token spelling-${status}`; token.textContent = value === ' ' ? '\u00A0' : value; container.append(token); }); }
    updatePrimaryButton(hasAnswer) { const primary = this.document.querySelector(PRIMARY_SELECTOR); if (!primary) return; this.answerForm?.classList.toggle('vocora-has-answer', hasAnswer); primary.classList.toggle('is-empty', !hasAnswer); primary.dataset.empty = hasAnswer ? 'false' : 'true'; primary.setAttribute('aria-label', hasAnswer ? 'بررسی پاسخ' : 'پاسخی ننوشته‌ای. برای انتخاب نمی‌دانم دو بار روی این دکمه بزن.'); }
    armUnknown(armed) { const primary = this.document.querySelector(PRIMARY_SELECTOR); const hint = this.document.querySelector('#vocoraDoubleTapHint'); if (!primary || !hint) return; primary.classList.toggle('skip-armed', armed); primary.textContent = armed ? 'یک بار دیگر بزن' : 'بررسی پاسخ'; hint.textContent = armed ? 'یک بار دیگر بزن تا «نمی‌دانم» ثبت شود' : 'نمی‌دانی؟ دو بار روی دکمه بزن'; }
    focusSoon(selector) { this.window.setTimeout(() => this.document.querySelector(selector)?.focus?.({ preventScroll: true }), 0); }
    fa(value) { return new this.window.Intl.NumberFormat('fa-IR').format(Number(value) || 0); }
    visibility() { return { answer: isVisible(this.answerForm), feedback: isVisible(this.feedback), remediation: isVisible(this.remediationRoot) }; }
  }

  globalThis.VocoraReviewSessionUx = Object.freeze({ RELEASE, STYLE_ID, STYLE_HREF, PRIMARY_SELECTOR, PRACTICE_INPUT_SELECTOR, setVisible, isVisible, ensureStyles, PracticeViewport, PracticeSessionView });
})();
