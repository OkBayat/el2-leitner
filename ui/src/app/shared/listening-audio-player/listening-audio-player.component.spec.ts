import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAudioPlayerComponent } from './listening-audio-player.component';

describe('ListeningAudioPlayerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
  });

  function createFixture() {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/listening/bbc/lessons/example/audio');
    fixture.detectChanges();
    return fixture;
  }

  it('accepts reusable audio copy while preserving the supplied media source', () => {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/data/learning-path-podcasts/gfi-unit-01.m4a');
    fixture.componentRef.setInput('title', 'Lesson audio');
    fixture.componentRef.setInput('description', '');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('strong')?.textContent).toBe('Lesson audio');
    expect(element.querySelector('.sticky-hint')).toBeNull();
    expect(element.querySelector('audio')?.getAttribute('src')).toBe('/data/learning-path-podcasts/gfi-unit-01.m4a');
  });

  it('keeps controls visible when scroll collapsing is disabled by the host page', () => {
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/data/learning-path-podcasts/gfi-unit-01.m4a');
    fixture.componentRef.setInput('collapseOnScroll', false);
    fixture.detectChanges();

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    fixture.componentInstance.onWindowScroll();

    expect(fixture.componentInstance.collapsed()).toBe(false);
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
