import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAudioPlayerComponent } from './listening-audio-player.component';

describe('ListeningAudioPlayerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/listening/bbc/lessons/example/audio');
    fixture.detectChanges();
    return fixture;
  }

  it('accepts reusable audio copy while preserving the supplied media source', () => {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/learning-paths/4/lessons/64/audio');
    fixture.componentRef.setInput('title', 'Lesson audio');
    fixture.componentRef.setInput('description', '');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('strong')?.textContent).toBe('Lesson audio');
    expect(element.querySelector('.sticky-hint')).toBeNull();
    expect(element.querySelector('audio')?.getAttribute('src')).toBe('/api/learning-paths/4/lessons/64/audio');
  });

  it('keeps controls visible when scroll collapsing is disabled by the host page', () => {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/learning-paths/4/lessons/64/audio');
    fixture.componentRef.setInput('collapseOnScroll', false);
    fixture.detectChanges();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    fixture.componentInstance.onWindowScroll();

    expect(fixture.componentInstance.collapsed()).toBe(false);
  });

  it('renders immersive controls and animates three waves from live audio energy', () => {
    const animationFrames: FrameRequestCallback[] = [];
    const analyser = {
      fftSize: 0,
      smoothingTimeConstant: 0,
      frequencyBinCount: 32,
      connect: vi.fn(),
      disconnect: vi.fn(),
      getByteTimeDomainData: vi.fn((samples: Uint8Array) => {
        samples.forEach((_value, index) => { samples[index] = index % 2 === 0 ? 64 : 192; });
      }),
    };
    const source = { connect: vi.fn(), disconnect: vi.fn() };
    const audioContext = {
      state: 'running',
      destination: {},
      createAnalyser: vi.fn(() => analyser),
      createMediaElementSource: vi.fn(() => source),
      resume: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    };
    vi.stubGlobal('AudioContext', vi.fn(function AudioContextMock() { return audioContext; }));
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    const cancelAnimationFrame = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);

    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/learning-paths/4/lessons/64/audio');
    fixture.componentRef.setInput('mode', 'immersive');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const initialPath = element.querySelector('[data-testid="audio-waveform"] path')?.getAttribute('d');
    const audio = element.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'paused', { configurable: true, value: false });
    fixture.componentInstance.syncState();
    expect(fixture.componentInstance.playing()).toBe(true);
    expect(audioContext.createAnalyser).toHaveBeenCalledTimes(1);
    expect(animationFrames.length).toBeGreaterThan(0);
    animationFrames.splice(0).forEach((frame) => frame(16));
    fixture.detectChanges();

    expect(element.querySelectorAll('[data-testid="audio-waveform"] path')).toHaveLength(3);
    expect(element.querySelector('[data-testid="audio-play"] .immersive-play-toggle__icon')).not.toBeNull();
    expect(analyser.getByteTimeDomainData).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[data-testid="audio-waveform"] path')?.getAttribute('d')).not.toBe(initialPath);

    Object.defineProperty(audio, 'paused', { configurable: true, value: true });
    fixture.componentInstance.syncState();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('cycles immersive playback speed and keeps one local reaction selected', () => {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/learning-paths/4/lessons/64/audio');
    fixture.componentRef.setInput('mode', 'immersive');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const audio = element.querySelector('audio') as HTMLAudioElement;
    element.querySelector<HTMLButtonElement>('[data-testid="audio-speed"]')?.click();
    fixture.detectChanges();
    expect(audio.playbackRate).toBe(1.25);
    expect(element.querySelector('[data-testid="audio-speed"]')?.textContent).toContain('1.25');

    const like = element.querySelector<HTMLButtonElement>('[data-testid="audio-like"]') as HTMLButtonElement;
    const dislike = element.querySelector<HTMLButtonElement>('[data-testid="audio-dislike"]') as HTMLButtonElement;
    like.click();
    fixture.detectChanges();
    expect(like.getAttribute('aria-pressed')).toBe('true');
    dislike.click();
    fixture.detectChanges();
    expect(like.getAttribute('aria-pressed')).toBe('false');
    expect(dislike.getAttribute('aria-pressed')).toBe('true');
  });

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

  it('renders a draggable audio scrubber without question-range progress UI', () => {
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
    expect(fixture.nativeElement.querySelector('[data-testid="audio-question-progress"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Now around:');

    scrubber.value = '18';
    scrubber.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(audio.currentTime).toBe(18);
    expect(fixture.componentInstance.currentTime()).toBe(18);
  });

  it('uses cumulative scroll hysteresis so slow scrolling does not flicker the player', () => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    const fixture = createFixture();
    const player = fixture.nativeElement.querySelector('[data-testid="listening-audio-player"]') as HTMLElement;

    for (let scrollY = 101; scrollY <= 123; scrollY += 1) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
      fixture.componentInstance.onWindowScroll();
      expect(fixture.componentInstance.collapsed()).toBe(false);
    }

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 124 });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(player.classList.contains('is-collapsed')).toBe(true);

    for (const scrollY of [125, 126, 125, 127, 126, 128, 127, 129]) {
      Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
      fixture.componentInstance.onWindowScroll();
      expect(fixture.componentInstance.collapsed()).toBe(true);
    }

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 105 });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(false);
    expect(player.classList.contains('is-collapsed')).toBe(false);
  });

  it('keeps the compact collapsed progress accurate without changing the player layout height', () => {
    const fixture = createFixture();
    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 100 });
    audio.currentTime = 42;
    fixture.componentInstance.syncState();
    fixture.detectChanges();

    const player = fixture.nativeElement.querySelector('[data-testid="listening-audio-player"]') as HTMLElement;
    const collapsedProgress = fixture.nativeElement.querySelector('[data-testid="audio-collapsed-progress"]') as HTMLElement;
    const initialHeight = player.getBoundingClientRect().height;

    expect(collapsedProgress.querySelector<HTMLElement>('.collapsed-progress-played')?.style.width).toBe('42%');

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();

    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(player.getBoundingClientRect().height).toBe(initialHeight);
  });
});
