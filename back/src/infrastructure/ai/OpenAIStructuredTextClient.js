import OpenAI from 'openai';

const ERROR_CODES = new Set([
  'CONFIGURATION', 'INVALID_RESULT', 'OUTPUT_LIMIT', 'PROVIDER_UNAVAILABLE',
  'RATE_LIMITED', 'TIMEOUT', 'CANCELLED',
]);

export class AiProviderError extends Error {
  constructor(code) {
    const suffix = ERROR_CODES.has(code) ? code : 'PROVIDER_UNAVAILABLE';
    super('The AI provider request could not be completed.');
    this.name = 'AiProviderError';
    this.code = `AI_PROVIDER_${suffix}`;
  }
}

function mapError(error) {
  if (error instanceof AiProviderError) return error;
  if (error?.name === 'AbortError' || error instanceof OpenAI.APIUserAbortError) {
    return new AiProviderError('CANCELLED');
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) return new AiProviderError('TIMEOUT');
  if (error instanceof OpenAI.RateLimitError || error?.status === 429) return new AiProviderError('RATE_LIMITED');
  return new AiProviderError('PROVIDER_UNAVAILABLE');
}

/** Server-only OpenAI Responses API adapter for strict, bounded JSON results. */
export class OpenAIStructuredTextClient {
  constructor({ apiKey, model = 'gpt-5-nano', timeoutMs = 30_000, client } = {}) {
    if (typeof model !== 'string' || !model.trim() || !Number.isSafeInteger(timeoutMs) || timeoutMs < 1000) {
      throw new AiProviderError('CONFIGURATION');
    }
    if (!client && (typeof apiKey !== 'string' || !apiKey.trim())) throw new AiProviderError('CONFIGURATION');
    this.model = model.trim();
    this.timeoutMs = timeoutMs;
    this.client = client ?? new OpenAI({ apiKey: apiKey.trim(), timeout: timeoutMs, maxRetries: 0 });
  }

  getIdentity() {
    return {
      provider: 'openai', model: this.model, api: 'responses-v1',
      options: { reasoningEffort: 'minimal', verbosity: 'low', store: false },
    };
  }

  async infer({ instructions, input, format, formatName, maxOutputTokens, signal }) {
    if (typeof instructions !== 'string' || typeof input !== 'string' || !format
      || !/^[A-Za-z0-9_-]{1,64}$/u.test(formatName)
      || !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 64 || maxOutputTokens > 2000) {
      throw new AiProviderError('CONFIGURATION');
    }
    const startedAt = performance.now();
    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions,
        input,
        max_output_tokens: maxOutputTokens,
        reasoning: { effort: 'minimal' },
        text: {
          verbosity: 'low',
          format: { type: 'json_schema', name: formatName, schema: format, strict: true },
        },
        store: false,
      }, { signal, timeout: this.timeoutMs });
      if (response.status !== 'completed') throw new AiProviderError('OUTPUT_LIMIT');
      if (typeof response.output_text !== 'string' || !response.output_text.trim()) {
        throw new AiProviderError('INVALID_RESULT');
      }
      let decoded;
      try { decoded = JSON.parse(response.output_text); }
      catch { throw new AiProviderError('INVALID_RESULT'); }
      return {
        decoded,
        provenance: { providerResponseModel: response.model ?? this.model },
        metrics: {
          durationMs: Math.round(performance.now() - startedAt),
          inputTokens: response.usage?.input_tokens ?? null,
          outputTokens: response.usage?.output_tokens ?? null,
          totalTokens: response.usage?.total_tokens ?? null,
        },
      };
    } catch (error) {
      throw mapError(error);
    }
  }
}
