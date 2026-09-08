import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpeechService } from '../../../core/speech/speech.service';
import { LearningStoreService } from '../../../core/state/learning-store.service';
import { SlideDialogueControlComponent } from './slide-dialogue-control.component';

describe('SlideDialogueControlComponent', () => {
	afterEach(() => vi.useRealTimers());

	it('plays ordered turns with distinct voice indexes and enforces the replay limit', async () => {
		vi.useFakeTimers();
		const endings: Array<() => void> = [];
		const speech = {
			speak: vi.fn(
				(
					text: string,
					rate: number,
					observer: { onEnd?: () => void },
					voiceIndex: number,
				) => {
					endings.push(() => observer.onEnd?.());
					return Boolean(text && rate && voiceIndex >= 0);
				},
			),
			cancel: vi.fn(),
		};
		TestBed.configureTestingModule({
			imports: [SlideDialogueControlComponent],
			providers: [
				{ provide: SpeechService, useValue: speech },
				{
					provide: LearningStoreService,
					useValue: { state: () => null },
				},
			],
		});
		const fixture = TestBed.createComponent(SlideDialogueControlComponent);
		fixture.componentRef.setInput('turns', [
			{ speaker: 'A', text: 'First turn.', voiceIndex: 0 },
			{ speaker: 'B', text: 'Second turn.', voiceIndex: 1 },
		]);
		fixture.componentRef.setInput('maxReplays', 1);
		fixture.detectChanges();

		fixture.componentInstance.play();
		expect(speech.speak).toHaveBeenNthCalledWith(
			1,
			'First turn.',
			0.85,
			expect.any(Object),
			0,
		);
		endings[0]();
		await vi.advanceTimersByTimeAsync(250);
		expect(speech.speak).toHaveBeenNthCalledWith(
			2,
			'Second turn.',
			0.85,
			expect.any(Object),
			1,
		);
		endings[1]();
		await vi.advanceTimersByTimeAsync(250);
		expect(fixture.componentInstance.playing()).toBe(false);

		fixture.componentInstance.play();
		expect(speech.speak).toHaveBeenCalledTimes(2);
	});

	it('cancels playback and pending turns when the control is destroyed', async () => {
		vi.useFakeTimers();
		let finishFirstTurn: (() => void) | undefined;
		const speech = {
			speak: vi.fn((_text: string, _rate: number, observer: { onEnd?: () => void }) => {
				finishFirstTurn = () => observer.onEnd?.();
				return true;
			}),
			cancel: vi.fn(),
		};
		TestBed.configureTestingModule({
			imports: [SlideDialogueControlComponent],
			providers: [
				{ provide: SpeechService, useValue: speech },
				{ provide: LearningStoreService, useValue: { state: () => null } },
			],
		});
		const fixture = TestBed.createComponent(SlideDialogueControlComponent);
		fixture.componentRef.setInput('turns', [
			{ speaker: 'A', text: 'First turn.' },
			{ speaker: 'B', text: 'Second turn.' },
		]);
		fixture.detectChanges();

		fixture.componentInstance.play();
		finishFirstTurn?.();
		fixture.destroy();
		await vi.advanceTimersByTimeAsync(250);

		expect(speech.cancel).toHaveBeenCalled();
		expect(speech.speak).toHaveBeenCalledTimes(1);
	});
});
