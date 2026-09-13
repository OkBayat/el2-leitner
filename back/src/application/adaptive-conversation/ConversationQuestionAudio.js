import { AppError } from '../../domain/errors.js';
import { createReadStream } from 'node:fs';
import { requireConversationTurn } from './conversationState.js';

/** Authorizes a conversation turn, then reuses the canonical Kokoro cache. */
export class ConversationQuestionAudio {
  constructor({ sessions, synthesizeSpeech, options, logger = console }) {
    Object.assign(this, { sessions, synthesizeSpeech, options, logger });
    this.active = new Map();
    this.stopping = false;
  }
  async generate(userId, sessionId, turnId, { signal } = {}) {
    this.sessions.requireEnabled();
    if (this.stopping) throw new AppError(503, "CONVERSATION_UNAVAILABLE", "Question audio is restarting. Try again shortly.");
    if (signal?.aborted) throw new AppError(499, 'CONVERSATION_CANCELLED', 'Audio request was cancelled.');
    if (this.active.has(String(userId)) || this.active.size >= 2) throw new AppError(429, 'CONVERSATION_AUDIO_BUSY', 'Question audio is busy. Try again shortly.');
    const controller = new AbortController();
    const entry = { sessionId, controller, stream: null };
    controller.signal.addEventListener('abort', () => entry.stream?.destroy(), { once: true });
    this.active.set(String(userId), entry);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const release = () => {
      signal?.removeEventListener('abort', abort);
      if (this.active.get(String(userId)) === entry) this.active.delete(String(userId));
    };
    try {
      const startedAt = performance.now();
      const session = await this.sessions.owned(userId, sessionId);
      if (controller.signal.aborted || this.stopping) throw new AppError(499, 'CONVERSATION_CANCELLED', 'Audio request was cancelled.');
      const turn = requireConversationTurn(session, turnId);
      const audio = await this.synthesizeSpeech.execute({
        text: turn.question, format: 'mp3', language: 'en-us',
        voice: this.options.defaultVoice, speed: this.options.defaultSpeed,
      });
      this.logger.info?.({ event: 'speaking_tts_ready', feature: 'speaking',
        exerciseId: session.exerciseId ?? null, durationMs: Math.round(performance.now() - startedAt),
        cacheStatus: audio.cacheStatus });
      if (controller.signal.aborted || this.stopping) throw new AppError(499, 'CONVERSATION_CANCELLED', 'Audio request was cancelled.');
      const stream = createReadStream(audio.filePath);
      entry.stream = stream;
      stream.once('close', release);
      // A consumed stream may end without autoDestroy on injected ports.
      stream.once('end', release);
      if (controller.signal.aborted) { stream.destroy(); throw new AppError(499, 'CONVERSATION_CANCELLED', 'Audio request was cancelled.'); }
      return stream;
    } catch (error) { release(); throw error; }
  }
  cancelSession(sessionId) { for (const entry of this.active.values()) if (entry.sessionId === sessionId) entry.controller.abort(); }
  stop() { this.stopping = true; for (const entry of this.active.values()) entry.controller.abort(); }
}
