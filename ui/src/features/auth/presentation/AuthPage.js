import { resolveSafeReturnTo } from '../../../shared/navigation/SafeReturnTo.js';

const ERROR_MESSAGES = Object.freeze({
  INVALID_CREDENTIALS: 'ایمیل یا رمز عبور درست نیست.',
  EMAIL_ALREADY_REGISTERED: 'این ایمیل قبلاً ثبت شده است.',
  INVALID_EMAIL: 'یک ایمیل معتبر وارد کن.',
  INVALID_PASSWORD: 'رمز عبور باید حداقل ۸ کاراکتر و حداکثر ۷۲ بایت باشد.',
  AUTH_RATE_LIMITED: 'تعداد تلاش‌ها زیاد شده است؛ کمی بعد دوباره امتحان کن.',
  MISSING_CREDENTIALS: 'ایمیل و رمز عبور را وارد کن.',
  INVALID_PASSWORD_LENGTH: 'رمز عبور باید حداقل ۸ کاراکتر داشته باشد.'
});

export class AuthPage {
  constructor({ document, window, loginCommand, registerCommand, currentUserQuery, navigate }) {
    this.document = document;
    this.window = window;
    this.loginCommand = loginCommand;
    this.registerCommand = registerCommand;
    this.currentUserQuery = currentUserQuery;
    this.navigate = navigate;
    this.mode = document.body.dataset.authMode === 'register' ? 'register' : 'login';
    this.form = document.querySelector('#authForm');
    this.emailInput = document.querySelector('#email');
    this.passwordInput = document.querySelector('#password');
    this.submitButton = document.querySelector('#authSubmit');
    this.message = document.querySelector('#authMessage');
    this.onSubmit = (event) => this.submit(event);
  }

  mount() {
    if (!this.form || !this.emailInput || !this.passwordInput || !this.submitButton || !this.message) {
      throw new Error('Auth page markup is incomplete.');
    }
    this.form.addEventListener('submit', this.onSubmit);
    return this;
  }

  unmount() {
    this.form?.removeEventListener('submit', this.onSubmit);
  }

  destination() {
    return resolveSafeReturnTo({
      search: this.window.location.search,
      origin: this.window.location.origin
    });
  }

  setMessage(text = '', isError = false) {
    this.message.textContent = text;
    this.message.classList.toggle('error', isError);
    this.message.hidden = !text;
  }

  setLoading(loading) {
    this.submitButton.disabled = loading;
    this.submitButton.textContent = loading
      ? (this.mode === 'register' ? 'در حال ساخت حساب…' : 'در حال ورود…')
      : (this.mode === 'register' ? 'ساخت حساب' : 'ورود به Vocora');
  }

  async checkExistingSession() {
    try {
      await this.currentUserQuery.execute();
      this.navigate(this.destination());
    } catch (error) {
      if (error?.status !== 401) {
        this.setMessage('اتصال به سرور برقرار نشد. می‌توانی دوباره تلاش کنی.', true);
      }
    }
  }

  messageFor(error) {
    if (error?.code === 'PASSWORD_TOO_LONG') {
      return this.mode === 'register'
        ? 'رمز عبور نباید بیشتر از ۷۲ بایت باشد.'
        : 'ایمیل یا رمز عبور درست نیست.';
    }
    return ERROR_MESSAGES[error?.code] || error?.message || 'درخواست انجام نشد. دوباره تلاش کن.';
  }

  async submit(event) {
    event.preventDefault();
    this.setMessage();

    const email = String(this.emailInput.value || '').trim();
    const password = String(this.passwordInput.value || '');
    if (!email || !password) {
      this.setMessage(ERROR_MESSAGES.MISSING_CREDENTIALS, true);
      return;
    }

    this.setLoading(true);
    try {
      const command = this.mode === 'register' ? this.registerCommand : this.loginCommand;
      await command.execute({ email, password });
      this.navigate(this.destination());
    } catch (error) {
      this.setMessage(this.messageFor(error), true);
      this.setLoading(false);
      if (error?.code === 'INVALID_EMAIL') this.emailInput.focus();
      else this.passwordInput.focus();
    }
  }
}
