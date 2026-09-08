import {
	ChangeDetectionStrategy,
	Component,
	ViewChild,
	signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
	REUSABLE_SLIDE_FIXTURES,
	SlideExerciseComponent,
	type SlideExerciseContentEvent,
	type SlideExerciseSlideChange,
} from '../../shared/slide-exercise';

@Component({
	selector: 'app-slide-showcase-page',
	standalone: true,
	imports: [MatButtonModule, SlideExerciseComponent],
	templateUrl: './slide-showcase-page.component.html',
	styleUrl: './slide-showcase-page.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SlideShowcasePageComponent {
	@ViewChild(SlideExerciseComponent)
	private exercise?: SlideExerciseComponent;
	readonly slides = signal(REUSABLE_SLIDE_FIXTURES);
	readonly activeSlideId = signal(REUSABLE_SLIDE_FIXTURES[0].id);
	readonly latestEvent = signal('No interaction result yet.');

	inspect(slideId: string): void {
		this.activeSlideId.set(slideId);
		this.exercise?.goTo(slideId);
	}

	reset(): void {
		const activeSlideId = this.activeSlideId();
		this.slides.set(REUSABLE_SLIDE_FIXTURES.map((slide) => ({ ...slide })));
		queueMicrotask(() => this.exercise?.goTo(activeSlideId));
		this.latestEvent.set('Slide reset.');
	}

	onSlideChange(change: SlideExerciseSlideChange): void {
		this.activeSlideId.set(change.slideId);
	}

	onContentEvent(event: SlideExerciseContentEvent): void {
		this.latestEvent.set(`${event.slideId}: ${event.type}`);
	}
}
