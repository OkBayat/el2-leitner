import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListeningAudioPlayerComponent } from './listening-audio-player.component';

describe('ListeningAudioPlayerComponent', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('does not autoplay and supports play, stop, and five-second seeking', async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(ListeningAudioPlayerComponent);
    fixture.componentRef.setInput('src', '/api/listening/bbc/lessons/example/audio');
    fixture.detectChanges();

    const audio = fixture.nativeElement.querySelector('audio') as HTMLAudioElement;
    expect(audio.autoplay).toBe(false);
    expect(audio.getAttribute('preload')).toBe('metadata');
    expect(play).not.toHaveBeenCalled();

    Object.defineProperty(audio, 'duration', { configurable: true, value: 30 });
    audio.currentTime = 10;
    fixture.componentInstance.skip(-5);
    expect(audio.currentTime).toBe(5);
    fixture.componentInstance.skip(5);
    expect(audio.currentTime).toBe(10);

    await fixture.componentInstance.play();
    expect(play).toHaveBeenCalledTimes(1);

    fixture.componentInstance.stop();
    expect(pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
  });
});
