import { ValidationError } from '../domain/errors.js';

function invalid(message) { throw new ValidationError("INVALID_CONFIGURATION", message); }
function boundedInteger(value, fallback, minimum, maximum, name) {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < minimum || number > maximum) invalid(`${name} must be an integer from ${minimum} to ${maximum}.`);
  return number;
}

export function loadWritingFeedbackConfig(env, { requireProvider = false } = {}) {
  const rawEnabled = String(env.WRITING_FEEDBACK_ENABLED ?? 'false').toLowerCase();
  if (!['false', 'true'].includes(rawEnabled)) invalid('WRITING_FEEDBACK_ENABLED must be true or false.');
  const enabled = rawEnabled === 'true';
  const apiKey = env.OPENAI_API_KEY?.trim() || '';
  const model = env.OPENAI_MODEL?.trim() || 'gpt-5-nano';
  if ((enabled || requireProvider) && !apiKey) invalid('OPENAI_API_KEY is required when AI feedback is enabled.');
  if (!/^[A-Za-z0-9._:-]{1,128}$/u.test(model)) invalid('OPENAI_MODEL is invalid.');
  return {
    enabled, apiKey, model,
    timeoutMs: boundedInteger(env.OPENAI_TIMEOUT_MS, 30_000, 1000, 60_000, 'OPENAI_TIMEOUT_MS'),
    retentionDays: boundedInteger(env.WRITING_FEEDBACK_RETENTION_DAYS, 30, 1, 90, 'WRITING_FEEDBACK_RETENTION_DAYS'),
  };
}
