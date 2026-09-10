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
import {
	parseTeachingMarkdown,
	type TeachingMarkdownBlock,
} from './teaching-card-markdown';

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
	readonly markdownBlocks = signal<readonly TeachingMarkdownBlock[]>([]);
	load(context: SlideContentContext): void {
		const source = record(context.data);
		const hasMarkdown = Object.hasOwn(source, 'markdown');
		const hasBlocks = Object.hasOwn(source, 'blocks');
		if (hasMarkdown === hasBlocks)
			throw new Error(
				'Teaching card requires exactly one markdown or blocks content format.',
			);
		const markdown = hasMarkdown
			? requiredText(source['markdown'], 'Teaching card markdown')
			: '';
		if (
			hasBlocks &&
			(!Array.isArray(source['blocks']) || !source['blocks'].length)
		)
			throw new Error('Teaching card blocks are required.');
		const blocks =
			hasBlocks && Array.isArray(source['blocks'])
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
			markdown: markdown || undefined,
			blocks: blocks.length ? blocks : undefined,
		});
		this.markdownBlocks.set(
			markdown ? parseTeachingMarkdown(markdown) : [],
		);
	}
}
