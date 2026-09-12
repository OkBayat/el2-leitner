import { WritingFeedbackError } from './WritingFeedbackError.js';
import { WRITING_FEEDBACK_SCHEMA } from './WritingFeedbackSchema.js';

function invalid() { throw new WritingFeedbackError('WRITING_FEEDBACK_INVALID_RESULT'); }

// This interpreter supports only the closed schema vocabulary above. Unknown
// keywords fail closed so future schema extensions must update this owner too.
function matches(schema, value) {
  const keywords = new Set(['type', 'const', 'enum', 'anyOf', 'properties', 'required',
    'additionalProperties', 'minLength', 'maxLength', 'minItems', 'maxItems',
    'uniqueItems', 'items', 'minimum', 'maximum']);
  if (Object.keys(schema).some(key => !keywords.has(key))) return false;
  if (Object.hasOwn(schema, 'const') && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.anyOf && !schema.anyOf.some(candidate => matches(candidate, value))) return false;
  if (schema.type === 'null') return value === null;
  if (schema.type === 'integer') return Number.isSafeInteger(value) && value >= schema.minimum && value <= schema.maximum;
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false;
    const chars = Array.from(value);
    if (chars.some(char => char.codePointAt(0) >= 0xd800 && char.codePointAt(0) <= 0xdfff)) return false;
    return chars.length >= schema.minLength && chars.length <= schema.maxLength
      && (schema.minLength === 0 || value.trim().length > 0);
  }
  if (schema.type === 'array') return Array.isArray(value)
    && value.length >= (schema.minItems ?? 0) && value.length <= schema.maxItems
    && (!schema.uniqueItems || new Set(value.map(item => JSON.stringify(item))).size === value.length)
    && value.every(item => matches(schema.items, item));
  if (schema.type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
    && schema.required.every(key => Object.hasOwn(value, key))
    && Object.keys(value).every(key => Object.hasOwn(schema.properties, key))
    && Object.entries(schema.properties).every(([key, child]) => matches(child, value[key]));
  return schema.type === undefined;
}

function locateQuote(draft, quote, occurrence) {
  if (!quote || !Number.isSafeInteger(occurrence)) invalid();
  let start = -1; let cursor = 0;
  for (let found = 0; found < occurrence; found += 1) {
    start = draft.indexOf(quote, cursor);
    if (start < 0) invalid();
    cursor = start + quote.length;
  }
  return { start: Array.from(draft.slice(0, start)).length,
    end: Array.from(draft.slice(0, cursor)).length, indexing: 'unicode-code-points' };
}

export function validateWritingFeedbackResult(value, draftText) {
  if (typeof draftText !== 'string' || !matches(WRITING_FEEDBACK_SCHEMA, value)
      || !value.not_assessed.includes('ielts_band')) invalid();
  if (value.assessment_status === 'feedback_available' && value.abstention_reason !== null) invalid();
  if (value.assessment_status === 'insufficient_evidence'
      && (typeof value.abstention_reason !== 'string' || !value.abstention_reason.trim()
        || value.task_relevance !== 'not_assessed' || value.issues.length !== 0)) invalid();
  const spans = [];
  const issues = value.issues.map(issue => {
    if (value.not_assessed.includes(issue.category)) invalid();
    if (issue.quoted_text === null) {
      if (issue.occurrence !== null || issue.replacement !== null
          || !['coherence', 'task_coverage', 'source_fidelity'].includes(issue.category)) invalid();
      return { ...issue, span: null };
    }
    const span = locateQuote(draftText, issue.quoted_text, issue.occurrence);
    if (spans.some(other => span.start < other.end && other.start < span.end)) invalid();
    spans.push(span);
    return { ...issue, span };
  });
  return { ...value, issues, revision_actions: [...value.revision_actions], not_assessed: [...value.not_assessed] };
}
