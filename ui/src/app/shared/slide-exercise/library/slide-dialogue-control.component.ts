import {
	ChangeDetectionStrategy,
	Component,
	Input,
	OnDestroy,
	inject,
	signal,
} from '@angular/core';
import { VocoSecondaryButtonComponent } from '../../voco-button';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import type { DialogueStimulusTurn } from './slide-library.models';

@Component({
	selector: 'app-slide-dialogue-control',
	standalone: true,
	imports: [VocoSecondaryButtonComponent],
	template: `
		<div class="slide-dialogue-control">
			<voco-secondary-button
				type="button"
				[disabled]="playing() || !canReplay()"
				(activated)="play()"
			>
				{{ playing() ? 'Playing dialogue' : 'Play dialogue' }}
			</voco-secondary-button>
			@if (currentSpeaker()) {
				<span aria-live="polite"
					>Now speaking: {{ currentSpeaker() }}</span
				>
			}
			@if (maxReplays) {
				<span>{{ replayCount() }} of {{ maxReplays }} plays used</span>
			}
			@if (error()) {
				<span role="alert">{{ error() }}</span>
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
	readonly error = signal('');
	private currentPlayCounted = false;

	canReplay(): boolean {
		return !this.maxReplays || this.replayCount() < this.maxReplays;
	}

	play(): void {
		if (this.playing() || !this.canReplay() || !this.turns.length) return;
		this.error.set('');
		this.currentPlayCounted = false;
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
			this.currentPlayCounted = false;
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
				onError: () => this.fail(),
			},
			turn.voiceIndex ?? index,
		);
		if (!started) {
			this.fail();
			return;
		}
		if (!this.playing()) return;
		if (index === 0) {
			this.replayCount.update((count) => count + 1);
			this.currentPlayCounted = true;
		}
	}

	private fail(): void {
		if (this.currentPlayCounted) {
			this.replayCount.update((count) => Math.max(0, count - 1));
		}
		this.currentPlayCounted = false;
		this.stop();
		this.error.set('Dialogue playback failed. Please try again.');
	}

	private stop(): void {
		if (this.nextTurnTimer) clearTimeout(this.nextTurnTimer);
		this.nextTurnTimer = undefined;
		this.speech.cancel();
		this.playing.set(false);
		this.currentSpeaker.set('');
	}
}
