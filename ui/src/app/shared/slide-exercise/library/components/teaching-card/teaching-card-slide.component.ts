import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type {
	SlideContentComponent,
	SlideContentContext,
} from '../../../slide-content-contracts';
import type {
	TeachingBlock,
	TeachingCardData,
} from '../../slide-library.models';
import { SlideStimulusComponent } from '../../slide-stimulus.component';
import { common, stringMode } from '../../slide-library.component-support';
import { record, requiredText, text } from '../../slide-library.utils';

@Component({
	selector: 'app-teaching-card-slide',
	standalone: true,
	imports: [SlideStimulusComponent],
	templateUrl: './teaching-card-slide.component.html',
	styleUrl: '../../slide-library.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TeachingCardSlideComponent implements SlideContentComponent {
	readonly content = signal<TeachingCardData | null>(null);
	load(context: SlideContentContext): void {
		const source = record(context.data);
		const blocks = Array.isArray(source['blocks'])
			? source['blocks'].map((candidate) => {
					const block = record(candidate, 'teaching block');
					return {
						kind: stringMode(
							block['kind'],
							[
								'word',
								'comparison',
								'correction',
								'patterns',
								'example',
								'note',
							] as const,
							'note',
						),
						title: text(block['title']) || undefined,
						content: requiredText(
							block['content'],
							'Teaching block content',
						),
						secondary: text(block['secondary']) || undefined,
					} satisfies TeachingBlock;
				})
			: [];
		if (!blocks.length)
			throw new Error('Teaching card blocks are required.');
		this.content.set({
			...common(source),
			mode: stringMode(
				source['mode'],
				[
					'word',
					'usage',
					'contrast',
					'rule',
					'warning',
					'tip',
				] as const,
				'word',
			),
			title: requiredText(source['title'], 'Teaching card title'),
			blocks,
		});
	}
}
