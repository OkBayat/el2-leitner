import { Injectable } from "@angular/core";
import { clamp } from "../../domain/learning/learning-rules";

export interface SpeechPlaybackObserver {
	onStart?: () => void;
	onWordBoundary?: (charIndex: number, charLength: number) => void;
	onEnd?: () => void;
	onError?: () => void;
}

interface SpeechWordRange {
	charIndex: number;
	charLength: number;
	text: string;
}

const KOKORO_DIALOGUE_VOICES = [
	"af_heart",
	"bf_emma",
	"af_bella",
	"af_sky",
] as const;

function speechWordRanges(text: string): SpeechWordRange[] {
	return [...text.matchAll(/\S+/gu)].map((match) => ({
		charIndex: match.index ?? 0,
		charLength: match[0].length,
		text: match[0],
	}));
}

function estimatedWordDurationMs(word: string, rate: number): number {
	const alphanumericLength = [...word].filter((character) =>
		/[\p{L}\p{N}]/u.test(character),
	).length;
	const punctuationPause = /[.!?]$/u.test(word)
		? 120
		: /[,;:]$/u.test(word)
			? 70
			: 0;
	return (
		(190 +
			Math.min(12, Math.max(1, alphanumericLength)) * 22 +
			punctuationPause) /
		rate
	);
}

function dialogueVoice(voiceIndex?: number): string | undefined {
	if (voiceIndex === undefined) return undefined;
	const normalizedVoiceIndex =
		Number.isSafeInteger(voiceIndex) && voiceIndex >= 0 ? voiceIndex : 0;
	return KOKORO_DIALOGUE_VOICES[
		normalizedVoiceIndex % KOKORO_DIALOGUE_VOICES.length
	];
}

@Injectable({ providedIn: "root" })
export class SpeechService {
	private playbackSequence = 0;
	private readonly fallbackTimers = new Set<ReturnType<typeof setTimeout>>();
	private activeRequest: AbortController | null = null;
	private activeAudio: HTMLAudioElement | null = null;
	private activeObjectUrl: string | null = null;

	speak(
		text: string,
		rate = 0.85,
		observer?: SpeechPlaybackObserver,
		voiceIndex?: number,
	): boolean {
		const AudioConstructor = globalThis.Audio;
		if (
			typeof globalThis.fetch !== "function" ||
			typeof AudioConstructor !== "function" ||
			typeof globalThis.URL?.createObjectURL !== "function" ||
			typeof globalThis.URL?.revokeObjectURL !== "function"
		)
			return false;

		this.cancel();
		const playbackSequence = ++this.playbackSequence;
		const normalizedRate = clamp(rate, 0.45, 1.2);
		const request = new AbortController();
		this.activeRequest = request;
		void this.requestAndPlay(
			text,
			normalizedRate,
			voiceIndex,
			playbackSequence,
			request,
			AudioConstructor,
			observer,
		);
		return true;
	}

	cancel(): void {
		this.playbackSequence += 1;
		this.clearFallbackTimers();
		this.activeRequest?.abort();
		this.activeRequest = null;
		this.releaseAudio();
	}

	private async requestAndPlay(
		text: string,
		rate: number,
		voiceIndex: number | undefined,
		playbackSequence: number,
		request: AbortController,
		AudioConstructor: typeof Audio,
		observer?: SpeechPlaybackObserver,
	): Promise<void> {
		try {
			const voice = dialogueVoice(voiceIndex);
			const response = await globalThis.fetch("/api/tts/speech", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				body: JSON.stringify({
					text,
					speed: rate,
					format: "mp3",
					...(voice ? { voice } : {}),
				}),
				signal: request.signal,
			});
			if (!response.ok) throw new Error("Speech generation failed.");

			const audioBlob = await response.blob();
			if (!audioBlob.size) {
				throw new Error("Speech generation returned no audio.");
			}
			if (!this.isCurrent(playbackSequence)) return;
			if (this.activeRequest === request) this.activeRequest = null;

			const objectUrl = globalThis.URL.createObjectURL(audioBlob);
			if (!this.isCurrent(playbackSequence)) {
				globalThis.URL.revokeObjectURL(objectUrl);
				return;
			}

			const audio = new AudioConstructor(objectUrl);
			audio.preload = "auto";
			this.activeAudio = audio;
			this.activeObjectUrl = objectUrl;
			audio.onended = () =>
				this.finishPlayback(playbackSequence, observer);
			audio.onerror = () => this.failPlayback(playbackSequence, observer);

			await audio.play();
			if (!this.isCurrent(playbackSequence)) return;
			observer?.onStart?.();
			if (this.isCurrent(playbackSequence)) {
				this.emitEstimatedWordBoundaries(
					text,
					rate,
					playbackSequence,
					observer,
				);
			}
		} catch {
			if (!request.signal.aborted) {
				this.failPlayback(playbackSequence, observer);
			}
		}
	}

	private emitEstimatedWordBoundaries(
		text: string,
		rate: number,
		playbackSequence: number,
		observer?: SpeechPlaybackObserver,
	): void {
		if (!observer?.onWordBoundary) return;
		const words = speechWordRanges(text);
		if (!words.length) return;

		observer.onWordBoundary(words[0].charIndex, words[0].charLength);
		let delay = estimatedWordDurationMs(words[0].text, rate);
		for (let index = 1; index < words.length; index += 1) {
			const word = words[index];
			const timer = setTimeout(() => {
				this.fallbackTimers.delete(timer);
				if (this.isCurrent(playbackSequence)) {
					observer.onWordBoundary?.(word.charIndex, word.charLength);
				}
			}, delay);
			this.fallbackTimers.add(timer);
			delay += estimatedWordDurationMs(word.text, rate);
		}
	}

	private finishPlayback(
		playbackSequence: number,
		observer?: SpeechPlaybackObserver,
	): void {
		if (!this.isCurrent(playbackSequence)) return;
		this.clearFallbackTimers();
		this.releaseAudio();
		this.playbackSequence += 1;
		observer?.onEnd?.();
	}

	private failPlayback(
		playbackSequence: number,
		observer?: SpeechPlaybackObserver,
	): void {
		if (!this.isCurrent(playbackSequence)) return;
		this.activeRequest = null;
		this.clearFallbackTimers();
		this.releaseAudio();
		this.playbackSequence += 1;
		observer?.onError?.();
	}

	private releaseAudio(): void {
		if (this.activeAudio) {
			this.activeAudio.onended = null;
			this.activeAudio.onerror = null;
			this.activeAudio.pause();
			this.activeAudio.currentTime = 0;
			this.activeAudio = null;
		}
		if (this.activeObjectUrl) {
			globalThis.URL.revokeObjectURL(this.activeObjectUrl);
			this.activeObjectUrl = null;
		}
	}

	private isCurrent(playbackSequence: number): boolean {
		return playbackSequence === this.playbackSequence;
	}

	private clearFallbackTimers(): void {
		for (const timer of this.fallbackTimers) clearTimeout(timer);
		this.fallbackTimers.clear();
	}
}
