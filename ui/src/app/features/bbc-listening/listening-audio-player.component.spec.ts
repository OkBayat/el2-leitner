import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningTest } from '../../domain/listening-practice/listening-practice';
import { ListeningAudioPlayerComponent } from './listening-audio-player.component';

const test: ListeningTest = {
  id: 'test-1',
  title: 'Test 1',
  position: 1,
  questionCount: 13,
  groups: [
    {
      id: 'group-1',
      position: 1,
      heading: 'Questions 1–4',
      taskType: 'note_completion',
      instruction: 'Complete the notes.',
      answerInstruction: 'Write one word.',
      maxWords: 1,
      maxNumbers: 0,
      questions: [1, 2, 3, 4].map((number) => ({
        id: `q${number}`,
        number,
        position: number,
        responseType: 'text' as const,
        prompt: `Question ${number} {{blank}}.`,
      })),
    },
    {
      id: 'group-2',
      position: 2,
      heading: 'Questions 5–7',
      taskType: 'sentence_completion',
      instruction: 'Complete the sentences.',
      answerInstruction: 'Write one word.',
      maxWords: 1,
      maxNumbers: 0,
      questions: [5, 6, 7].map((number) => ({
        id: `q${number}`,
        number,
        position: number,
        responseType: 'text' as const,
        prompt: `Question ${number} {{blank}}.`,
      })),
    },
    {
      id: 'group-3',
      position: 3,
      heading: 'Questions 8–10',
      taskType: 'short_answer',
      instruction: 'Answer the questions.',
      answerInstruction: 'Write up to three words.',
      maxWords: 3,
      maxNumbers: 0,
      questions: [8, 9, 10].map((number) => ({
        id: `q${number}`,
        number,
        position: number,
        responseType: 'text' as const,
        prompt: `Question ${number} {{blank}}.`,
      })),
    },
    {
      id: 'group-4',
      position: 4,
      heading: 'Questions 11–13',
      taskType: 'short_answer',
      instruction: 'Answer the questions.',
      answerInstruction: 'Write up to three words.',
      maxWords: 3,
      maxNumbers: 0,
      questions: [11, 12, 13].map((number) => ({
        id: `q${number}`,
        number,
        position: number,
        responseType: 'text' as const,
        prompt: `Question ${number} {{blank}}.`,
      })),
    },
  ],
};

describe('ListeningAudioPlayerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/listening/bbc/lessons/example/audio');
    fixture.componentRef.setInput('test', test);
    fixture.detectChanges();
    return fixture;
  }

  it('does not autoplay and supports play, pause, stop, five-second skips, and direct seeking', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const fixture = createFixture();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    expect(audio.autoplay).toBe(false);
    expect(audio.getAttribute('preload')).toBe('metadata');
    expect(play).not.toHaveBeenCalled();

    Object.defineProperty(audio, 'duration', { configurable: true, value: 30 });
    audio.currentTime = 10;
    fixture.componentInstance.syncState();

    fixture.componentInstance.skip(-5);
    expect(audio.currentTime).toBe(5);
    fixture.componentInstance.skip(5);
    expect(audio.currentTime).toBe(10);

    fixture.componentInstance.seekTo(22.5);
    expect(audio.currentTime).toBe(22.5);
    expect(fixture.componentInstance.currentTime()).toBe(22.5);

    await fixture.componentInstance.togglePlayback();
    expect(play).toHaveBeenCalledTimes(1);

    fixture.componentInstance.playing.set(true);
    await fixture.componentInstance.togglePlayback();
    expect(pause).toHaveBeenCalledTimes(1);

    fixture.componentInstance.stop();
    expect(pause).toHaveBeenCalledTimes(2);
    expect(audio.currentTime).toBe(0);
  });

  it('renders a draggable audio scrubber and keeps the approximate question range synchronized', () => {
    const fixture = createFixture();
    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 30 });
    audio.currentTime = 12;
    fixture.componentInstance.syncState();
    fixture.detectChanges();

    const scrubber = fixture.nativeElement.querySelector('[data-testid="audio-progress"]') as HTMLInputElement;
    expect(scrubber.type).toBe('range');
    expect(scrubber.max).toBe('30');
    expect(scrubber.valueAsNumber).toBe(12);

    const questionProgress = fixture.nativeElement.querySelector('[data-testid="audio-question-progress"]') as HTMLElement;
    expect(questionProgress.textContent).toContain('Now around: Questions 5–7');
    expect(questionProgress.textContent).toContain('Q1–4');
    expect(questionProgress.textContent).toContain('Q5–7');
    expect(questionProgress.textContent).toContain('Q8–10');
    expect(questionProgress.textContent).toContain('Q11–13');

    const active = fixture.nativeElement.querySelector('.question-segment.active') as HTMLElement;
    expect(active.getAttribute('data-testid')).toBe('audio-question-segment-group-2');

    scrubber.value = '18';
    scrubber.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(audio.currentTime).toBe(18);
    expect(fixture.componentInstance.currentTime()).toBe(18);
  });
});
