import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeechService } from "./speech.service";

class FakeUtterance {
	lang = "";
	rate = 1;
	pitch = 1;
	voice: SpeechSynthesisVoice | null = null;
	onstart: ((event: unknown) => void) | null = null;
	onboundary:
		| ((event: {
				name: string;
				charIndex: number;
				charLength: number;
		  }) => void)
		| null = null;
	onend: ((event: unknown) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;

	constructor(readonly text: string) {}
}

function installSpeechSynthesis(voices: SpeechSynthesisVoice[] = []): {
	utterance: () => FakeUtterance;
} {
	let latest: FakeUtterance | null = null;
	vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
	vi.stubGlobal("speechSynthesis", {
		cancel: vi.fn(),
		getVoices: vi.fn(() => voices),
		speak: vi.fn((utterance: FakeUtterance) => {
			latest = utterance;
		}),
	});
	return {
		utterance: () => {
			if (!latest) throw new Error("Expected an utterance to be spoken.");
			return latest;
		},
	};
}

describe("SpeechService playback events", () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("uses native word boundaries when the browser provides them", async () => {
		vi.useFakeTimers();
		const speech = installSpeechSynthesis();
		const onStart = vi.fn();
		const onWordBoundary = vi.fn();
		const onEnd = vi.fn();
		const service = new SpeechService();

		expect(
			service.speak("Hello world", 0.85, {
				onStart,
				onWordBoundary,
				onEnd,
			}),
		).toBe(true);
		const utterance = speech.utterance();
		utterance.onstart?.({});
		utterance.onboundary?.({ name: "word", charIndex: 6, charLength: 5 });
		utterance.onboundary?.({
			name: "sentence",
			charIndex: 0,
			charLength: 11,
		});
		await vi.advanceTimersByTimeAsync(2_000);
		utterance.onend?.({});

		expect(onStart).toHaveBeenCalledTimes(1);
		expect(onWordBoundary.mock.calls).toEqual([
			[0, 5],
			[6, 5],
		]);
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it("advances word by word when a browser voice emits no boundary events", async () => {
		vi.useFakeTimers();
		const speech = installSpeechSynthesis();
		const onWordBoundary = vi.fn();
		const service = new SpeechService();

		service.speak("English is his first language.", 0.85, {
			onWordBoundary,
		});
		const utterance = speech.utterance();
		utterance.onstart?.({});

		expect(onWordBoundary).toHaveBeenLastCalledWith(0, 7);
		await vi.advanceTimersByTimeAsync(450);
		expect(onWordBoundary).toHaveBeenLastCalledWith(8, 2);
		await vi.advanceTimersByTimeAsync(320);
		expect(onWordBoundary).toHaveBeenLastCalledWith(11, 3);
	});

	it("stops fallback timing as soon as a native boundary appears", async () => {
		vi.useFakeTimers();
		const speech = installSpeechSynthesis();
		const onWordBoundary = vi.fn();
		const service = new SpeechService();

		service.speak("One two three four", 0.85, { onWordBoundary });
		const utterance = speech.utterance();
		utterance.onstart?.({});
		utterance.onboundary?.({ name: "word", charIndex: 4, charLength: 3 });
		await vi.advanceTimersByTimeAsync(5_000);

		expect(onWordBoundary.mock.calls).toEqual([
			[0, 3],
			[4, 3],
		]);
	});

	it("ignores stale boundary events after a new utterance starts", () => {
		const speech = installSpeechSynthesis();
		const firstBoundary = vi.fn();
		const secondBoundary = vi.fn();
		const service = new SpeechService();

		service.speak("First sentence", 0.85, {
			onWordBoundary: firstBoundary,
		});
		const first = speech.utterance();
		service.speak("Second sentence", 0.85, {
			onWordBoundary: secondBoundary,
		});
		const second = speech.utterance();

		first.onboundary?.({ name: "word", charIndex: 0, charLength: 5 });
		second.onboundary?.({ name: "word", charIndex: 7, charLength: 8 });

		expect(firstBoundary).not.toHaveBeenCalled();
		expect(secondBoundary).toHaveBeenCalledWith(7, 8);
	});

	it("selects a deterministic English voice for dialogue turns", () => {
		const voices = [
			{
				lang: "en-US",
				name: "US",
				voiceURI: "us",
			} as SpeechSynthesisVoice,
			{
				lang: "en-GB",
				name: "GB",
				voiceURI: "gb",
			} as SpeechSynthesisVoice,
		];
		const speech = installSpeechSynthesis(voices);
		const service = new SpeechService();

		service.speak("Second speaker", 0.85, undefined, 1);

		expect(speech.utterance().voice).toBe(voices[0]);
		expect(speech.utterance().pitch).toBe(1.1);
	});

	it("preserves legacy voice selection and pitch when no dialogue voice index is supplied", () => {
		const voices = [
			{
				lang: "en-US",
				name: "US",
				voiceURI: "us",
			} as SpeechSynthesisVoice,
			{
				lang: "en-GB",
				name: "Zulu",
				voiceURI: "zulu",
			} as SpeechSynthesisVoice,
			{
				lang: "en-GB",
				name: "Alpha",
				voiceURI: "alpha",
			} as SpeechSynthesisVoice,
		];
		const speech = installSpeechSynthesis(voices);
		const service = new SpeechService();

		service.speak("Legacy playback");

		expect(speech.utterance().voice).toBe(voices[1]);
		expect(speech.utterance().pitch).toBe(1);
	});

	it("uses deterministic pitch when browser voices are initially unavailable", () => {
		const speech = installSpeechSynthesis([]);
		const service = new SpeechService();

		service.speak("Third speaker", 0.85, undefined, 2);

		expect(speech.utterance().voice).toBeNull();
		expect(speech.utterance().pitch).toBe(1);
	});

	it("reports synthesis errors without treating a failed turn as completed", () => {
		const speech = installSpeechSynthesis();
		const onEnd = vi.fn();
		const onError = vi.fn();
		const service = new SpeechService();

		service.speak("Failed turn", 0.85, { onEnd, onError });
		speech.utterance().onerror?.({});

		expect(onError).toHaveBeenCalledOnce();
		expect(onEnd).not.toHaveBeenCalled();
	});

	it("returns false when the browser rejects synthesis synchronously", () => {
		installSpeechSynthesis();
		vi.mocked(globalThis.speechSynthesis.speak).mockImplementation(() => {
			throw new Error("voice unavailable");
		});
		const service = new SpeechService();

		expect(service.speak("Failed turn")).toBe(false);
	});
});
