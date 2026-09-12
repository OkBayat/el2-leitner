import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VocoButtonInteractionDirective, VocoSecondaryButtonComponent } from '../../../../voco-button';
import type { SlideContentContext } from '../../../slide-content-contracts';
import type { SlideOption, TruthSlideData } from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { options, record, requiredText } from '../../slide-library.utils';
import { ChoiceSlideComponent } from '../choice/choice-slide.component';

const TRUTH_OPTIONS: Record<TruthSlideData['mode'], readonly SlideOption[]> = {
	'true-false': [
		{ id: 'true', label: 'True' },
		{ id: 'false', label: 'False' },
	],
	'true-false-not-given': [
		{ id: 'true', label: 'True' },
		{ id: 'false', label: 'False' },
		{ id: 'not-given', label: 'Not Given' },
	],
	'yes-no-not-given': [
		{ id: 'yes', label: 'Yes' },
		{ id: 'no', label: 'No' },
		{ id: 'not-given', label: 'Not Given' },
	],
	'agree-disagree': [
		{ id: 'agree', label: 'Agree' },
		{ id: 'disagree', label: 'Disagree' },
	],
};

@Component({
	selector: 'app-truth-slide',
	standalone: true,
	imports: [VocoButtonInteractionDirective, VocoSecondaryButtonComponent, SlideStimulusComponent],
	templateUrl: './truth-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TruthSlideComponent extends ChoiceSlideComponent {
	override load(context: SlideContentContext): void {
		const source = record(context.data);
		const mode = stringMode(
			source['mode'],
			Object.keys(TRUTH_OPTIONS) as TruthSlideData['mode'][],
			'true-false',
		);
		const truthOptions = source['options']
			? options(source['options'])
			: TRUTH_OPTIONS[mode];
		super.load({
			...context,
			data: {
				...common(source),
				mode: 'single',
				question: requiredText(source['statement'], 'Truth statement'),
				options: truthOptions,
				correctOptionIds: [
					requiredText(source['correctOptionId'], 'Truth answer'),
				],
			},
		});
	}
}
