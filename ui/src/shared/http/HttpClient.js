export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR' } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export class HttpClient {
  constructor({ fetcher = globalThis.fetch, credentials = 'include' } = {}) {
    if (typeof fetcher !== 'function') throw new TypeError('A fetch function is required.');
    this.fetcher = fetcher;
    this.credentials = credentials;
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const requestHeaders = { Accept: 'application/json', ...headers };
    let requestBody = body;

    if (body !== undefined && body !== null && typeof body !== 'string') {
      requestHeaders['Content-Type'] ??= 'application/json';
      requestBody = JSON.stringify(body);
    }

    const response = await this.fetcher(path, {
      method,
      credentials: this.credentials,
      headers: requestHeaders,
      ...(requestBody === undefined || requestBody === null ? {} : { body: requestBody })
    });

    const raw = response.status === 204 ? '' : await response.text();
    let payload = null;
    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        throw new ApiError('پاسخ نامعتبر از سرور دریافت شد.', {
          status: response.status,
          code: 'INVALID_SERVER_RESPONSE'
        });
      }
    }

    if (!response.ok) {
      throw new ApiError(
        payload?.error?.message || payload?.message || 'درخواست انجام نشد. دوباره تلاش کن.',
        {
          status: response.status,
          code: payload?.error?.code || 'API_ERROR'
        }
      );
    }

    return payload;
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, { ...options, method: 'POST', body });
  }
}
