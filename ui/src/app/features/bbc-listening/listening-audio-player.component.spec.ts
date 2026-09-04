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

  it('collapses on downward scroll, leaves only played progress, and expands on upward scroll', () => {
    const fixture = createFixture();
    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    Object.defineProperty(audio, 'duration', { configurable: true, value: 100 });
    audio.currentTime = 42;
    fixture.componentInstance.syncState();
    fixture.detectChanges();

    const player = fixture.nativeElement.querySelector('[data-testid="listening-audio-player"]') as HTMLElement;
    const collapsedProgress = fixture.nativeElement.querySelector('[data-testid="audio-collapsed-progress"]') as HTMLElement;
    expect(player.classList.contains('is-collapsed')).toBe(false);
    expect(collapsedProgress).not.toBeNull();
    expect(collapsedProgress.querySelector<HTMLElement>('.collapsed-progress-played')?.style.width).toBe('42%');

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 120 });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(true);
    expect(player.classList.contains('is-collapsed')).toBe(true);

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 80 });
    fixture.componentInstance.onWindowScroll();
    fixture.detectChanges();
    expect(fixture.componentInstance.collapsed()).toBe(false);
    expect(player.classList.contains('is-collapsed')).toBe(false);
  });
});
