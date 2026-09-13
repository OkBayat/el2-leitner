import { createHash } from 'node:crypto';
import { WritingFeedbackError } from '../../domain/writing-feedback/WritingFeedbackError.js';
import { WRITING_FEEDBACK_SCHEMA, WRITING_FEEDBACK_SCHEMA_VERSION } from '../../domain/writing-feedback/WritingFeedbackSchema.js';
import { validateWritingFeedbackResult } from '../../domain/writing-feedback/WritingFeedbackResult.js';
import { buildWritingFeedbackMessages, WRITING_FEEDBACK_PROMPT_VERSION, WRITING_FEEDBACK_SYSTEM_PROMPT } from '../../domain/writing-feedback/WritingFeedbackPrompt.js';
import { AiProviderError, OpenAIStructuredTextClient } from './OpenAIStructuredTextClient.js';

function writingError(error) {
  if (error instanceof WritingFeedbackError) return error;
  if (error instanceof AiProviderError) return new WritingFeedbackError(error.code.replace('AI_PROVIDER_', 'WRITING_FEEDBACK_'));
  return new WritingFeedbackError('WRITING_FEEDBACK_PROVIDER_UNAVAILABLE');
}

export class OpenAIWritingFeedbackProvider {
  constructor({ client, ...options } = {}) {
    try { this.client = client ?? new OpenAIStructuredTextClient(options); }
    catch (error) { throw writingError(error); }
  }

  getIdentity() {
    return {
      schemaVersion: WRITING_FEEDBACK_SCHEMA_VERSION, promptVersion: WRITING_FEEDBACK_PROMPT_VERSION,
      schemaSha256: createHash('sha256').update(JSON.stringify(WRITING_FEEDBACK_SCHEMA)).digest('hex'),
      promptSha256: createHash('sha256').update(WRITING_FEEDBACK_SYSTEM_PROMPT).digest('hex'),
      ...this.client.getIdentity(), locale: 'en',
    };
  }

  async evaluate(input) {
    const [system, learnerData] = buildWritingFeedbackMessages(input);
    try {
      const { decoded, provenance, metrics } = await this.client.infer({
        instructions: system.content, input: learnerData.content,
        format: WRITING_FEEDBACK_SCHEMA, formatName: 'vocora_writing_feedback',
        maxOutputTokens: 700, signal: input.signal,
      });
      const result = validateWritingFeedbackResult(decoded, input.draftText, input.taskContext);
      if (!input.taskContext.sourceText) {
        if (result.issues.some(issue => issue.category === 'source_fidelity')) throw new WritingFeedbackError('WRITING_FEEDBACK_INVALID_RESULT');
        if (!result.not_assessed.includes('source_fidelity')) result.not_assessed.push('source_fidelity');
      }
      return { result, identity: { ...this.getIdentity(), draftVersion: input.draftVersion,
        contentVersion: input.contentVersion, ...provenance }, metrics };
    } catch (error) { throw writingError(error); }
  }
}
