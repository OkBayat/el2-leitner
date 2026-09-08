import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import type { DialogueStimulusTurn } from './slide-library.models';

@Component({
	selector: 'app-slide-dialogue-control',
	standalone: true,
	imports: [MatButtonModule],
	template: `
		<div class="slide-dialogue-control">
			<button
				mat-stroked-button
				type="button"
				[disabled]="playing() || !canReplay()"
				(click)="play()"
			>
				{{ playing() ? 'Playing dialogue' : 'Play dialogue' }}
			</button>
			@if (currentSpeaker()) {
				<span aria-live="polite"
					>Now speaking: {{ currentSpeaker() }}</span
				>
			}
			@if (maxReplays) {
				<span>{{ replayCount() }} of {{ maxReplays }} plays used</span>
			}
		</div>
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.slide-dialogue-control {
				display: grid;
				justify-items: start;
				gap: var(--vocora-space-3);
			}
			span {
				color: var(--vocora-text-secondary);
				font-size: 14px;
			}
		`,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideDialogueControlComponent implements OnDestroy {
	private readonly speech = inject(SpeechService);
	private readonly store = inject(LearningStoreService);
	private nextTurnTimer?: ReturnType<typeof setTimeout>;

	@Input({ required: true }) turns: readonly DialogueStimulusTurn[] = [];
	@Input() maxReplays?: number;
	readonly replayCount = signal(0);
	readonly playing = signal(false);
	readonly currentSpeaker = signal('');

	canReplay(): boolean {
		return !this.maxReplays || this.replayCount() < this.maxReplays;
	}

	play(): void {
		if (this.playing() || !this.canReplay() || !this.turns.length) return;
		this.replayCount.update((count) => count + 1);
		this.playing.set(true);
		this.playTurn(0);
	}

	ngOnDestroy(): void {
		this.stop();
	}

	private playTurn(index: number): void {
		const turn = this.turns[index];
		if (!turn) {
			this.playing.set(false);
			this.currentSpeaker.set('');
			return;
		}
		this.currentSpeaker.set(turn.speaker);
		const rate = this.store.state()?.settings.voiceRate ?? 0.85;
		const started = this.speech.speak(
			turn.text,
			rate,
			{
				onEnd: () => {
					this.nextTurnTimer = setTimeout(
						() => this.playTurn(index + 1),
						250,
					);
				},
			},
			turn.voiceIndex ?? index,
		);
		if (!started) this.stop();
	}

	private stop(): void {
		if (this.nextTurnTimer) clearTimeout(this.nextTurnTimer);
		this.nextTurnTimer = undefined;
		this.speech.cancel();
		this.playing.set(false);
		this.currentSpeaker.set('');
	}
}
