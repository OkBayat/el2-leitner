import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShadowingSessionService } from './shadowing-session.service';
import { ShadowingApiService } from '../../core/shadowing-practice/shadowing-api.service';
import { PcmRecorderService, MicrophoneHandlers } from '../../core/shadowing-practice/pcm-recorder.service';
import { SpeechService } from '../../core/speech/speech.service';
import { ReviewAnswerSoundService } from '../../core/sound/review-answer-sound.service';
import { LearningStoreService } from '../../core/state/learning-store.service';
import { ThemeService } from '../../core/theme/theme.service';

const assessment = { leading: '', words: [{ text: 'Hello', after: '.', matched: false }], transcript: '', matchedCount: 0, totalCount: 1, score: 0, passed: false };
const result = { ...assessment, words: [{ text: 'Hello', after: '.', matched: true }], transcript: 'hello', matchedCount: 1, score: 100, passed: true,
  counts: { completedCount: 1, correctCount: 1, wrongCount: 0 }, daily: { day: '2026-09-05', attempts: 1, correct: 1, wrong: 0, newAdded: 0, sessions: 0, durationSeconds: 0 } };

describe('ShadowingSessionService', () => {
  let service: ShadowingSessionService;
  let handlers: MicrophoneHandlers;
  const microphone = { supported: () => true, open: vi.fn(), begin: vi.fn(), stop: vi.fn(), cancel: vi.fn() };
  const api = { start: vi.fn(), record: vi.fn(), chunk: vi.fn(), finish: vi.fn(), cancel: vi.fn(), close: vi.fn() };
  const speech = { speak: vi.fn(), cancel: vi.fn() };
  const sound = { play: vi.fn(), stop: vi.fn() };
  const state = { settings: { voiceRate: .85, theme: 'light' }, words: [{ id: 'untouched', box: 1 }], daily: {} };
  const store = { initialize: vi.fn(), snapshot: () => state, replaceLocal: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    microphone.open.mockResolvedValue(undefined); microphone.stop.mockResolvedValue(undefined);
    microphone.begin.mockImplementation(value => { handlers = value; });
    api.start.mockResolvedValue({ sessionId: 's', maxSeconds: 30, threshold: 90, cards: [{ id: 'w', term: 'hello', sentences: [{ ...assessment, id: 'sentence', text: 'Hello.' }] }] });
    api.record.mockResolvedValue({ recordingId: 'r' }); api.chunk.mockResolvedValue({ ...assessment, transcript: 'hello', matchedCount: 1, score: 100 });
    api.finish.mockResolvedValue(result); api.cancel.mockResolvedValue(undefined); api.close.mockResolvedValue(undefined);
    speech.speak.mockReturnValue(true); store.initialize.mockResolvedValue(state);
    TestBed.configureTestingModule({ providers: [ShadowingSessionService,
      { provide: ShadowingApiService, useValue: api }, { provide: PcmRecorderService, useValue: microphone },
      { provide: SpeechService, useValue: speech }, { provide: ReviewAnswerSoundService, useValue: sound },
      { provide: LearningStoreService, useValue: store }, { provide: ThemeService, useValue: { apply: vi.fn() } },
    ] });
    service = TestBed.inject(ShadowingSessionService);
  });
  afterEach(() => { service.dispose(); TestBed.resetTestingModule(); });

  it('plays the full sentence automatically but never starts the microphone automatically', async () => {
    await service.load();
    expect(speech.speak).toHaveBeenCalledWith('Hello.', .85);
    expect(microphone.open).not.toHaveBeenCalled();
    expect(service.phase()).toBe('ready');
  });
  it('shows partial recognition but grades only after stopping and ignores duplicate stop clicks', async () => {
    await service.load(); await service.record(); handlers.pcm(new ArrayBuffer(16000));
    await vi.waitFor(() => expect(service.assessment()?.matchedCount).toBe(1));
    expect(service.result()).toBeNull(); expect(sound.play).not.toHaveBeenCalled();
    await Promise.all([service.stop(), service.stop()]);
    expect(api.finish).toHaveBeenCalledTimes(1); expect(service.result()?.passed).toBe(true);
    expect(state.words).toEqual([{ id: 'untouched', box: 1 }]);
    expect(service.phase()).toBe('feedback');
  });
  it('does not mark denied permission as a wrong answer', async () => {
    await service.load(); microphone.open.mockRejectedValueOnce(new Error('Microphone permission denied.'));
    await service.record();
    expect(service.error()).toContain('permission'); expect(service.counts().wrongCount).toBe(0);
    expect(api.record).not.toHaveBeenCalled(); expect(service.phase()).toBe('ready');
  });
  it('ignores a late permission response after navigation', async () => {
    await service.load(); let grant!: () => void;
    microphone.open.mockImplementationOnce(() => new Promise<void>(resolve => { grant = resolve; }));
    const pending = service.record(); service.dispose(); grant(); await pending;
    expect(api.record).not.toHaveBeenCalled(); expect(microphone.cancel).toHaveBeenCalled();
  });
  it('retries evaluation with the same recording instead of starting another attempt', async () => {
    await service.load(); await service.record(); handlers.pcm(new ArrayBuffer(16000));
    api.finish.mockRejectedValueOnce(new Error('Connection lost.'));
    await service.stop(); expect(service.phase()).toBe('evaluation-error');
    await service.retryEvaluation();
    expect(api.record).toHaveBeenCalledTimes(1); expect(api.finish).toHaveBeenNthCalledWith(2, 's', 'r');
    expect(service.counts().completedCount).toBe(1);
  });
  it('clears old word highlights when the same sentence is retried', async () => {
    await service.load(); await service.record(); handlers.pcm(new ArrayBuffer(16000)); await service.stop();
    await service.record(); expect(service.result()).toBeNull(); expect(service.assessment()?.score).toBe(0);
  });
});
