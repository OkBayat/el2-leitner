import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

const PLAYER_SCROLL_HYSTERESIS = 24;
const PLAYER_TOP_SAFE_ZONE = 24;

@Component({
  selector: 'app-listening-audio-player',
  imports: [MatButtonModule],
  templateUrl: 'listening-audio-player.component.html',
  styleUrl: 'listening-audio-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListeningAudioPlayerComponent implements OnInit {
  readonly src = input.required<string>();
  readonly title = input('Episode audio');
  readonly description = input('Sticky while scrolling');
  readonly collapseOnScroll = input(true);
  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly error = signal<string | null>(null);
  readonly collapsed = signal(false);
  readonly progressPercent = computed(() => {
    const duration = this.duration();
    const currentTime = this.currentTime();
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  });

  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  private scrollAnchorY = 0;

  ngOnInit(): void {
    this.scrollAnchorY = Math.max(0, window.scrollY);
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    if (!this.collapseOnScroll()) {
      this.setCollapsed(false);
      return;
    }
    const currentScrollY = Math.max(0, window.scrollY);

    if (currentScrollY <= PLAYER_TOP_SAFE_ZONE) {
      this.setCollapsed(false);
      this.scrollAnchorY = currentScrollY;
      return;
    }

    if (this.collapsed()) {
      if (currentScrollY > this.scrollAnchorY) {
        this.scrollAnchorY = currentScrollY;
        return;
      }

      if (this.scrollAnchorY - currentScrollY >= PLAYER_SCROLL_HYSTERESIS) {
        this.setCollapsed(false);
        this.scrollAnchorY = currentScrollY;
      }
      return;
    }

    if (currentScrollY < this.scrollAnchorY) {
      this.scrollAnchorY = currentScrollY;
      return;
    }

    if (currentScrollY - this.scrollAnchorY >= PLAYER_SCROLL_HYSTERESIS) {
      this.setCollapsed(true);
      this.scrollAnchorY = currentScrollY;
    }
  }

  async play(): Promise<void> {
    this.error.set(null);
    try {
      await this.audio().nativeElement.play();
    } catch {
      this.error.set('The audio could not be played.');
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
    this.error.set('The audio file is not available.');
  }

  formatTime(seconds: number): string {
    const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
    const minutes = Math.floor(safe / 60);
    const remainder = String(safe % 60).padStart(2, '0');
    return `${minutes}:${remainder}`;
  }

  private setCollapsed(value: boolean): void {
    if (this.collapsed() !== value) this.collapsed.set(value);
  }
}
