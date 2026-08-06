(() => {
  'use strict';

  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_WAIT_DAYS = Object.freeze([0, 1, 2, 3, 7, 14]);
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

  function segmentIndexForWord(word, box, today, waitDays = DEFAULT_WAIT_DAYS) {
    const segmentCount = clamp(Number(box) || 1, 1, 5);
    if (segmentCount === 1) return 0;

    const todaySerial = parseDay(today);
    const dueSerial = parseDay(word?.due);
    const waitingDays = Math.max(1, Number(waitDays[segmentCount]) || segmentCount);
    if (todaySerial === null || dueSerial === null) return 0;

    const startedSerial = dueSerial - waitingDays;
    const elapsedDays = clamp(todaySerial - startedSerial, 0, waitingDays);
    if (elapsedDays >= waitingDays) return segmentCount - 1;

    return clamp(Math.floor((elapsedDays / waitingDays) * segmentCount), 0, segmentCount - 1);
  }

  function buildDistribution(words, today = localDay(), waitDays = DEFAULT_WAIT_DAYS) {
    const source = Array.isArray(words) ? words : [];
    const houses = [1, 2, 3, 4, 5].map((box) => {
      const segments = Array.from({ length: box }, () => 0);
      source.forEach((word) => {
        if (Number(word?.box) !== box) return;
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

  function houseIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 10.25 12 4.5l7.25 5.75v8.5a1.75 1.75 0 0 1-1.75 1.75h-11a1.75 1.75 0 0 1-1.75-1.75v-8.5Z"/><path d="M9.25 20.5v-6.25h5.5v6.25"/></svg>';
  }

  function layersIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 4 8 4-8 4-8-4 8-4Z"/><path d="m4 12 8 4 8-4M4 16l8 4 8-4"/></svg>';
  }

  function renderDistributionHtml(model) {
    return model.houses.map((house) => {
      const segments = house.segments.map((count, index) => {
        const stage = index + 1;
        const tooltip = `خانه ${faNumber.format(house.box)} · بخش ${faNumber.format(stage)} از ${faNumber.format(house.box)} · ${faNumber.format(count)} لغت`;
        return `<span class="leitner-segment leitner-segment--${stage}" data-stage="${stage}" data-count="${count}" data-tooltip="${tooltip}" aria-label="${tooltip}" role="img"><b>${faNumber.format(count)}</b></span>`;
      }).join('');
      return `<div class="leitner-row leitner-house--${house.box}" data-house="${house.box}"><div class="leitner-house-label"><span class="leitner-house-icon">${houseIcon()}</span><strong>خانه ${faNumber.format(house.box)}</strong></div><div class="leitner-segments" style="--segment-count:${house.box}">${segments}</div><div class="leitner-row-total"><strong>${faNumber.format(house.total)}</strong><span>لغت</span></div></div>`;
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

  function attach(options = {}) {
    const doc = options.document || globalThis.document;
    if (!doc) return null;
    const root = options.root || doc.querySelector('#boxDistribution');
    const totalElement = options.totalElement || doc.querySelector('#boxDistributionTotal');
    const getState = options.getState || (() => globalThis.VazheyarTest?.getState?.());
    const getToday = options.getToday || (() => localDay());
    if (!root || typeof getState !== 'function') return null;

    const enhance = () => {
      const state = getState();
      if (!state || !Array.isArray(state.words)) return;
      const model = buildDistribution(state.words, getToday(), options.waitDays || DEFAULT_WAIT_DAYS);
      render(root, model);
      updateTotal(totalElement, model.total);
    };

    enhance();

    const Observer = options.MutationObserver || globalThis.MutationObserver;
    if (typeof Observer !== 'function') return { enhance, observer: null };
    const observer = new Observer(() => {
      if (root.querySelector?.('.box-row')) enhance();
    });
    observer.observe(root, { childList: true });
    return { enhance, observer };
  }

  const api = {
    DEFAULT_WAIT_DAYS,
    parseDay,
    localDay,
    segmentIndexForWord,
    buildDistribution,
    renderDistributionHtml,
    render,
    updateTotal,
    attach,
    layersIcon
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
