import {Injectable} from '@angular/core';

export type ReviewAnswerSoundOutcome = 'correct' | 'incorrect';

const REVIEW_ANSWER_SOUND_PATHS: Record<ReviewAnswerSoundOutcome, string> = {
	correct: '/assets/correct-answer-song.mp3',
	incorrect: '/assets/wrong-answer-song.mp3',
};

export function reviewAnswerSoundPath(outcome: ReviewAnswerSoundOutcome): string {
	return REVIEW_ANSWER_SOUND_PATHS[outcome];
}

@Injectable({providedIn: 'root'})
export class ReviewAnswerSoundService {
	private activeAudio: HTMLAudioElement | null = null;

	play(outcome: ReviewAnswerSoundOutcome): void {
		const AudioConstructor = globalThis.Audio;
		if (!AudioConstructor) return;

		this.stop();
		const audio = new AudioConstructor(reviewAnswerSoundPath(outcome));
		audio.preload = 'auto';
		this.activeAudio = audio;
		void audio.play().catch(() => undefined);
	}

	stop(): void {
		if (!this.activeAudio) return;
		this.activeAudio.pause();
		this.activeAudio.currentTime = 0;
		this.activeAudio = null;
	}
}
