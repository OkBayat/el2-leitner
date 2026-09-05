import { AppError } from '../../domain/errors.js';

export class HttpSpeechRecognizer {
  constructor({ url = '', fetchImpl = globalThis.fetch } = {}) {
    this.url = url.replace(/\/$/u, '');
    this.fetch = fetchImpl;
    if (this.url && !/^https?:\/\//u.test(this.url)) throw new Error('SHADOWING_SPEECH_URL must be an HTTP(S) URL.');
  }
  async request(path, method = 'POST', body) {
    if (!this.url) throw new AppError(503, 'SHADOWING_UNAVAILABLE', 'Speech recognition is not configured. Start the speech service to use Shadowing.');
    try {
      const response = await this.fetch(`${this.url}${path}`, {
        method, body, signal: AbortSignal.timeout(10000), redirect: 'error',
        headers: { 'Content-Type': 'application/octet-stream' },
      });
      if (!response.ok) throw new Error(`Speech service returned ${response.status}`);
      const data = await response.json();
      if (data.text !== undefined && (typeof data.text !== 'string' || data.text.length > 8000)) throw new Error('Invalid speech response');
      return data;
    } catch {
      throw new AppError(503, 'SHADOWING_UNAVAILABLE', 'Speech recognition is temporarily unavailable. Please try again. Your attempt was not marked wrong.');
    }
  }
  async ready() { await this.request('/health', 'GET'); }
  async start(id) { await this.request(`/sessions/${encodeURIComponent(id)}`, 'PUT'); }
  async chunk(id, sequence, pcm) {
    const data = await this.request(`/sessions/${encodeURIComponent(id)}/chunks?sequence=${sequence}`, 'POST', pcm);
    return data.text ?? '';
  }
  async finish(id) {
    const data = await this.request(`/sessions/${encodeURIComponent(id)}/finish`);
    return data.text ?? '';
  }
  async cancel(id) {
    try { await this.request(`/sessions/${encodeURIComponent(id)}`, 'DELETE'); } catch { /* Provider TTL also releases interrupted recordings. */ }
  }
}
