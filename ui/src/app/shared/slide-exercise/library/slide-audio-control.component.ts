import {
	ChangeDetectionStrategy,
	Component,
	EventEmitter,
	Input,
	Output,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';

@Component({
	selector: 'app-slide-audio-control',
	standalone: true,
	imports: [MatButtonModule],
	template: `
		<div class="slide-audio-control">
			<audio
				#audio
				[src]="src"
				preload="metadata"
				[attr.aria-label]="audioLabel"
			></audio>
			<button
				mat-stroked-button
				type="button"
				[disabled]="!canReplay()"
				[attr.aria-label]="playLabel"
				(click)="play(audio)"
			>
				{{ buttonLabel }}
			</button>
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
	@Input({ required: true }) src = '';
	@Input() maxReplays?: number;
	@Input() transcript?: string;
	@Input() buttonLabel = 'Play audio';
	@Input() playLabel = 'Play audio stimulus';
	@Input() audioLabel = 'Audio stimulus';
	@Output() readonly replayCountChange = new EventEmitter<number>();
	readonly replayCount = signal(0);

	canReplay(): boolean {
		return !this.maxReplays || this.replayCount() < this.maxReplays;
	}

	play(audio: HTMLAudioElement): void {
		if (!this.canReplay()) return;
		this.replayCount.update((count) => count + 1);
		this.replayCountChange.emit(this.replayCount());
		audio.currentTime = 0;
		void audio.play().catch(() => {});
	}
}
