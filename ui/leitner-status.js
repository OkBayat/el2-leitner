(() => {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_WAIT_DAYS = Object.freeze([0, 1, 2, 3, 7, 14]);
  const EXPORT_FEEDBACK_MS = 1600;
  const faNumber = new Intl.NumberFormat('fa-IR');

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function parseDay(day) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const date = Number(match[3]);
    const timestamp = Date.UTC(year, month - 1, date);
    const parsed = new Date(timestamp);
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) return null;
    return Math.floor(timestamp / DAY_MS);
  }

  function localDay(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function stateCountForHouse(box, waitDays = DEFAULT_WAIT_DAYS) {
    const house = clamp(Math.trunc(Number(box) || 1), 1, 5);
    return Math.max(1, Math.trunc(Number(waitDays[house]) || house));
  }

  function segmentIndexForWord(word, box, today, waitDays = DEFAULT_WAIT_DAYS) {
    const house = clamp(Math.trunc(Number(box) || 1), 1, 5);
    const segmentCount = stateCountForHouse(house, waitDays);
    if (house === 5 && word?.masteredAt) return segmentCount - 1;

    const todaySerial = parseDay(today);
    const dueSerial = parseDay(word?.due);
    const waitingDays = segmentCount;
    if (todaySerial === null || dueSerial === null) return 0;

    const startedSerial = dueSerial - waitingDays;
    const elapsedDays = clamp(todaySerial - startedSerial, 0, waitingDays);
    if (elapsedDays >= waitingDays) return segmentCount - 1;

    return clamp(Math.floor(elapsedDays), 0, segmentCount - 1);
  }

  function buildDistribution(words, today = localDay(), waitDays = DEFAULT_WAIT_DAYS) {
    const source = Array.isArray(words) ? words : [];
    const houses = [1, 2, 3, 4, 5].map((box) => {
      const segments = Array.from({ length: stateCountForHouse(box, waitDays) }, () => 0);
      source.forEach((word) => {
        if (Number(word?.box) !== box || word?.masteredAt) return;
        segments[segmentIndexForWord(word, box, today, waitDays)] += 1;
      });
      return {
        box,
        total: segments.reduce((sum, count) => sum + count, 0),
        segments
      };
    });

    return {
      total: houses.reduce((sum, house) => sum + house.total, 0),
      houses
    };
  }

  function normalizedMistakes(word) {
    const value = Number(word?.mistakes);
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  }

  function normalizedWordNumber(word) {
    const value = Number(word?.number);
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  }

  function normalizedTerm(word) {
    return String(word?.term || '').replace(/\s+/g, ' ').trim();
  }

  function buildBoxOneEntries(words) {
    const source = Array.isArray(words) ? words : [];
    return source
      .filter((word) => Number(word?.box) === 1)
      .map((word) => ({
        term: normalizedTerm(word),
        mistakes: normalizedMistakes(word),
        number: normalizedWordNumber(word)
      }))
      .filter((entry) => entry.term)
      .sort((a, b) => b.mistakes - a.mistakes || a.number - b.number || a.term.localeCompare(b.term, 'en', { sensitivity: 'base' }));
  }

  function buildBoxOneExport(words) {
    return buildBoxOneEntries(words)
      .map((entry) => `${entry.term} — ${entry.mistakes}`)
      .join('\n');
  }

  async function copyText(text, options = {}) {
    const value = String(text || '');
    if (!value) return false;

    const navigatorObject = options.navigator || globalThis.navigator;
    if (navigatorObject?.clipboard && typeof navigatorObject.clipboard.writeText === 'function') {
      try {
        await navigatorObject.clipboard.writeText(value);
        return true;
      } catch {
        // Fall back to the selection-based copy path below.
      }
    }

    const doc = options.document || globalThis.document;
    if (!doc?.body || typeof doc.createElement !== 'function' || typeof doc.execCommand !== 'function') return false;

    const textarea = doc.createElement('textarea');
    textarea.value = value;
    textarea.dir = 'ltr';
    textarea.setAttribute('readonly', '');
    textarea.setAttribute('aria-hidden', 'true');
    textarea.style.position = 'fixed';
    textarea.style.inset = '-9999px auto auto -9999px';
    textarea.style.opacity = '0';
    doc.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange?.(0, value.length);

    try {
      return Boolean(doc.execCommand('copy'));
    } catch {
      return false;
    } finally {
      textarea.remove();
    }
  }

  function houseIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 10.25 12 4.5l7.25 5.75v8.5a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-8.5Z"/><path d="M9.25 20.5v-6.25h5.5v6.25"/></svg>';
  }

  function copyIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>';
  }

  function renderDistributionHtml(model) {
    return model.houses.map((house) => {
      const stateCount = house.segments.length;
      const segments = house.segments.map((count, index) => {
        const stage = index + 1;
        const tooltip = `خانه ${faNumber.format(house.box)} · وضعیت ${faNumber.format(stage)} از ${faNumber.format(stateCount)} · ${faNumber.format(count)} لغت`;
        const occupancyClass = count > 0 ? 'is-occupied' : 'is-empty';
        return `<span class="leitner-segment leitner-segment--${stage} ${occupancyClass}" data-stage="${stage}" data-count="${count}" data-tooltip="${tooltip}" aria-label="${tooltip}" role="img" tabindex="0"><span class="leitner-state-index" aria-hidden="true">${faNumber.format(stage)}</span><b>${faNumber.format(count)}</b></span>`;
      }).join('');
      return `<div class="leitner-row leitner-house--${house.box}" data-house="${house.box}" data-state-count="${stateCount}"><div class="leitner-house-label"><span class="leitner-house-icon">${houseIcon()}</span><strong>خانه ${faNumber.format(house.box)}</strong></div><div class="leitner-segments" style="--segment-count:${stateCount}">${segments}</div><div class="leitner-row-total"><strong>${faNumber.format(house.total)}</strong><span>لغت</span></div></div>`;
    }).join('');
  }

  function render(root, model) {
    if (!root) return;
    root.innerHTML = renderDistributionHtml(model);
    root.dataset.leitnerEnhanced = 'true';
  }

  function updateTotal(totalElement, total) {
    if (!totalElement) return;
    const text = totalElement.querySelector('[data-leitner-total-text]');
    if (text) text.textContent = `مجموع: ${faNumber.format(total)} لغت`;
    else totalElement.textContent = `مجموع: ${faNumber.format(total)} لغت`;
  }

  function ensureExportButton(doc, totalElement) {
    if (!doc) return null;
    const existing = doc.querySelector('#boxOneExportBtn');
    if (existing) return existing;

    const head = totalElement?.closest?.('.leitner-panel-head') || doc.querySelector('.leitner-panel-head');
    if (!head) return null;

    const button = doc.createElement('button');
    button.id = 'boxOneExportBtn';
    button.className = 'leitner-export-btn';
    button.type = 'button';
    button.dataset.exportStatus = 'idle';
    button.innerHTML = `${copyIcon()}<span data-box-one-export-label>کپی خانه ۱</span>`;
    button.title = 'کپی همهٔ کلمات خانهٔ ۱ همراه با تعداد اشتباهات';
    button.setAttribute('aria-label', button.title);

    if (totalElement?.parentNode === head) head.insertBefore(button, totalElement);
    else head.appendChild(button);
    return button;
  }

  function updateExportButton(button, words) {
    if (!button) return 0;
    const count = buildBoxOneEntries(words).length;
    const status = button.dataset.exportStatus || 'idle';
    const label = button.querySelector('[data-box-one-export-label]');

    button.dataset.wordCount = String(count);
    button.disabled = count === 0 || status === 'copying';
    button.classList.toggle('is-empty', count === 0);
    if (status === 'idle' && label) label.textContent = 'کپی خانه ۱';

    const detail = count
      ? `کپی ${faNumber.format(count)} کلمهٔ خانهٔ ۱ همراه با تعداد اشتباهات`
      : 'خانهٔ ۱ کلمه‌ای برای کپی ندارد';
    button.title = detail;
    button.setAttribute('aria-label', detail);
    return count;
  }

  function setExportStatus(button, status) {
    if (!button) return;
    const label = button.querySelector('[data-box-one-export-label]');
    const labels = {
      idle: 'کپی خانه ۱',
      copying: 'در حال کپی…',
      copied: 'کپی شد',
      failed: 'کپی نشد'
    };
    button.dataset.exportStatus = status;
    button.classList.toggle('is-copied', status === 'copied');
    button.classList.toggle('is-failed', status === 'failed');
    if (label) label.textContent = labels[status] || labels.idle;
  }

  function attach(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc) return null;
    const root = options.root || doc.querySelector('#boxDistribution');
    const totalElement = options.totalElement || doc.querySelector('#boxDistributionTotal');
    const getState = options.getState || (() => globalThis.VazheyarTest?.getState?.());
    const getToday = options.getToday || (() => localDay());
    if (!root || typeof getState !== 'function') return null;

    const exportButton = options.exportButton || ensureExportButton(doc, totalElement);
    const copy = options.copyText || ((text) => copyText(text, {
      document: doc,
      navigator: options.navigator || globalThis.navigator
    }));
    const schedule = options.setTimeout || globalThis.setTimeout;
    const cancel = options.clearTimeout || globalThis.clearTimeout;
    const feedbackDuration = Number.isFinite(Number(options.feedbackDuration))
      ? Math.max(0, Number(options.feedbackDuration))
      : EXPORT_FEEDBACK_MS;
    let feedbackTimer = null;
    let exportInFlight = false;

    const enhance = () => {
      const state = getState();
      if (!state || !Array.isArray(state.words)) return;
      const model = buildDistribution(state.words, getToday(), options.waitDays || DEFAULT_WAIT_DAYS);
      render(root, model);
      updateTotal(totalElement, model.total);
      updateExportButton(exportButton, state.words);
    };

    const resetExportFeedback = () => {
      setExportStatus(exportButton, 'idle');
      updateExportButton(exportButton, getState()?.words);
    };

    const handleExport = async () => {
      if (!exportButton || exportInFlight) return;
      const state = getState();
      const text = buildBoxOneExport(state?.words);
      if (!text) {
        resetExportFeedback();
        return;
      }

      exportInFlight = true;
      setExportStatus(exportButton, 'copying');
      updateExportButton(exportButton, state.words);
      let copied = false;
      try {
        copied = await copy(text);
      } catch {
        copied = false;
      } finally {
        exportInFlight = false;
      }

      setExportStatus(exportButton, copied ? 'copied' : 'failed');
      updateExportButton(exportButton, getState()?.words);
      if (feedbackTimer !== null && typeof cancel === 'function') cancel(feedbackTimer);
      if (typeof schedule === 'function') feedbackTimer = schedule(resetExportFeedback, feedbackDuration);
    };

    exportButton?.addEventListener('click', handleExport);
    enhance();

    const Observer = options.MutationObserver || globalThis.MutationObserver;
    if (typeof Observer !== 'function') {
      return {
        enhance,
        observer: null,
        exportButton,
        handleExport,
        destroy() {
          exportButton?.removeEventListener('click', handleExport);
          if (feedbackTimer !== null && typeof cancel === 'function') cancel(feedbackTimer);
        }
      };
    }
    const observer = new Observer(() => {
      if (root.querySelector?.('.box-row')) enhance();
    });
    observer.observe(root, { childList: true });
    return {
      enhance,
      observer,
      exportButton,
      handleExport,
      destroy() {
        observer.disconnect();
        exportButton?.removeEventListener('click', handleExport);
        if (feedbackTimer !== null && typeof cancel === 'function') cancel(feedbackTimer);
      }
    };
  }

  const api = {
    DEFAULT_WAIT_DAYS,
    parseDay,
    localDay,
    stateCountForHouse,
    segmentIndexForWord,
    buildDistribution,
    buildBoxOneExport,
    copyText,
    renderDistributionHtml,
    render,
    updateTotal,
    ensureExportButton,
    updateExportButton,
    attach
  };

  globalThis.VocoraLeitnerStatus = api;

  if (globalThis.document) {
    const ready = globalThis.VazheyarReady;
    if (ready && typeof ready.then === 'function') {
      ready.then(() => attach()).catch(() => {});
    } else if (globalThis.document.readyState === 'loading') {
      globalThis.document.addEventListener('DOMContentLoaded', () => attach(), { once: true });
    } else {
      attach();
    }
  }
})();
