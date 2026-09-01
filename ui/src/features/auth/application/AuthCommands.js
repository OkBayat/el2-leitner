export class AuthValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AuthValidationError';
    this.code = code;
  }
}

function normalizeCredentials({ email, password }) {
  return {
    email: String(email || '').trim().toLowerCase(),
    password: String(password ?? '')
  };
}

function passwordBytes(password) {
  return new TextEncoder().encode(password).length;
}

function validatePresent(credentials) {
  if (!credentials.email || !credentials.password) {
    throw new AuthValidationError('MISSING_CREDENTIALS', 'ایمیل و رمز عبور را وارد کن.');
  }
  if (passwordBytes(credentials.password) > 72) {
    throw new AuthValidationError('PASSWORD_TOO_LONG', 'رمز عبور نباید بیشتر از ۷۲ بایت باشد.');
  }
}

export class LoginCommand {
  constructor({ gateway }) {
    this.gateway = gateway;
  }

  execute(input) {
    const credentials = normalizeCredentials(input);
    validatePresent(credentials);
    return this.gateway.login(credentials);
  }
}

export class RegisterCommand {
  constructor({ gateway }) {
    this.gateway = gateway;
  }

  execute(input) {
    const credentials = normalizeCredentials(input);
    validatePresent(credentials);
    if (credentials.password.length < 8) {
      throw new AuthValidationError('INVALID_PASSWORD_LENGTH', 'رمز عبور باید حداقل ۸ کاراکتر داشته باشد.');
    }
    return this.gateway.register(credentials);
  }
}

export class GetCurrentUserQuery {
  constructor({ gateway }) {
    this.gateway = gateway;
  }

  execute() {
    return this.gateway.currentUser();
  }
}
