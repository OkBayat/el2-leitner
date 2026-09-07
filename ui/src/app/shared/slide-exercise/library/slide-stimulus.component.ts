import {
	ChangeDetectionStrategy,
	Component,
	Input,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { SlideStimulus } from './slide-library.models';

@Component({
	selector: 'app-slide-stimulus',
	standalone: true,
	imports: [MatButtonModule],
	templateUrl: './slide-stimulus.component.html',
	styleUrl: './slide-stimulus.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideStimulusComponent {
	@Input({ required: true }) stimulus!: SlideStimulus;
	readonly replayCount = signal(0);

	canReplay(): boolean {
		return (
			this.stimulus.type !== 'audio' ||
			!this.stimulus.maxReplays ||
			this.replayCount() < this.stimulus.maxReplays
		);
	}

	play(audio: HTMLAudioElement): void {
		if (!this.canReplay()) return;
		this.replayCount.update((count) => count + 1);
		audio.currentTime = 0;
		void audio.play();
	}
}
