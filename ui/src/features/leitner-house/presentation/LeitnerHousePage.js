import { filterAndSortWords } from '../application/GetLeitnerHouse.js';
import { parseLeitnerHouse } from '../domain/LeitnerHouse.js';

const faNumber = new Intl.NumberFormat('fa-IR');
const faDateTime = new Intl.DateTimeFormat('fa-IR', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

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

function numericValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatRelativeDue(day, today = localDay()) {
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

export class LeitnerHousePage {
  constructor({ document, window, getHouseQuery, navigate }) {
    this.document = document;
    this.window = window;
    this.getHouseQuery = getHouseQuery;
    this.navigate = navigate || ((destination) => window.location.assign(destination));
    this.words = [];
    this.onFilterChange = () => this.renderWords();
    this.onBack = () => this.goBack();
  }

  element(selector) {
    return this.document.querySelector(selector);
  }

  houseFromLocation() {
    return parseLeitnerHouse(new URLSearchParams(this.window.location.search).get('box'));
  }

  redirectToLogin() {
    const returnTo = `${this.window.location.pathname}${this.window.location.search}${this.window.location.hash}`;
    this.window.location.replace(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
  }

  goBack() {
    let sameOriginReferrer = false;
    if (this.document.referrer) {
      try {
        sameOriginReferrer = new URL(this.document.referrer).origin === this.window.location.origin;
      } catch {
        sameOriginReferrer = false;
      }
    }
    if (sameOriginReferrer && this.window.history.length > 1) this.window.history.back();
    else this.navigate('index.html#dashboard');
  }

  renderHouseInfo(model) {
    const house = model?.house || {};
    const summary = model?.summary || {};
    const houseNumber = numericValue(house.number);
    this.element('#leitnerHouseTitle').textContent = `واژه‌های خانهٔ ${faNumber.format(houseNumber)}`;
    this.document.title = `خانهٔ ${faNumber.format(houseNumber)} | Vocora`;
    this.element('#leitnerHouseNumber').textContent = `خانهٔ ${faNumber.format(houseNumber)}`;
    this.element('#leitnerHouseHeadline').textContent = `${faNumber.format(numericValue(summary.totalWords))} واژه در این خانه`;
    this.element('#leitnerHouseDescription').textContent = `فاصلهٔ مرور این خانه ${faNumber.format(numericValue(house.reviewIntervalDays))} روز است و ${faNumber.format(numericValue(house.stateCount))} وضعیت زمانی دارد.`;
    this.element('#leitnerHouseTotal').textContent = faNumber.format(numericValue(summary.totalWords));
    this.element('#leitnerHouseDue').textContent = faNumber.format(numericValue(summary.dueWords));
    this.element('#leitnerHouseMistakes').textContent = faNumber.format(numericValue(summary.totalMistakes));
    this.element('#leitnerHouseAttempts').textContent = faNumber.format(numericValue(summary.totalAttempts));
    this.element('#leitnerHouseInterval').textContent = `${faNumber.format(numericValue(house.reviewIntervalDays))} روز`;
    this.element('#leitnerHouseStateCount').textContent = faNumber.format(numericValue(house.stateCount));
  }

  renderWords() {
    const search = this.element('#leitnerHouseSearch')?.value || '';
    const sort = this.element('#leitnerHouseSort')?.value || 'mistakes';
    const rows = filterAndSortWords(this.words, { search, sort });
    const body = this.element('#leitnerHouseWordsBody');
    const resultLabel = this.element('#leitnerHouseResults');

    resultLabel.textContent = search
      ? `${faNumber.format(rows.length)} واژه از ${faNumber.format(this.words.length)} نتیجه`
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

  showError(message) {
    const error = this.element('#leitnerHouseError');
    error.textContent = message;
    error.classList.remove('hidden');
    this.element('#leitnerHouseWordsBody').innerHTML = '<tr><td colspan="6" class="leitner-house-empty">اطلاعاتی برای نمایش در دسترس نیست.</td></tr>';
    this.element('#leitnerHouseResults').textContent = 'دریافت اطلاعات ناموفق بود';
  }

  bind() {
    this.element('#leitnerHouseBackBtn')?.addEventListener('click', this.onBack);
    this.element('#leitnerHouseSearch')?.addEventListener('input', this.onFilterChange);
    this.element('#leitnerHouseSort')?.addEventListener('change', this.onFilterChange);
  }

  unbind() {
    this.element('#leitnerHouseBackBtn')?.removeEventListener('click', this.onBack);
    this.element('#leitnerHouseSearch')?.removeEventListener('input', this.onFilterChange);
    this.element('#leitnerHouseSort')?.removeEventListener('change', this.onFilterChange);
  }

  async mount() {
    const house = this.houseFromLocation();
    this.element('#leitnerHouseBackBtn')?.addEventListener('click', this.onBack);
    if (!house) {
      this.showError('شمارهٔ خانه معتبر نیست. فقط خانه‌های ۱ تا ۵ قابل نمایش هستند.');
      return null;
    }

    this.element('#leitnerHouseTitle').textContent = `واژه‌های خانهٔ ${faNumber.format(house)}`;
    this.element('#leitnerHouseNumber').textContent = `خانهٔ ${faNumber.format(house)}`;

    try {
      const model = await this.getHouseQuery.execute(house);
      this.words = Array.isArray(model?.words) ? model.words : [];
      this.renderHouseInfo(model);
      this.renderWords();
      this.element('#leitnerHouseSearch')?.addEventListener('input', this.onFilterChange);
      this.element('#leitnerHouseSort')?.addEventListener('change', this.onFilterChange);
      return { house, model, rerender: this.onFilterChange };
    } catch (error) {
      if (error?.status === 401) {
        this.redirectToLogin();
        return null;
      }
      this.showError(error?.message || 'دریافت اطلاعات خانه انجام نشد.');
      return null;
    }
  }

  destroy() {
    this.unbind();
  }
}
