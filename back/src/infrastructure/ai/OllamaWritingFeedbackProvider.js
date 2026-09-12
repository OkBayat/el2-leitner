import { createHash } from 'node:crypto';
import { WritingFeedbackError } from '../../domain/writing-feedback/WritingFeedbackError.js';
import { WRITING_FEEDBACK_SCHEMA, WRITING_FEEDBACK_SCHEMA_VERSION } from '../../domain/writing-feedback/WritingFeedbackSchema.js';
import { validateWritingFeedbackResult } from '../../domain/writing-feedback/WritingFeedbackResult.js';
import { buildWritingFeedbackMessages, WRITING_FEEDBACK_PROMPT_VERSION, WRITING_FEEDBACK_SYSTEM_PROMPT } from '../../domain/writing-feedback/WritingFeedbackPrompt.js';
import { privateOllamaFetch, privateOllamaUrl } from './PrivateOllamaTransport.js';

const MODEL = 'qwen3:4b-instruct-2507-q4_K_M';
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const MAX_RESPONSE_BYTES = 65536;
const MAX_FEEDBACK_BYTES = 16384;
const METRICS = ['total_duration', 'load_duration', 'prompt_eval_count', 'prompt_eval_cached_count',
  'prompt_eval_duration', 'eval_count', 'eval_duration'];
const fail = code => { throw new WritingFeedbackError(code); };

async function boundedJson(response) {
  if (response.status < 200 || response.status >= 300) {
    await response.body?.cancel(); fail('WRITING_FEEDBACK_PROVIDER_UNAVAILABLE');
  }
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel(); fail('WRITING_FEEDBACK_OUTPUT_LIMIT');
  }
  if (!response.body) fail('WRITING_FEEDBACK_INVALID_RESULT');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); fail('WRITING_FEEDBACK_OUTPUT_LIMIT'); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof WritingFeedbackError) throw error;
    fail('WRITING_FEEDBACK_INVALID_RESULT');
  } finally { reader.releaseLock(); }
}

export class OllamaWritingFeedbackProvider {
  constructor({ baseUrl = 'http://ollama:11434', model = MODEL, modelDigest, tokenizer,
    numCtx = 4096, numPredict = 768, timeoutMs = 120000, fetchImpl = privateOllamaFetch } = {}) {
    this.baseUrl = privateOllamaUrl(baseUrl);
    const normalizedDigest = typeof modelDigest === 'string' ? `sha256:${modelDigest.replace(/^sha256:/, '')}` : '';
    if (model !== MODEL || !DIGEST.test(normalizedDigest)
        || !Number.isInteger(numCtx) || numCtx < 1024 || numCtx > 32768
        || !Number.isInteger(numPredict) || numPredict < 64 || numPredict > 2048 || numPredict >= numCtx
        || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300000) fail('WRITING_FEEDBACK_CONFIGURATION');
    this.model = model; this.modelDigest = normalizedDigest; this.tokenizer = tokenizer;
    this.options = Object.freeze({ num_ctx: numCtx, num_predict: numPredict, temperature: 0, num_gpu: 0 });
    this.timeoutMs = timeoutMs; this.fetchImpl = fetchImpl; this.busy = false;
  }

  getIdentity() {
    return { schemaVersion: WRITING_FEEDBACK_SCHEMA_VERSION, promptVersion: WRITING_FEEDBACK_PROMPT_VERSION,
      schemaSha256: createHash('sha256').update(JSON.stringify(WRITING_FEEDBACK_SCHEMA)).digest('hex'),
      promptSha256: createHash('sha256').update(WRITING_FEEDBACK_SYSTEM_PROMPT).digest('hex'),
      model: this.model, modelDigest: this.modelDigest, locale: 'en', decodingVersion: 'cpu-pilot-v1',
      tokenizerIdentity: this.tokenizer?.getIdentity?.() ?? null, options: { ...this.options } };
  }

  async call(path, payload, signal) {
    return boundedJson(await this.fetchImpl(new URL(path, this.baseUrl), {
      method: payload === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal,
    }));
  }

  async verifyModel(signal) {
    const tags = await this.call('/api/tags', undefined, signal);
    const matches = tags?.models?.filter(item => item.name === this.model || item.model === this.model);
    if (!Array.isArray(matches) || matches.length !== 1
        || `sha256:${matches[0].digest?.replace(/^sha256:/, '')}` !== this.modelDigest) fail('WRITING_FEEDBACK_MODEL_MISMATCH');
  }

  async evaluate(input) {
    const messages = buildWritingFeedbackMessages(input);
    if (!this.tokenizer?.count) fail('WRITING_FEEDBACK_TOKENIZER_UNAVAILABLE');
    if (this.busy) fail('WRITING_FEEDBACK_BUSY');
    if (input.signal?.aborted) fail('WRITING_FEEDBACK_CANCELLED');
    this.busy = true;
    const controller = new AbortController(); let timedOut = false;
    const cancel = () => controller.abort();
    input.signal?.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
    try {
      await this.verifyModel(controller.signal);
      const details = await this.call('/api/show', { model: this.model }, controller.signal);
      if (typeof details?.template !== 'string' || !details.template
          || !details.capabilities?.includes('completion')
          || details.details?.family !== 'qwen3' || details.details?.quantization_level !== 'Q4_K_M') {
        fail('WRITING_FEEDBACK_MODEL_MISMATCH');
      }
      const budget = await this.tokenizer.count({ model: this.model, modelDigest: this.modelDigest,
        messages, format: WRITING_FEEDBACK_SCHEMA, numCtx: this.options.num_ctx,
        numPredict: this.options.num_predict, template: details.template }, { signal: controller.signal });
      if (budget?.modelDigest !== this.modelDigest || typeof budget.rawPrompt !== 'string'
          || !budget.rawPrompt || !Number.isSafeInteger(budget.inputTokens) || budget.inputTokens < 1
          || budget.templateSha256 !== createHash('sha256').update(details.template).digest('hex')
          || !budget.tokenizerIdentity) fail('WRITING_FEEDBACK_TOKENIZER_MISMATCH');
      if (budget.inputTokens + this.options.num_predict > this.options.num_ctx) fail('WRITING_FEEDBACK_INPUT_TOO_LARGE');
      if (controller.signal.aborted) fail(timedOut ? 'WRITING_FEEDBACK_TIMEOUT' : 'WRITING_FEEDBACK_CANCELLED');
      const output = await this.call('/api/generate', { model: this.model, prompt: budget.rawPrompt,
        raw: true, stream: false, format: WRITING_FEEDBACK_SCHEMA, options: this.options, keep_alive: '1m' }, controller.signal);
      if (output?.model !== this.model) fail('WRITING_FEEDBACK_MODEL_MISMATCH');
      if (output.done !== true || output.done_reason !== 'stop'
          || !Number.isSafeInteger(output.eval_count) || output.eval_count >= this.options.num_predict
          || typeof output.response !== 'string' || Buffer.byteLength(output.response) > MAX_FEEDBACK_BYTES) {
        fail('WRITING_FEEDBACK_OUTPUT_LIMIT');
      }
      if (output.prompt_eval_count !== budget.inputTokens) fail('WRITING_FEEDBACK_TOKENIZER_MISMATCH');
      let decoded;
      try { decoded = JSON.parse(output.response); } catch { fail('WRITING_FEEDBACK_INVALID_RESULT'); }
      const result = validateWritingFeedbackResult(decoded, input.draftText);
      if (!input.taskContext.sourceText && (result.issues.some(issue => issue.category === 'source_fidelity')
          || !result.not_assessed.includes('source_fidelity'))) {
        // Omit only the assessment, never silently repair a model claim.
        if (result.issues.some(issue => issue.category === 'source_fidelity')) fail('WRITING_FEEDBACK_INVALID_RESULT');
        result.not_assessed.push('source_fidelity');
      }
      await this.verifyModel(controller.signal);
      const metrics = {};
      for (const key of METRICS) {
        if (output[key] !== undefined) {
          if (!Number.isSafeInteger(output[key]) || output[key] < 0) fail('WRITING_FEEDBACK_INVALID_RESULT');
          metrics[key] = output[key];
        }
      }
      return { result, identity: { ...this.getIdentity(), draftVersion: input.draftVersion,
        contentVersion: input.contentVersion, tokenizerIdentity: budget.tokenizerIdentity,
        templateSha256: budget.templateSha256, rawTemplateVersion: budget.rawTemplateVersion }, metrics };
    } catch (error) {
      if (timedOut) fail('WRITING_FEEDBACK_TIMEOUT');
      if (input.signal?.aborted) fail('WRITING_FEEDBACK_CANCELLED');
      if (error instanceof WritingFeedbackError) throw error;
      if (error?.code === 'TOKENIZER_CONTEXT_EXCEEDED') fail('WRITING_FEEDBACK_INPUT_TOO_LARGE');
      if (error?.code === 'TOKENIZER_IDENTITY_MISMATCH') fail('WRITING_FEEDBACK_TOKENIZER_MISMATCH');
      if (['TOKENIZER_NOT_PROVISIONED', 'TOKENIZER_UNAVAILABLE'].includes(error?.code)) fail('WRITING_FEEDBACK_TOKENIZER_UNAVAILABLE');
      fail('WRITING_FEEDBACK_PROVIDER_UNAVAILABLE');
    } finally {
      clearTimeout(timer); input.signal?.removeEventListener('abort', cancel); this.busy = false;
    }
  }
}
