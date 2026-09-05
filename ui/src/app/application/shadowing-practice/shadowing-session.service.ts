import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiError } from '../../core/http/api-client.service';
import { PcmRecorderService } from '../../core/shadowing-practice/pcm-recorder.service';
import { ShadowingApiService } from '../../core/shadowing-practice/shadowing-api.service';
import { SpeechService } from '../../core/speech/speech.service';
import { ReviewAnswerSoundService } from '../../core/sound/review-answer-sound.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';
import { localDay } from '../../domain/learning/learning-rules';
import { ShadowingAssessment, ShadowingCounts, ShadowingPrompt, ShadowingQueue, ShadowingResult } from '../../domain/shadowing-practice/shadowing';

type Phase = 'loading' | 'load-error' | 'empty' | 'ready' | 'requesting' | 'recording' | 'processing' | 'evaluation-error' | 'feedback' | 'complete';

@Injectable()
export class ShadowingSessionService {
  private readonly api = inject(ShadowingApiService);
  private readonly microphone = inject(PcmRecorderService);
  private readonly speech = inject(SpeechService);
  private readonly sound = inject(ReviewAnswerSoundService);
  private readonly store = inject(LearningStoreService);
  private readonly theme = inject(ThemeService);
  readonly phase = signal<Phase>('loading');
  readonly prompt = signal<ShadowingPrompt | null>(null);
  readonly assessment = signal<ShadowingAssessment | null>(null);
  readonly result = signal<ShadowingResult | null>(null);
  readonly error = signal('');
  readonly errorCode = signal('');
  readonly audioNotice = signal('');
  readonly levels = signal<number[]>(Array(28).fill(4));
  readonly seconds = signal(0);
  readonly counts = signal<ShadowingCounts>({ completedCount: 0, correctCount: 0, wrongCount: 0 });
  readonly supported = this.microphone.supported();
  readonly busy = computed(() => ['requesting', 'recording', 'processing'].includes(this.phase()));
  readonly missingWords = computed(() => this.result()?.words.filter(word => !word.matched).map(word => word.text).join(', ') ?? '');
  readonly accuracy = computed(() => this.counts().completedCount ? Math.round(100 * this.counts().correctCount / this.counts().completedCount) : null);
  private sessionId: string | null = null;
  private recordingId: string | null = null;
  private queue?: ShadowingQueue;
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  private queued = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private lastVoice = 0;
  private heardVoice = false;

  async load(): Promise<void> {
    this.dispose();
    const generation = this.generation;
    this.phase.set('loading'); this.error.set(''); this.errorCode.set('');
    this.prompt.set(null); this.result.set(null); this.assessment.set(null);
    this.counts.set({ completedCount: 0, correctCount: 0, wrongCount: 0 });
    try {
      const state = await this.store.initialize();
      if (generation !== this.generation) return;
      this.theme.apply(state.settings.theme);
      const deck = await this.api.start();
      if (generation !== this.generation) { if (deck.sessionId) void this.api.close(deck.sessionId).catch(() => {}); return; }
      this.sessionId = deck.sessionId;
      this.queue = new ShadowingQueue(deck.cards);
      if (!deck.sessionId || !deck.cards.length) { this.phase.set('empty'); return; }
      this.next();
    } catch (error) {
      if (generation !== this.generation) return;
      this.showError(error); this.phase.set('load-error');
    }
  }

  listen(multiplier = 1): void {
    const prompt = this.prompt();
    if (!prompt || this.busy()) return;
    this.sound.stop();
    const available = this.speech.speak(prompt.sentence.text, this.store.snapshot().settings.voiceRate * multiplier);
    this.audioNotice.set(available ? '' : 'Sentence playback is not available in this browser.');
  }

  next(): void {
    if (this.busy()) return;
    this.pause();
    const prompt = this.queue?.next() ?? null;
    this.prompt.set(prompt); this.result.set(null); this.assessment.set(prompt?.sentence ?? null);
    this.error.set(''); this.errorCode.set(''); this.seconds.set(0); this.levels.set(Array(28).fill(4));
    this.phase.set(prompt ? 'ready' : 'empty');
    this.listen();
  }

  async record(): Promise<void> {
    if (!['ready', 'feedback', 'evaluation-error'].includes(this.phase()) || !this.sessionId || !this.prompt()) return;
    this.pause();
    const generation = this.generation;
    const sessionId = this.sessionId;
    const prompt = this.prompt()!;
    this.phase.set('requesting'); this.result.set(null); this.assessment.set(prompt.sentence);
    this.error.set(''); this.errorCode.set(''); this.seconds.set(0); this.levels.set(Array(28).fill(4));
    this.pending = Promise.resolve(); this.queued = 0; this.heardVoice = false;
    try {
      await this.microphone.open();
      if (generation !== this.generation) return;
      const { recordingId } = await this.api.record(sessionId, prompt.card.id, prompt.sentence.id, localDay());
      if (generation !== this.generation) { void this.api.cancel(sessionId, recordingId).catch(() => {}); return; }
      this.recordingId = recordingId;
      this.phase.set('recording'); this.lastVoice = Date.now();
      let sequence = 0;
      let bytes = 0;
      this.microphone.begin({
        pcm: pcm => {
          if (generation !== this.generation) return;
          bytes += pcm.byteLength; this.seconds.set(Math.min(30, bytes / 32000));
          if (++this.queued > 8) { this.fail(new Error('The connection is too slow for live speech. Please try again.'), generation); return; }
          const index = sequence++;
          this.pending = this.pending.then(async () => {
            if (generation !== this.generation) return;
            const result = await this.api.chunk(sessionId, recordingId, index, pcm);
            if (generation === this.generation) { this.queued--; this.assessment.set(result); }
          }).catch(error => this.fail(error, generation));
        },
        level: rms => {
          if (generation !== this.generation || this.phase() !== 'recording') return;
          this.levels.update(levels => [...levels.slice(1), Math.max(4, Math.min(32, rms * 220))]);
          if (rms > 0.012) { this.lastVoice = Date.now(); this.heardVoice = true; }
          if (this.heardVoice && this.seconds() > 1 && Date.now() - this.lastVoice > 2200) void this.stop();
        },
        limit: () => { if (generation === this.generation) void this.stop(); },
        error: message => this.fail(new Error(message), generation),
      });
      this.timer = setTimeout(() => { if (generation === this.generation) void this.stop(); }, 31000);
    } catch (error) { this.fail(error, generation); }
  }

  async stop(): Promise<void> {
    if (this.phase() !== 'recording') return;
    const generation = this.generation;
    this.phase.set('processing'); clearTimeout(this.timer);
    try {
      await this.microphone.stop();
      await this.pending;
      if (generation !== this.generation) return;
      await this.evaluate(generation);
    } catch (error) { this.fail(error, generation); }
  }

  async retryEvaluation(): Promise<void> {
    if (this.phase() !== 'evaluation-error') return;
    this.phase.set('processing'); this.error.set('');
    await this.evaluate(this.generation);
  }

  private async evaluate(generation: number): Promise<void> {
    if (!this.sessionId || !this.recordingId) return;
    try {
      const result = await this.api.finish(this.sessionId, this.recordingId);
      if (generation !== this.generation) return;
      this.assessment.set(result); this.result.set(result); this.counts.set(result.counts);
      const state = this.store.snapshot();
      const { day, ...daily } = result.daily;
      state.daily[day] = daily;
      this.store.replaceLocal(state);
      this.phase.set('feedback'); this.error.set('');
      this.sound.play(result.passed ? 'correct' : 'incorrect');
    } catch (error) {
      if (generation !== this.generation) return;
      if (error instanceof ApiError && [400, 404, 409, 422].includes(error.status)) { this.fail(error, generation); return; }
      // Keep the recording ID so a lost response can be retried without counting twice.
      this.showError(error); this.phase.set('evaluation-error');
    }
  }

  pause(): void {
    this.generation++;
    clearTimeout(this.timer);
    this.microphone.cancel(); this.speech.cancel(); this.sound.stop();
    const id = this.recordingId;
    this.recordingId = null;
    if (id && this.sessionId) void this.api.cancel(this.sessionId, id).catch(() => {});
    if (this.busy() || this.phase() === 'evaluation-error') {
      this.assessment.set(this.prompt()?.sentence ?? null);
      this.levels.set(Array(28).fill(4));
      this.phase.set('ready');
    }
  }

  private fail(error: unknown, generation: number): void {
    if (generation !== this.generation) return;
    this.pause(); this.result.set(null); this.assessment.set(this.prompt()?.sentence ?? null);
    this.showError(error); this.phase.set('ready');
  }
  private showError(error: unknown): void {
    this.error.set(error instanceof Error ? error.message : 'Speech practice could not continue. Please try again.');
    this.errorCode.set(error instanceof ApiError ? error.code : '');
  }

  async complete(): Promise<void> {
    this.pause();
    const id = this.sessionId;
    this.sessionId = null;
    if (id) {
      try { await this.api.close(id); } catch (error) { this.showError(error); }
    }
    this.phase.set('complete');
  }

  dispose(): void {
    this.pause();
    const id = this.sessionId;
    this.sessionId = null;
    if (id) void this.api.close(id).catch(() => {});
  }
}
