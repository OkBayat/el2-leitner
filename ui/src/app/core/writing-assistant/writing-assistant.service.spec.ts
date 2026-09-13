import { describe, expect, it, vi } from "vitest";
import type { Lint, Linter, Suggestion } from "harper.js";
import {
	initializeWritingAssistantLinter,
	WritingAssistantSession,
} from "./writing-assistant.service";

function lint(problem = "teh", start = 0, end = 3, replacement = "the"): Lint {
	const suggestion = {
		get_replacement_text: () => replacement,
	} as Suggestion;
	return {
		span: () => ({ start, end }),
		suggestions: () => [suggestion],
		lint_kind_pretty: () => "Spelling",
		message: () => "Possible spelling mistake.",
		get_problem_text: () => problem,
	} as unknown as Lint;
}

function fakeLinter(overrides: Partial<Linter> = {}): Linter {
	return {
		lint: vi.fn(async () => [lint()]),
		contextHash: vi.fn(async () => 42n),
		applySuggestion: vi.fn(
			async (text: string, issue: Lint, suggestion: Suggestion) => {
				const span = issue.span();
				return (
					text.slice(0, span.start) +
					suggestion.get_replacement_text() +
					text.slice(span.end)
				);
			},
		),
		...overrides,
	} as unknown as Linter;
}

describe("WritingAssistantSession", () => {
	it("initializes the Harper worker and materializes its grammar rules", async () => {
		const harper = fakeLinter({
			setup: vi.fn(async () => undefined),
			getDefaultLintConfig: vi.fn(async () => ({})),
		});
		expect(await initializeWritingAssistantLinter(harper)).toBe(harper);
		expect(harper.setup).toHaveBeenCalledOnce();
		expect(harper.getDefaultLintConfig).toHaveBeenCalledOnce();
	});

	it("debounces and maps Harper worker results into English UI issues", async () => {
		vi.useFakeTimers();
		const harper = fakeLinter();
		const session = new WritingAssistantSession(async () => harper, 350);
		session.update("teh cat");
		expect(session.status()).toBe("checking");
		await vi.advanceTimersByTimeAsync(349);
		expect(harper.lint).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(1);
		expect(session.issues()[0]).toMatchObject({
			category: "Spelling",
			message: "Possible spelling mistake.",
			problemText: "teh",
			start: 0,
			end: 3,
			suggestions: ["the"],
		});
		expect(session.status()).toBe("ready");
		session.dispose();
		vi.useRealTimers();
	});

	it("maps Harper Unicode scalar spans to browser textarea offsets", async () => {
		vi.useFakeTimers();
		const session = new WritingAssistantSession(
			async () =>
				fakeLinter({ lint: vi.fn(async () => [lint("teh", 2, 5)]) }),
			1,
		);
		session.update("😀 teh");
		await vi.advanceTimersByTimeAsync(1);
		expect(session.issues()[0]).toMatchObject({ start: 3, end: 6 });
		session.dispose();
		vi.useRealTimers();
	});

	it("ignores stale lint results when newer text wins", async () => {
		vi.useFakeTimers();
		let resolveFirst!: (value: Lint[]) => void;
		const harper = fakeLinter({
			lint: vi.fn((text: string) =>
				text === "old"
					? new Promise<Lint[]>((resolve) => {
							resolveFirst = resolve;
						})
					: Promise.resolve([lint("new", 0, 3, "newer")]),
			),
		});
		const session = new WritingAssistantSession(async () => harper, 1);
		session.update("old");
		await vi.advanceTimersByTimeAsync(1);
		session.update("new");
		await vi.advanceTimersByTimeAsync(1);
		resolveFirst([lint("old")]);
		await Promise.resolve();
		expect(session.issues()[0].problemText).toBe("new");
		session.dispose();
		vi.useRealTimers();
	});

	it("applies the selected range and tracks learner-controlled apply and ignore actions", async () => {
		vi.useFakeTimers();
		const session = new WritingAssistantSession(
			async () => fakeLinter(),
			1,
		);
		session.update("teh cat");
		await vi.advanceTimersByTimeAsync(1);
		const first = session.issues()[0];
		expect(await session.apply(first.id)).toBe("the cat");
		await vi.advanceTimersByTimeAsync(1);
		const next = session.issues()[0];
		session.ignore(next.id);
		expect(session.summary()).toMatchObject({ applied: 1, ignored: 1 });
		session.dispose();
		vi.useRealTimers();
	});

	it("fails open so writing remains available when Harper cannot initialize or lint", async () => {
		vi.useFakeTimers();
		const session = new WritingAssistantSession(async () => {
			throw new Error("WASM failed");
		}, 1);
		session.update("Keep my answer");
		await vi.advanceTimersByTimeAsync(1);
		expect(session.status()).toBe("unavailable");
		expect(session.issues()).toEqual([]);
		session.dispose();
		vi.useRealTimers();
	});
});
