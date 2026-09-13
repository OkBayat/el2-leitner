import { randomUUID } from 'node:crypto';
import { AiEvaluationWorker } from '../../application/ai-evaluation/AiEvaluationWorker.js';
import { MySqlAiEvaluationQueue } from '../../infrastructure/persistence/mysql/ai-evaluation/MySqlAiEvaluationQueue.js';
import { OpenAIStructuredTextClient } from '../../infrastructure/ai/OpenAIStructuredTextClient.js';
import { createWritingFeedbackModule } from '../writing-feedback/createWritingFeedbackModule.js';
import { createConversationModule } from '../adaptive-conversation/createConversationModule.js';

/** One durable queue and one bounded OpenAI client serve both educational capabilities. */
export function createAiEvaluationModule({ pool, config, synthesizeSpeech, adapters = {}, logger = console }) {
  const writing = config.writingFeedback ?? {};
  const writingEnabled = writing.enabled === true;
  const conversationEnabled = config.adaptiveConversation?.enabled === true;
  const needsClient = (writingEnabled && !adapters.writingFeedbackProvider) || (conversationEnabled && !adapters.conversationProvider);
  const sharedClient = needsClient ? adapters.aiStructuredTextClient ?? new OpenAIStructuredTextClient({
    apiKey: writing.apiKey, model: writing.model, timeoutMs: writing.timeoutMs,
  }) : null;
  let worker;
  const writingFeedback = createWritingFeedbackModule({ pool, config: writing, adapters, logger, sharedClient, createWorker: false, cancelWork: (id) => worker.cancel(id, 'writing-feedback') });
  const adaptiveConversation = createConversationModule({ pool, config, adapters, sharedClient, synthesizeSpeech, logger,
    cancelWork: (id) => worker.cancel(id, 'adaptive-conversation'), cancelSessionWork: (id) => worker.cancelSession(id),
  });
  worker = new AiEvaluationWorker({ repository: adapters.aiEvaluationQueue ?? new MySqlAiEvaluationQueue(pool),
    handlers: { 'writing-feedback': writingFeedback.handler, 'adaptive-conversation': adaptiveConversation.handler },
    clock: adapters.aiEvaluationClock ?? (() => new Date()), idFactory: adapters.aiEvaluationIdFactory ?? randomUUID,
    timeoutMs: writing.timeoutMs, pollIntervalMs: writingEnabled || conversationEnabled ? 250 : 60000, logger,
  });
  writingFeedback.worker = worker;
  return { worker, writingFeedback, adaptiveConversation };
}
