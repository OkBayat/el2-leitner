(() => {
  'use strict';

  const faNumber = new Intl.NumberFormat('fa-IR');
  const faDateTime = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  function parseHouseNumber(value) {
    const house = Number(value);
    return Number.isInteger(house) && house >= 1 && house <= 5 ? house : null;
  }

  function localDay(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function addDays(day, amount) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ''));
    if (!match) return null;
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + amount, 12);
    return localDay(date);
  }

  function normalizeSearch(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLocaleLowerCase('en')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function wordSearchText(word) {
    return normalizeSearch([
      word?.term,
      ...(Array.isArray(word?.accepted) ? word.accepted : []),
      word?.category,
      ...(Array.isArray(word?.tags) ? word.tags : []),
      ...(Array.isArray(word?.lessons) ? word.lessons : [])
    ].filter(Boolean).join(' '));
  }

  function numericValue(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function compareByNumberThenTerm(a, b) {
    const numberDiff = numericValue(a?.number) - numericValue(b?.number);
    if (numberDiff) return numberDiff;
    return String(a?.term || '').localeCompare(String(b?.term || ''), 'en', { sensitivity: 'base' });
  }

  function filterAndSortWords(words, options = {}) {
    const source = Array.isArray(words) ? words : [];
    const search = normalizeSearch(options.search);
    const sort = options.sort || 'mistakes';
    const result = source.filter((word) => !search || wordSearchText(word).includes(search));

    result.sort((a, b) => {
      if (sort === 'alpha') {
        return String(a?.term || '').localeCompare(String(b?.term || ''), 'en', { sensitivity: 'base' })
          || compareByNumberThenTerm(a, b);
      }
      if (sort === 'due') {
        return String(a?.due || '9999-12-31').localeCompare(String(b?.due || '9999-12-31'))
          || compareByNumberThenTerm(a, b);
      }
      if (sort === 'recent') {
        if (!a?.lastReviewed && !b?.lastReviewed) return compareByNumberThenTerm(a, b);
        if (!a?.lastReviewed) return 1;
        if (!b?.lastReviewed) return -1;
        return String(b.lastReviewed).localeCompare(String(a.lastReviewed))
          || compareByNumberThenTerm(a, b);
      }
      return numericValue(b?.mistakes) - numericValue(a?.mistakes)
        || compareByNumberThenTerm(a, b);
    });

    return result;
  }

  function formatRelativeDue(day, today = localDay()) {
    if (!day) return '—';
    if (day < today) return 'عقب‌افتاده';
    if (day === today) return 'امروز';
    if (day === addDays(today, 1)) return 'فردا';
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day));
    if (!match) return String(day);
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    return faDateTime.format(date);
  }

  function formatLastReviewed(value) {
    if (!value) return 'هنوز مرور نشده';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : faDateTime.format(date);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function redirectToLogin(win) {
    const returnTo = `${win.location.pathname}${win.location.search}${win.location.hash}`;
    win.location.replace(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function requestHouse(house, options = {}) {
    const fetcher = options.fetch || globalThis.fetch;
    if (typeof fetcher !== 'function') throw new Error('Fetch is unavailable.');
    const response = await fetcher(`/api/learning/boxes/${house}`, {
      credentials: 'include',
      headers: { Accept: 'application/json' }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'دریافت اطلاعات خانه انجام نشد.');
      error.status = response.status;
      error.code = payload?.error?.code || 'HOUSE_REQUEST_FAILED';
      throw error;
    }
    return payload;
  }

  function renderHouseInfo(doc, model) {
    const house = model?.house || {};
    const summary = model?.summary || {};
    const houseNumber = numericValue(house.number);
    doc.querySelector('#leitnerHouseTitle').textContent = `واژه‌های خانهٔ ${faNumber.format(houseNumber)}`;
    doc.title = `خانهٔ ${faNumber.format(houseNumber)} | Vocora`;
    doc.querySelector('#leitnerHouseNumber').textContent = `خانهٔ ${faNumber.format(houseNumber)}`;
    doc.querySelector('#leitnerHouseHeadline').textContent = `${faNumber.format(numericValue(summary.totalWords))} واژه در این خانه`;
    doc.querySelector('#leitnerHouseDescription').textContent = `فاصلهٔ مرور این خانه ${faNumber.format(numericValue(house.reviewIntervalDays))} روز است و ${faNumber.format(numericValue(house.stateCount))} وضعیت زمانی دارد.`;
    doc.querySelector('#leitnerHouseTotal').textContent = faNumber.format(numericValue(summary.totalWords));
    doc.querySelector('#leitnerHouseDue').textContent = faNumber.format(numericValue(summary.dueWords));
    doc.querySelector('#leitnerHouseMistakes').textContent = faNumber.format(numericValue(summary.totalMistakes));
    doc.querySelector('#leitnerHouseAttempts').textContent = faNumber.format(numericValue(summary.totalAttempts));
    doc.querySelector('#leitnerHouseInterval').textContent = `${faNumber.format(numericValue(house.reviewIntervalDays))} روز`;
    doc.querySelector('#leitnerHouseStateCount').textContent = faNumber.format(numericValue(house.stateCount));
  }

  function renderWords(doc, words) {
    const search = doc.querySelector('#leitnerHouseSearch').value;
    const sort = doc.querySelector('#leitnerHouseSort').value;
    const rows = filterAndSortWords(words, { search, sort });
    const body = doc.querySelector('#leitnerHouseWordsBody');
    const resultLabel = doc.querySelector('#leitnerHouseResults');

    resultLabel.textContent = search
      ? `${faNumber.format(rows.length)} واژه از ${faNumber.format(words.length)} نتیجه`
      : `${faNumber.format(rows.length)} واژه`;

    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="6" class="leitner-house-empty">${search ? 'واژه‌ای با این جستجو پیدا نشد.' : 'در حال حاضر واژه‌ای در این خانه وجود ندارد.'}</td></tr>`;
      return;
    }

    body.innerHTML = rows.map((word) => {
      const accepted = Array.isArray(word.accepted) && word.accepted.length
        ? word.accepted.join(' / ')
        : word.term;
      const lessons = Array.isArray(word.lessons) ? word.lessons.filter(Boolean) : [];
      const tags = Array.isArray(word.tags) ? word.tags.filter(Boolean) : [];
      const sourceLine = [word.category, ...lessons].filter(Boolean).join(' · ') || 'بدون دسته‌بندی';
      const tagLine = tags.length ? `<small>${escapeHtml(tags.join('، '))}</small>` : '';
      return `<tr>
        <td><div class="leitner-house-word"><strong>${escapeHtml(word.term)}</strong>${accepted !== word.term ? `<small>${escapeHtml(accepted)}</small>` : ''}</div></td>
        <td><div>${escapeHtml(sourceLine)}</div>${tagLine}</td>
        <td>${faNumber.format(numericValue(word.attempts))}</td>
        <td><span class="leitner-house-mistakes">${faNumber.format(numericValue(word.mistakes))}</span></td>
        <td><span class="leitner-house-due">${escapeHtml(formatRelativeDue(word.due))}</span></td>
        <td class="leitner-house-secondary">${escapeHtml(formatLastReviewed(word.lastReviewed))}</td>
      </tr>`;
    }).join('');
  }

  function showError(doc, message) {
    const error = doc.querySelector('#leitnerHouseError');
    error.textContent = message;
    error.classList.remove('hidden');
    doc.querySelector('#leitnerHouseWordsBody').innerHTML = '<tr><td colspan="6" class="leitner-house-empty">اطلاعاتی برای نمایش در دسترس نیست.</td></tr>';
    doc.querySelector('#leitnerHouseResults').textContent = 'دریافت اطلاعات ناموفق بود';
  }

  function configureBackButton(doc, win) {
    doc.querySelector('#leitnerHouseBackBtn').addEventListener('click', () => {
      let sameOriginReferrer = false;
      if (doc.referrer) {
        try {
          sameOriginReferrer = new URL(doc.referrer).origin === win.location.origin;
        } catch {
          sameOriginReferrer = false;
        }
      }
      if (sameOriginReferrer && win.history.length > 1) win.history.back();
      else win.location.assign('index.html#dashboard');
    });
  }

  async function mount(options = {}) {
    const doc = options.document || globalThis.document;
    const win = options.window || globalThis.window;
    if (!doc || !win) return null;

    const house = parseHouseNumber(new URLSearchParams(win.location.search).get('box'));
    configureBackButton(doc, win);
    if (!house) {
      showError(doc, 'شمارهٔ خانه معتبر نیست. فقط خانه‌های ۱ تا ۵ قابل نمایش هستند.');
      return null;
    }

    doc.querySelector('#leitnerHouseTitle').textContent = `واژه‌های خانهٔ ${faNumber.format(house)}`;
    doc.querySelector('#leitnerHouseNumber').textContent = `خانهٔ ${faNumber.format(house)}`;

    try {
      const model = await requestHouse(house, { fetch: options.fetch || win.fetch?.bind(win) || globalThis.fetch });
      const words = Array.isArray(model?.words) ? model.words : [];
      renderHouseInfo(doc, model);
      renderWords(doc, words);

      const search = doc.querySelector('#leitnerHouseSearch');
      const sort = doc.querySelector('#leitnerHouseSort');
      const rerender = () => renderWords(doc, words);
      search.addEventListener('input', rerender);
      sort.addEventListener('change', rerender);
      return { house, model, rerender };
    } catch (error) {
      if (error?.status === 401) {
        redirectToLogin(win);
        return null;
      }
      showError(doc, error?.message || 'دریافت اطلاعات خانه انجام نشد.');
      return null;
    }
  }

  const api = {
    parseHouseNumber,
    normalizeSearch,
    filterAndSortWords,
    formatRelativeDue,
    requestHouse,
    mount
  };

  globalThis.VocoraLeitnerHouse = api;

  if (globalThis.document && globalThis.window) {
    if (globalThis.document.readyState === 'loading') {
      globalThis.document.addEventListener('DOMContentLoaded', () => mount(), { once: true });
    } else {
      mount();
    }
  }
})();
