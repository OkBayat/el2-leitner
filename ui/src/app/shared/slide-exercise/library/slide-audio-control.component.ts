import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	Output,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { ShortcutClickDirective } from '../../shortcut-click.directive';
import { runtimeApiUrl } from '../../../core/platform/runtime-platform.service';

@Component({
	selector: 'app-slide-audio-control',
	standalone: true,
	imports: [MatButtonModule, ShortcutClickDirective],
	template: `
		<div
			class="slide-audio-control"
			[class.slide-audio-control--speed]="speedControls"
		>
			<audio
				#audio
				[src]="resolveSource(src)"
				crossorigin="use-credentials"
				preload="metadata"
				[attr.aria-label]="audioLabel"
			></audio>
			@if (speedControls) {
				<div class="slide-audio-control__speed-actions">
					<button
						mat-flat-button
						appShortcutClick="Alt+R"
						class="vocora-audio-action vocora-audio-action--large"
						type="button"
						[disabled]="!canReplay()"
						[attr.aria-label]="playLabel"
						data-testid="slide-audio-play-normal"
						(click)="play(audio)"
					>
						<img src="/assets/icons/normal-speed.svg" alt="" aria-hidden="true" />
					</button>
					<button
						mat-flat-button
						class="vocora-audio-action"
						type="button"
						[disabled]="!canReplay()"
						[attr.aria-label]="slowPlayLabel"
						data-testid="slide-audio-play-slow"
						(click)="play(audio, 0.85)"
					>
						<img src="/assets/icons/slow-speed.svg" alt="" aria-hidden="true" />
					</button>
				</div>
			} @else {
				<button
					mat-stroked-button
					type="button"
					[disabled]="!canReplay()"
					[attr.aria-label]="playLabel"
					(click)="play(audio)"
				>
					{{ buttonLabel }}
				</button>
			}
			@if (maxReplays) {
				<span aria-live="polite"
					>{{ replayCount() }} of {{ maxReplays }} plays used</span
				>
			}
			@if (transcript) {
				<details>
					<summary>Transcript</summary>
					<p>{{ transcript }}</p>
				</details>
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.slide-audio-control {
				display: grid;
				justify-items: start;
				gap: var(--vocora-space-3);
			}
			.slide-audio-control--speed {
				width: 100%;
				justify-items: center;
			}
			.slide-audio-control__speed-actions {
				display: flex;
				align-items: flex-end;
				justify-content: center;
				gap: var(--vocora-space-5);
				padding-block: var(--vocora-space-4) var(--vocora-space-6);
			}
			.slide-audio-control__speed-actions img {
				width: 48%;
				height: 48%;
			}
			span {
				color: var(--vocora-text-secondary);
				font-size: 14px;
			}
			details p {
				margin-bottom: 0;
			}
		`,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideAudioControlComponent {
	readonly resolveSource = runtimeApiUrl;
	@Input({ required: true }) src = '';
	@Input() maxReplays?: number;
	@Input() transcript?: string;
	@Input() buttonLabel = 'Play audio';
	@Input() playLabel = 'Play audio stimulus';
	@Input() slowPlayLabel = 'Play audio stimulus slowly';
	@Input() audioLabel = 'Audio stimulus';
	@Input() speedControls = false;
	@Output() readonly replayCountChange = new EventEmitter<number>();
	readonly replayCount = signal(0);

	canReplay(): boolean {
		return !this.maxReplays || this.replayCount() < this.maxReplays;
	}

	play(audio: HTMLAudioElement, playbackRate = 1): void {
		if (!this.canReplay()) return;
		this.replayCount.update((count) => count + 1);
		this.replayCountChange.emit(this.replayCount());
		audio.currentTime = 0;
		audio.playbackRate = playbackRate;
		audio.preservesPitch = true;
		void audio.play().catch(() => {});
	}
}
