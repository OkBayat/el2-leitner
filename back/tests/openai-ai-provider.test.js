import assert from 'node:assert/strict';
import test from 'node:test';
import OpenAI from 'openai';
import { OpenAIStructuredTextClient } from '../src/infrastructure/ai/OpenAIStructuredTextClient.js';
import { OpenAIWritingFeedbackProvider } from '../src/infrastructure/ai/OpenAIWritingFeedbackProvider.js';
import { OpenAIConversationProvider } from '../src/infrastructure/ai/OpenAIConversationProvider.js';

const writingContext = (mode = 'sentence') => ({
  schemaVersion: 1, learnerLevel: 'B1', targetSkill: 'Answer the task clearly.',
  languageObjectives: ['Use accurate English.'], taskExpectations: ['Address the prompt.'],
  prompt: 'What did you do yesterday?', mode, wordLimit: mode === 'sentence' ? 40 : 300,
  register: 'neutral', targetVocabulary: [],
});
const writingRequest = (mode = 'sentence') => ({
  draftText: 'Yesterday I go home.', draftVersion: 'draft-1', contentVersion: 'content-1',
  locale: 'en', taskContext: writingContext(mode),
});
const writingResult = (band = null) => ({
  schema_version: 1, assessment_status: 'feedback_available', abstention_reason: null,
  task_relevance: 'on_topic', task_comment: 'You answered the question directly.',
  issues: [{ category: 'grammar', kind: 'error', quoted_text: 'go', occurrence: 1,
    replacement: 'went', explanation: 'Use the past form.' }],
  revision_actions: ['Change the verb to the past form.'],
  not_assessed: band === null ? ['ielts_band'] : [], ielts_band: band,
});
const conversationConfig = { mode: 'guided-dialogue', goal: 'Talk about breakfast.',
  openingPrompt: 'What do you eat for breakfast?', minimumTurns: 2, maximumTurns: 3,
  responseSeconds: 30, learnerLevel: 'beginner', targetVocabulary: ['bread'],
  questionConstraints: { maximumWords: 14, oneQuestionOnly: true, avoidAnswerDisclosure: true } };
const conversationRequest = () => ({ sessionVersion: 'session-1', turnVersion: 'turn-1', contentVersion: 'content-1',
  config: conversationConfig, currentQuestion: conversationConfig.openingPrompt, previousTurns: [], acceptedTurns: 0,
  transcript: { schemaVersion: 1, status: 'transcribed', text: 'I eat bread.', confidence: null, wordEvidence: [],
    providerIdentity: { provider: 'vosk', runtimeVersion: '0.3.45', modelId: null, modelDigest: null } } });
const conversationResult = () => ({ schemaVersion: 1, assessmentStatus: 'feedback_available', taskResponse: 'complete',
  feedback: 'Good answer. Use a full sentence.', nextQuestion: 'What do you drink with breakfast?',
  endConversation: false, notAssessed: ['ielts_band', 'pronunciation', 'fluency'] });

function clientReturning(output) {
  const calls = [];
  const client = new OpenAIStructuredTextClient({ model: 'gpt-5-nano', timeoutMs: 5000,
    client: { responses: { create: async (...args) => { calls.push(args); return {
      status: 'completed', output_text: JSON.stringify(output), model: 'gpt-5-nano',
      usage: { input_tokens: 50, output_tokens: 30, total_tokens: 80 },
    }; } } } });
  return { client, calls };
}

test('builds a bounded server-side Responses API request with strict structured output', async () => {
  const { client, calls } = clientReturning(writingResult());
  const provider = new OpenAIWritingFeedbackProvider({ client });
  const output = await provider.evaluate(writingRequest());
  assert.equal(output.result.issues[0].replacement, 'went');
  assert.equal(output.identity.provider, 'openai');
  assert.deepEqual(output.metrics, { durationMs: output.metrics.durationMs, inputTokens: 50, outputTokens: 30, totalTokens: 80 });
  const [body, options] = calls[0];
  assert.equal(body.model, 'gpt-5-nano');
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: 'minimal' });
  assert.equal(body.text.verbosity, 'low');
  assert.equal(body.text.format.type, 'json_schema');
  assert.equal(body.text.format.strict, true);
  assert.doesNotMatch(JSON.stringify(body.text.format.schema), /uniqueItems/u);
  assert.equal(body.tools, undefined);
  assert.equal(body.max_output_tokens, 700);
  assert.match(body.instructions, /student text.*data/iu);
  assert.equal(JSON.parse(body.input).draft_text, writingRequest().draftText);
  assert.equal(options.timeout, 5000);
});

test('keeps IELTS band estimates exclusive to full IELTS writing tasks', async () => {
  const micro = clientReturning(writingResult(6.5));
  await assert.rejects(new OpenAIWritingFeedbackProvider({ client: micro.client }).evaluate(writingRequest()),
    { code: 'WRITING_FEEDBACK_INVALID_RESULT' });
  const full = clientReturning(writingResult(6.5));
  const output = await new OpenAIWritingFeedbackProvider({ client: full.client }).evaluate(writingRequest('task2-essay'));
  assert.equal(output.result.ielts_band, 6.5);
});

test('uses transcript-only conversation context and keeps spoken text separate from UI feedback', async () => {
  const { client, calls } = clientReturning(conversationResult());
  const output = await new OpenAIConversationProvider({ client }).evaluate(conversationRequest());
  assert.equal(output.result.nextQuestion, 'What do you drink with breakfast?');
  assert.equal(output.result.feedback, 'Good answer. Use a full sentence.');
  const body = calls[0][0];
  assert.equal(body.max_output_tokens, 450);
  assert.equal(JSON.parse(body.input).current_answer.transcript_text, 'I eat bread.');
  assert.match(body.instructions, /cannot hear/iu);
});

test('maps malformed, rate-limited, timed-out and cancelled provider outcomes to safe feature errors', async () => {
  for (const [error, code] of [
    [{ status: 429 }, 'WRITING_FEEDBACK_RATE_LIMITED'],
    [new OpenAI.APIConnectionTimeoutError(), 'WRITING_FEEDBACK_TIMEOUT'],
    [Object.assign(new Error('secret'), { name: 'AbortError' }), 'WRITING_FEEDBACK_CANCELLED'],
  ]) {
    const client = new OpenAIStructuredTextClient({ model: 'gpt-5-nano', timeoutMs: 5000,
      client: { responses: { create: async () => { throw error; } } } });
    await assert.rejects(new OpenAIWritingFeedbackProvider({ client }).evaluate(writingRequest()),
      failure => failure.code === code && !failure.message.includes('secret'));
  }
  const malformed = clientReturning({ unexpected: true });
  await assert.rejects(new OpenAIWritingFeedbackProvider({ client: malformed.client }).evaluate(writingRequest()),
    { code: 'WRITING_FEEDBACK_INVALID_RESULT' });
});

test('does not call OpenAI when ASR reports insufficient speech evidence', async () => {
  const { client, calls } = clientReturning(conversationResult());
  const input = conversationRequest();
  input.transcript = { ...input.transcript, status: 'insufficient_evidence', text: '' };
  const output = await new OpenAIConversationProvider({ client }).evaluate(input);
  assert.equal(calls.length, 0);
  assert.equal(output.result.assessmentStatus, 'insufficient_evidence');
});
