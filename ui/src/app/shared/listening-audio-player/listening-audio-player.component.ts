import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  createAudioWaveformPaths,
  normalizedAudioEnergy,
  type AudioWaveformPaths,
} from './audio-waveform';

const PLAYER_SCROLL_HYSTERESIS = 24;
const PLAYER_TOP_SAFE_ZONE = 24;
const PLAYBACK_RATES = [1, 1.25, 1.5, 2] as const;

export type ListeningAudioPlayerMode = 'compact' | 'immersive';
type ListeningReaction = 'like' | 'dislike' | null;

@Component({
  selector: 'app-listening-audio-player',
  imports: [MatButtonModule],
  templateUrl: 'listening-audio-player.component.html',
  styleUrl: 'listening-audio-player.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListeningAudioPlayerComponent implements OnInit, OnDestroy {
  readonly src = input.required<string>();
  readonly title = input('Episode audio');
  readonly description = input('Sticky while scrolling');
  readonly collapseOnScroll = input(true);
  readonly mode = input<ListeningAudioPlayerMode>('compact');
  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly error = signal<string | null>(null);
  readonly collapsed = signal(false);
  readonly playbackRate = signal(1);
  readonly reaction = signal<ListeningReaction>(null);
  readonly waveformPaths = signal<AudioWaveformPaths>(createAudioWaveformPaths(0.18, 0));
  readonly progressPercent = computed(() => {
    const duration = this.duration();
    const currentTime = this.currentTime();
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return 0;
    return Math.min(100, Math.max(0, (currentTime / duration) * 100));
  });

  private readonly audio = viewChild.required<ElementRef<HTMLAudioElement>>('audio');
  private scrollAnchorY = 0;
  private audioContext: AudioContext | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserSamples: Uint8Array<ArrayBuffer> | null = null;
  private animationFrameId: number | null = null;
  private waveformPhase = 0;
  private waveformEnergy = 0.18;
  private previousFrameTime = 0;

  ngOnInit(): void {
    this.scrollAnchorY = Math.max(0, window.scrollY);
  }

  ngOnDestroy(): void {
    this.stopWaveformAnimation();
    this.mediaSource?.disconnect();
    this.analyser?.disconnect();
    if (this.audioContext) void this.audioContext.close();
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
      this.prepareAudioAnalysis();
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume().catch(() => undefined);
      }
      await this.audio().nativeElement.play();
      this.syncState();
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
    this.stopWaveformAnimation();
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
    const playing = !audio.paused && !audio.ended;
    this.playing.set(playing);
    this.currentTime.set(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    this.duration.set(Number.isFinite(audio.duration) ? audio.duration : 0);
    if (playing) this.startWaveformAnimation();
    else this.stopWaveformAnimation();
  }

  onAudioError(): void {
    this.playing.set(false);
    this.stopWaveformAnimation();
    this.error.set('The audio file is not available.');
  }

  cyclePlaybackRate(): void {
    const currentIndex = PLAYBACK_RATES.indexOf(this.playbackRate() as typeof PLAYBACK_RATES[number]);
    const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length];
    this.audio().nativeElement.playbackRate = nextRate;
    this.playbackRate.set(nextRate);
  }

  playbackRateLabel(): string {
    return `${this.playbackRate()}×`;
  }

  setReaction(reaction: Exclude<ListeningReaction, null>): void {
    this.reaction.update((current) => current === reaction ? null : reaction);
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

  private prepareAudioAnalysis(): void {
    if (this.mode() !== 'immersive' || this.analyser || typeof AudioContext === 'undefined') return;

    try {
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const mediaSource = context.createMediaElementSource(this.audio().nativeElement);
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      mediaSource.connect(analyser);
      analyser.connect(context.destination);
      this.audioContext = context;
      this.mediaSource = mediaSource;
      this.analyser = analyser;
      this.analyserSamples = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
    } catch {
      this.audioContext = null;
      this.mediaSource = null;
      this.analyser = null;
      this.analyserSamples = null;
    }
  }

  private startWaveformAnimation(): void {
    if (this.mode() !== 'immersive') return;
    this.prepareAudioAnalysis();
    if (!this.analyser || !this.analyserSamples || this.animationFrameId !== null) return;

    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.updateWaveform(0);
      return;
    }
    this.previousFrameTime = 0;
    this.animationFrameId = window.requestAnimationFrame(this.renderWaveformFrame);
  }

  private readonly renderWaveformFrame = (timestamp: number): void => {
    this.animationFrameId = null;
    if (!this.playing()) return;
    this.updateWaveform(timestamp);
    this.animationFrameId = window.requestAnimationFrame(this.renderWaveformFrame);
  };

  private updateWaveform(timestamp: number): void {
    if (!this.analyser || !this.analyserSamples) return;
    this.analyser.getByteTimeDomainData(this.analyserSamples);
    const elapsed = this.previousFrameTime === 0 ? 16 : Math.min(50, timestamp - this.previousFrameTime);
    this.previousFrameTime = timestamp;
    const sampledEnergy = normalizedAudioEnergy(this.analyserSamples);
    this.waveformEnergy += (sampledEnergy - this.waveformEnergy) * 0.28;
    this.waveformPhase += Math.max(0, elapsed) * (0.0028 + this.waveformEnergy * 0.0022);
    this.waveformPaths.set(createAudioWaveformPaths(this.waveformEnergy, this.waveformPhase));
  }

  private stopWaveformAnimation(): void {
    if (this.animationFrameId === null) return;
    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
    this.previousFrameTime = 0;
  }
}
