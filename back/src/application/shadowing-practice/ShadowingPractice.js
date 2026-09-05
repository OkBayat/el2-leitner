import { randomUUID, createHash } from 'node:crypto';
import { AppError } from '../../domain/errors.js';
import { createSentenceMatcher } from '../../domain/sentence-practice/SentenceMatcher.js';
import { gradeShadowing } from '../../domain/shadowing-practice/ShadowingGrader.js';

const MAX_AUDIO_BYTES = 16000 * 2 * 30;
const SESSION_TTL = 30 * 60 * 1000;
const error = (status, code, message) => new AppError(status, `SHADOWING_${code}`, message);

/** Coordinates speech and practice only; never writes a Leitner/review aggregate. */
export class ShadowingPractice {
  constructor({ getSentencePracticeCards, sentencePracticeRepository, practiceSessionRepository, speech, now = Date.now }) {
    Object.assign(this, { getSentencePracticeCards, sentencePracticeRepository, practiceSessionRepository, speech, now });
    this.sessions = new Map();
    this.starting = new Set();
  }

  async start(userId) {
    this.sweep();
    if (this.starting.has(userId)) throw error(409, 'BUSY', 'A practice session is already starting.');
    if (this.sessions.size + this.starting.size >= 16) throw error(429, 'BUSY', 'Speech practice is busy. Please try again shortly.');
    this.starting.add(userId);
    try {
      const deck = await this.getSentencePracticeCards.execute(userId, 1);
      const cards = deck.cards.filter(card => Number(card.box) === 1).map(card => ({
        id: card.id, term: card.term,
        sentences: card.sentences.filter(sentence => sentence.text.length <= 2000 && (sentence.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) <= 60)
          .map(sentence => ({ id: sentence.id, text: sentence.text, category: sentence.category, ...gradeShadowing(sentence.text, '') })),
      })).filter(card => card.sentences.length);
      if (!cards.length) return { sessionId: null, cards, maxSeconds: 30, threshold: 90 };
      await this.speech.ready();
      for (const [id, session] of this.sessions) {
        if (session.userId === userId) await this.close(userId, id);
      }
      const persisted = await this.practiceSessionRepository.start(userId, { mode: 'shadowing-house-1', plannedCount: null });
      this.sessions.set(persisted.id, { userId, cards, started: this.now(), touched: this.now(), counts: { completedCount: 0, correctCount: 0, wrongCount: 0 }, recording: null, busy: false });
      return { sessionId: persisted.id, cards, maxSeconds: 30, threshold: 90 };
    } finally { this.starting.delete(userId); }
  }

  get(userId, sessionId) {
    this.sweep();
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) throw error(404, 'SESSION_EXPIRED', 'This practice session expired. Start a new session.');
    session.touched = this.now();
    return session;
  }

  async exclusive(session, action) {
    if (session.busy) throw error(409, 'BUSY', 'Please wait for the current speech request.');
    session.busy = true;
    const operation = Promise.resolve().then(action);
    session.operation = operation;
    try { return await operation; } finally { session.busy = false; session.operation = null; }
  }

  async record(userId, sessionId, { wordId, sentenceId, day } = {}) {
    const session = this.get(userId, sessionId);
    return this.exclusive(session, async () => {
      if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`)) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
        throw error(400, 'INVALID_REQUEST', 'A valid local practice day is required.');
      }
      const card = session.cards.find(item => item.id === wordId);
      const chosen = card?.sentences.find(item => item.id === sentenceId);
      if (!chosen) throw error(400, 'INVALID_SENTENCE', 'Choose a sentence from this practice session.');
      const rows = await this.sentencePracticeRepository.findWordsForHouse(userId, 1);
      const owned = rows.filter(row => row.wordId === wordId && Number(row.box) === 1);
      const active = (await this.sentencePracticeRepository.findActiveSentences('en')).find(item => item.id === sentenceId);
      const accepted = owned.map(row => row.acceptedForm || row.term);
      if (!owned.length || !active || active.text !== chosen.text || !createSentenceMatcher(accepted)(active.text)) {
        throw error(409, 'WORD_MOVED', 'This word or sentence is no longer available in Box 1. Start a new session.');
      }
      if (session.recording) await this.speech.cancel(session.recording.id);
      const id = randomUUID();
      await this.speech.start(id);
      // A close/navigation may occur while permission or a provider request is pending.
      if (this.sessions.get(sessionId) !== session) {
        await this.speech.cancel(id);
        throw error(404, 'SESSION_EXPIRED', 'This practice session has ended.');
      }
      session.recording = { id, reference: chosen.text, day, bytes: 0, sequence: 0, cached: null, result: null, assessment: null };
      return { recordingId: id };
    });
  }

  recording(session, id) {
    if (!session.recording || session.recording.id !== id) throw error(404, 'RECORDING_EXPIRED', 'This recording expired. Please record again.');
    return session.recording;
  }

  async chunk(userId, sessionId, id, sequence, pcm) {
    const session = this.get(userId, sessionId);
    return this.exclusive(session, async () => {
      const recording = this.recording(session, id);
      if (!Buffer.isBuffer(pcm) || !pcm.length || pcm.length % 2 || pcm.length > 32000 || !Number.isSafeInteger(sequence) || sequence < 0) {
        throw error(400, 'INVALID_AUDIO', 'Expected a bounded 16 kHz mono PCM audio chunk.');
      }
      const hash = createHash('sha256').update(pcm).digest('hex');
      if (recording.cached?.sequence === sequence && recording.cached.hash === hash) return recording.cached.value;
      if (recording.assessment || recording.result || sequence !== recording.sequence) throw error(409, 'AUDIO_ORDER', 'Audio arrived out of order. Please record again.');
      if (recording.bytes + pcm.length > MAX_AUDIO_BYTES) throw error(413, 'AUDIO_LIMIT', 'Recordings must not exceed 30 seconds.');
      const transcript = await this.speech.chunk(id, sequence, pcm);
      if (this.sessions.get(sessionId) !== session || session.recording !== recording) throw error(404, 'RECORDING_EXPIRED', 'This recording has ended.');
      const value = gradeShadowing(recording.reference, transcript);
      recording.bytes += pcm.length;
      recording.sequence++;
      recording.cached = { sequence, hash, value };
      return value;
    });
  }

  async finish(userId, sessionId, id) {
    const session = this.get(userId, sessionId);
    return this.exclusive(session, async () => {
      const recording = this.recording(session, id);
      if (recording.result) return recording.result;
      if (!recording.assessment) {
        const transcript = await this.speech.finish(id);
        if (recording.bytes < 8000 || !transcript.trim()) throw error(422, 'NO_SPEECH', 'No clear speech was detected. Please try recording again.');
        if (this.sessions.get(sessionId) !== session || session.recording !== recording) throw error(404, 'RECORDING_EXPIRED', 'This recording has ended.');
        recording.assessment = gradeShadowing(recording.reference, transcript);
        void this.speech.cancel(id).catch(() => {});
      }
      const { daily } = await this.practiceSessionRepository.recordAttempt(userId, sessionId, {
        day: recording.day, correct: recording.assessment.passed,
      });
      session.counts.completedCount++;
      session.counts[recording.assessment.passed ? 'correctCount' : 'wrongCount']++;
      recording.result = { ...recording.assessment, daily, counts: { ...session.counts } };
      return recording.result;
    });
  }

  async cancel(userId, sessionId, id) {
    const session = this.get(userId, sessionId);
    const recording = this.recording(session, id);
    session.recording = null;
    await this.speech.cancel(recording.id);
  }

  async close(userId, sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.userId !== userId) return;
    this.sessions.delete(sessionId);
    if (session.operation) await session.operation.catch(() => {});
    if (session.recording) await this.speech.cancel(session.recording.id);
    await this.practiceSessionRepository.complete(userId, sessionId, {
      ...session.counts, durationSeconds: Math.max(0, Math.round((this.now() - session.started) / 1000)),
    });
  }

  sweep() {
    for (const [id, session] of this.sessions) {
      if (!session.busy && this.now() - session.touched > SESSION_TTL) void this.close(session.userId, id).catch(() => {});
    }
  }
}
