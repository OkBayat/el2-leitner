import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { SlideAudioControlComponent } from './slide-audio-control.component';
import type { SlideStimulus } from './slide-library.models';

@Component({
	selector: 'app-slide-stimulus',
	standalone: true,
	imports: [SlideAudioControlComponent],
	templateUrl: './slide-stimulus.component.html',
	styleUrl: './slide-stimulus.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideStimulusComponent {
	@Input({ required: true }) stimulus!: SlideStimulus;
}
