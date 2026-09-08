import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { SlideContentContext } from '../../../slide-content-contracts';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { options, record, requiredText } from '../../slide-library.utils';
import { ChoiceSlideComponent } from '../choice/choice-slide.component';

@Component({
	selector: 'app-pronunciation-slide',
	standalone: true,
	imports: [MatButtonModule, SlideStimulusComponent],
	templateUrl: './pronunciation-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PronunciationSlideComponent extends ChoiceSlideComponent {
	override load(context: SlideContentContext): void {
		const source = record(context.data);
		const mode = stringMode(
			source['mode'],
			[
				'phoneme-match',
				'sound-choice',
				'word-stress',
				'listen-and-identify',
				'ipa-match',
				'repeat',
			] as const,
			'sound-choice',
		);
		const parsedOptions =
			mode === 'repeat'
				? [{ id: 'repeated', label: 'I repeated it aloud' }]
				: options(source['options']);
		super.load({
			...context,
			data: {
				...common(source),
				mode: 'single',
				question: requiredText(
					source['question'],
					'Pronunciation question',
				),
				options: parsedOptions,
				correctOptionIds: [
					mode === 'repeat'
						? 'repeated'
						: requiredText(
								source['correctOptionId'],
								'Pronunciation answer',
							),
				],
			},
		});
	}
}
