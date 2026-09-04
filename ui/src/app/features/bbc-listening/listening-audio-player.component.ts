import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  ListeningTest,
  buildListeningAudioProgress,
} from '../../domain/listening-practice/listening-practice';

@Component({
  selector: 'app-listening-audio-player',
  imports: [MatButtonModule],
  templateUrl: 'listening-audio-player.component.html',
  styleUrl: 'listening-audio-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListeningAudioPlayerComponent {
  readonly src = input.required<string>();
  readonly test = input.required<ListeningTest>();
  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly error = signal<string | null>(null);
  readonly progress = computed(() => buildListeningAudioProgress(
    this.test(),
    this.currentTime(),
    this.duration(),
  ));
  readonly progressPercent = computed(() => this.progress().progress * 100);

  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');

  async play(): Promise<void> {
    this.error.set(null);
    try {
      await this.audio().nativeElement.play();
    } catch {
      this.error.set('The episode audio could not be played.');
    }
  }

  async togglePlayback(): Promise<void> {
    const audio = this.audio().nativeElement;
    if (this.playing()) {
      audio.pause();
      this.syncState();
      return;
    }
    await this.play();
  }

  stop(): void {
    const audio = this.audio().nativeElement;
    audio.pause();
    audio.currentTime = 0;
    this.playing.set(false);
    this.currentTime.set(0);
  }

  skip(seconds: number): void {
    const audio = this.audio().nativeElement;
    this.seekTo(audio.currentTime + seconds);
  }

  seekTo(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    const audio = this.audio().nativeElement;
    const next = Math.max(0, seconds);
    audio.currentTime = Number.isFinite(audio.duration) ? Math.min(audio.duration, next) : next;
    this.currentTime.set(audio.currentTime);
  }

  onSeekInput(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    this.seekTo(target.valueAsNumber);
  }

  syncState(): void {
    const audio = this.audio().nativeElement;
    this.playing.set(!audio.paused && !audio.ended);
    this.currentTime.set(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    this.duration.set(Number.isFinite(audio.duration) ? audio.duration : 0);
  }

  onAudioError(): void {
    this.playing.set(false);
    this.error.set('The episode audio file is not available.');
  }

  formatTime(seconds: number): string {
    const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const minutes = Math.floor(safe / 60);
    const remainder = String(safe % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }
}
