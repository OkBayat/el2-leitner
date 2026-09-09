import { afterEach, describe, expect, it, vi } from "vitest";
import { SpeechService } from "./speech.service";

class FakeUtterance {
	lang = "";
	rate = 1;
	pitch = 1;
	voice: SpeechSynthesisVoice | null = null;
	onstart: (() => void) | null = null;
	onboundary:
		| ((event: {
				name: string;
				charIndex: number;
				charLength: number;
		  }) => void)
		| null = null;
	onend: (() => void) | null = null;
	onerror: (() => void) | null = null;

	constructor(readonly text: string) {}
}

class FakeAudio {
	static latest: FakeAudio | null = null;
	static constructorError: Error | null = null;
	static playError: Error | null = null;
	preload = "";
	currentTime = 0;
	onended: (() => void) | null = null;
	onerror: (() => void) | null = null;
	readonly play = vi.fn(async () => {
		if (FakeAudio.playError) throw FakeAudio.playError;
	});
	readonly pause = vi.fn();

	constructor(readonly src: string) {
		if (FakeAudio.constructorError) throw FakeAudio.constructorError;
		FakeAudio.latest = this;
	}
}

function installBrowserSpeech(voices: SpeechSynthesisVoice[] = []): {
	utterance: () => FakeUtterance;
	speak: ReturnType<typeof vi.fn>;
} {
	let latest: FakeUtterance | null = null;
	const speak = vi.fn((utterance: FakeUtterance) => {
		latest = utterance;
	});
	vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
	vi.stubGlobal("speechSynthesis", {
		cancel: vi.fn(),
		getVoices: vi.fn(() => voices),
		speak,
	});
	return {
		utterance: () => {
			if (!latest) throw new Error("Expected browser speech fallback.");
			return latest;
		},
		speak,
	};
}

function installBackend(
	options: {
		constructorError?: Error;
		ok?: boolean;
		playError?: Error;
	} = {},
): {
	fetch: ReturnType<typeof vi.fn>;
	createObjectURL: ReturnType<typeof vi.fn>;
	revokeObjectURL: ReturnType<typeof vi.fn>;
} {
	const audioBlob = new Blob(["generated-audio"], { type: "audio/mpeg" });
	const fetch = vi.fn(
		async () =>
			({
				ok: options.ok ?? true,
				blob: vi.fn(async () => audioBlob),
			}) as unknown as Response,
	);
	const createObjectURL = vi.fn(() => "blob:kokoro-audio");
	const revokeObjectURL = vi.fn();
	vi.stubGlobal("fetch", fetch);
	vi.stubGlobal("Audio", FakeAudio);
	vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
	FakeAudio.constructorError = options.constructorError ?? null;
	FakeAudio.playError = options.playError ?? null;
	return { fetch, createObjectURL, revokeObjectURL };
}

describe("SpeechService backend playback", () => {
	afterEach(() => {
		FakeAudio.latest = null;
		FakeAudio.constructorError = null;
		FakeAudio.playError = null;
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("requests Kokoro audio and releases the temporary URL after playback", async () => {
		const backend = installBackend();
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
		await vi.waitFor(() => expect(onStart).toHaveBeenCalledOnce());

		const request = backend.fetch.mock.calls[0][1] as RequestInit;
		expect(backend.fetch).toHaveBeenCalledWith(
			"/api/tts/speech",
			expect.objectContaining({
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "same-origin",
				signal: expect.any(AbortSignal),
			}),
		);
		expect(JSON.parse(String(request.body))).toEqual({
			text: "Hello world",
			speed: 0.85,
			format: "mp3",
		});
		expect(backend.createObjectURL).toHaveBeenCalledOnce();
		expect(FakeAudio.latest?.src).toBe("blob:kokoro-audio");
		expect(FakeAudio.latest?.play).toHaveBeenCalledOnce();
		expect(onWordBoundary).toHaveBeenCalledWith(0, 5);

		FakeAudio.latest?.onended?.();

		expect(onEnd).toHaveBeenCalledOnce();
		expect(FakeAudio.latest?.pause).toHaveBeenCalledOnce();
		expect(backend.revokeObjectURL).toHaveBeenCalledWith(
			"blob:kokoro-audio",
		);
	});

	it("maps dialogue turns to deterministic Kokoro voices", async () => {
		const backend = installBackend();
		const service = new SpeechService();

		service.speak("Second speaker", 0.95, undefined, 5);
		await vi.waitFor(() => expect(FakeAudio.latest).not.toBeNull());

		const request = backend.fetch.mock.calls[0][1] as RequestInit;
		expect(JSON.parse(String(request.body))).toEqual({
			text: "Second speaker",
			speed: 0.95,
			format: "mp3",
			voice: "bf_emma",
		});
	});

	it("aborts an in-flight backend request without starting fallback", async () => {
		installBackend();
		let requestSignal: AbortSignal | undefined;
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_input: RequestInfo | URL, init?: RequestInit) =>
					new Promise<Response>((_resolve, reject) => {
						requestSignal = init?.signal ?? undefined;
						requestSignal?.addEventListener("abort", () => {
							reject(new DOMException("Aborted", "AbortError"));
						});
					}),
			),
		);
		const browser = installBrowserSpeech();
		const onError = vi.fn();
		const service = new SpeechService();

		service.speak("Cancel me", 0.85, { onError });
		service.cancel();
		await Promise.resolve();

		expect(requestSignal?.aborted).toBe(true);
		expect(browser.speak).not.toHaveBeenCalled();
		expect(onError).not.toHaveBeenCalled();
	});

	it("falls back to the previous browser speech behavior when the endpoint fails", async () => {
		installBackend({ ok: false });
		const browser = installBrowserSpeech();
		const onStart = vi.fn();
		const onWordBoundary = vi.fn();
		const onEnd = vi.fn();
		const service = new SpeechService();

		service.speak("Hello world", 0.85, {
			onStart,
			onWordBoundary,
			onEnd,
		});
		await vi.waitFor(() => expect(browser.speak).toHaveBeenCalledOnce());

		const utterance = browser.utterance();
		expect(utterance.lang).toBe("en-GB");
		expect(utterance.rate).toBe(0.85);
		utterance.onstart?.();
		utterance.onboundary?.({
			name: "word",
			charIndex: 6,
			charLength: 5,
		});
		utterance.onend?.();

		expect(onStart).toHaveBeenCalledOnce();
		expect(onWordBoundary.mock.calls).toEqual([
			[0, 5],
			[6, 5],
		]);
		expect(onEnd).toHaveBeenCalledOnce();
	});

	it("falls back when generated audio cannot start playback", async () => {
		const backend = installBackend({ playError: new Error("blocked") });
		const browser = installBrowserSpeech();
		const service = new SpeechService();

		service.speak("Fallback playback");
		await vi.waitFor(() => expect(browser.speak).toHaveBeenCalledOnce());

		expect(backend.revokeObjectURL).toHaveBeenCalledWith(
			"blob:kokoro-audio",
		);
	});

	it("reports one lifecycle error instead of restarting after backend playback began", async () => {
		installBackend();
		const browser = installBrowserSpeech();
		const onStart = vi.fn();
		const onError = vi.fn();
		const service = new SpeechService();

		service.speak("Started playback", 0.85, { onStart, onError });
		await vi.waitFor(() => expect(onStart).toHaveBeenCalledOnce());
		FakeAudio.latest?.onerror?.();

		expect(browser.speak).not.toHaveBeenCalled();
		expect(onStart).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledOnce();
	});

	it("revokes the generated URL before falling back when audio construction fails", async () => {
		const backend = installBackend({
			constructorError: new Error("unsupported audio"),
		});
		const browser = installBrowserSpeech();
		const service = new SpeechService();

		service.speak("Constructor fallback");
		await vi.waitFor(() => expect(browser.speak).toHaveBeenCalledOnce());

		expect(backend.revokeObjectURL).toHaveBeenCalledWith(
			"blob:kokoro-audio",
		);
	});

	it("uses browser speech directly when backend playback APIs are unavailable", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const browser = installBrowserSpeech();
		const service = new SpeechService();

		expect(service.speak("Local fallback")).toBe(true);
		expect(browser.utterance().text).toBe("Local fallback");
	});

	it("reports an error when both backend playback and browser fallback fail", async () => {
		installBackend({ ok: false });
		vi.stubGlobal("speechSynthesis", undefined);
		vi.stubGlobal("SpeechSynthesisUtterance", undefined);
		const onError = vi.fn();
		const service = new SpeechService();

		expect(service.speak("Unavailable", 0.85, { onError })).toBe(true);
		await vi.waitFor(() => expect(onError).toHaveBeenCalledOnce());
	});

	it("advances estimated word boundaries when browser speech has no native events", async () => {
		vi.useFakeTimers();
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const browser = installBrowserSpeech();
		const onWordBoundary = vi.fn();
		const service = new SpeechService();

		service.speak("English is his first language.", 0.85, {
			onWordBoundary,
		});
		browser.utterance().onstart?.();

		expect(onWordBoundary).toHaveBeenLastCalledWith(0, 7);
		await vi.advanceTimersByTimeAsync(450);
		expect(onWordBoundary).toHaveBeenLastCalledWith(8, 2);
		await vi.advanceTimersByTimeAsync(320);
		expect(onWordBoundary).toHaveBeenLastCalledWith(11, 3);
	});

	it("ignores stale browser boundary events after a replacement starts", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const browser = installBrowserSpeech();
		const firstBoundary = vi.fn();
		const secondBoundary = vi.fn();
		const service = new SpeechService();

		service.speak("First sentence", 0.85, {
			onWordBoundary: firstBoundary,
		});
		const first = browser.utterance();
		service.speak("Second sentence", 0.85, {
			onWordBoundary: secondBoundary,
		});
		const second = browser.utterance();

		first.onboundary?.({ name: "word", charIndex: 0, charLength: 5 });
		second.onboundary?.({ name: "word", charIndex: 7, charLength: 8 });

		expect(firstBoundary).not.toHaveBeenCalled();
		expect(secondBoundary).toHaveBeenCalledWith(7, 8);
	});

	it("preserves deterministic browser dialogue voice and pitch selection", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const voices = [
			{ lang: "en-US", name: "US", voiceURI: "us" },
			{ lang: "en-GB", name: "GB", voiceURI: "gb" },
		] as SpeechSynthesisVoice[];
		const browser = installBrowserSpeech(voices);
		const service = new SpeechService();

		service.speak("Second speaker", 0.85, undefined, 1);

		expect(browser.utterance().voice).toBe(voices[0]);
		expect(browser.utterance().pitch).toBe(1.1);
	});

	it("preserves the preferred British browser voice for ordinary playback", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const voices = [
			{ lang: "en-US", name: "US", voiceURI: "us" },
			{ lang: "en-GB", name: "GB", voiceURI: "gb" },
		] as SpeechSynthesisVoice[];
		const browser = installBrowserSpeech(voices);
		const service = new SpeechService();

		service.speak("Ordinary playback");

		expect(browser.utterance().voice).toBe(voices[1]);
		expect(browser.utterance().pitch).toBe(1);
	});

	it("reports browser fallback errors without completing playback", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const browser = installBrowserSpeech();
		const onEnd = vi.fn();
		const onError = vi.fn();
		const service = new SpeechService();

		service.speak("Failed fallback", 0.85, { onEnd, onError });
		browser.utterance().onerror?.();

		expect(onError).toHaveBeenCalledOnce();
		expect(onEnd).not.toHaveBeenCalled();
	});

	it("returns false when direct browser fallback rejects synchronously", () => {
		vi.stubGlobal("fetch", undefined);
		vi.stubGlobal("Audio", undefined);
		const browser = installBrowserSpeech();
		browser.speak.mockImplementation(() => {
			throw new Error("voice unavailable");
		});
		const service = new SpeechService();

		expect(service.speak("Failed fallback")).toBe(false);
	});
});
