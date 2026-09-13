import { Injectable, signal, type Signal } from "@angular/core";
import type { Lint, Linter, Suggestion } from "harper.js";

export interface WritingAssistantIssue {
	readonly id: string;
	readonly category: string;
	readonly message: string;
	readonly problemText: string;
	readonly start: number;
	readonly end: number;
	readonly suggestions: readonly string[];
}

export interface WritingAssistantSummary {
	readonly detected: number;
	readonly applied: number;
	readonly ignored: number;
}

export interface WritingAssistantController {
	readonly status: Signal<"idle" | "checking" | "ready" | "unavailable">;
	readonly issues: Signal<readonly WritingAssistantIssue[]>;
	readonly summary: Signal<WritingAssistantSummary>;
	update(text: string): void;
	apply(issueId: string, suggestionIndex?: number): Promise<string | null>;
	ignore(issueId: string): void;
	dispose(): void;
}

interface LintReference {
	readonly source: string;
	readonly lint: Lint;
	readonly suggestions: Suggestion[];
}

function codePointOffsetToCodeUnit(text: string, offset: number): number {
	let codePoints = 0;
	let codeUnits = 0;
	for (const character of text) {
		if (codePoints >= offset) break;
		codePoints += 1;
		codeUnits += character.length;
	}
	return codeUnits;
}

export async function initializeWritingAssistantLinter(
	linter: Linter,
): Promise<Linter> {
	await linter.setup();
	// Materialize Harper's default grammar and style rules in the worker.
	// Some 2.x builds otherwise expose spelling rules only.
	await linter.getDefaultLintConfig();
	return linter;
}

export class WritingAssistantSession implements WritingAssistantController {
	readonly status = signal<"idle" | "checking" | "ready" | "unavailable">(
		"idle",
	);
	readonly issues = signal<readonly WritingAssistantIssue[]>([]);
	readonly summary = signal<WritingAssistantSummary>({
		detected: 0,
		applied: 0,
		ignored: 0,
	});
	private readonly references = new Map<string, LintReference>();
	private readonly detectedIds = new Set<string>();
	private readonly ignoredIds = new Set<string>();
	private timer?: ReturnType<typeof setTimeout>;
	private source = "";
	private generation = 0;
	private disposed = false;

	constructor(
		private readonly linter: () => Promise<Linter>,
		private readonly debounceMs = 350,
	) {}

	update(text: string): void {
		if (this.disposed) return;
		this.source = text;
		clearTimeout(this.timer);
		const generation = ++this.generation;
		if (!text.trim()) {
			this.references.clear();
			this.issues.set([]);
			this.status.set("idle");
			return;
		}
		this.status.set("checking");
		this.timer = setTimeout(
			() => void this.check(text, generation),
			this.debounceMs,
		);
	}

	async apply(issueId: string, suggestionIndex = 0): Promise<string | null> {
		const reference = this.references.get(issueId);
		const suggestion = reference?.suggestions[suggestionIndex];
		if (
			!reference ||
			!suggestion ||
			reference.source !== this.source ||
			this.disposed
		)
			return null;
		try {
			const next = await (
				await this.linter()
			).applySuggestion(reference.source, reference.lint, suggestion);
			if (this.disposed || reference.source !== this.source) return null;
			this.summary.update((value) => ({
				...value,
				applied: value.applied + 1,
			}));
			this.update(next);
			return next;
		} catch {
			this.status.set("unavailable");
			return null;
		}
	}

	ignore(issueId: string): void {
		if (!this.references.has(issueId) || this.disposed) return;
		this.references.delete(issueId);
		this.ignoredIds.add(issueId);
		this.issues.update((items) =>
			items.filter((item) => item.id !== issueId),
		);
		this.summary.update((value) => ({
			...value,
			ignored: value.ignored + 1,
		}));
	}

	dispose(): void {
		this.disposed = true;
		clearTimeout(this.timer);
		this.generation += 1;
		this.references.clear();
	}

	private async check(text: string, generation: number): Promise<void> {
		try {
			const linter = await this.linter();
			const lints = await linter.lint(text, {
				language: "plaintext",
				dedup: true,
				isolateEnglish: false,
			});
			if (
				this.disposed ||
				generation !== this.generation ||
				text !== this.source
			)
				return;
			const mapped: WritingAssistantIssue[] = [];
			const references = new Map<string, LintReference>();
			for (const lint of lints) {
				const span = lint.span();
				const suggestions = lint.suggestions();
				const hash = await linter.contextHash(text, lint);
				if (
					this.disposed ||
					generation !== this.generation ||
					text !== this.source
				)
					return;
				const id = hash.toString(16);
				this.detectedIds.add(id);
				if (this.ignoredIds.has(id)) continue;
				mapped.push({
					id,
					category: lint.lint_kind_pretty(),
					message: lint.message(),
					problemText: lint.get_problem_text(),
					start: codePointOffsetToCodeUnit(text, span.start),
					end: codePointOffsetToCodeUnit(text, span.end),
					suggestions: suggestions.map((suggestion) =>
						suggestion.get_replacement_text(),
					),
				});
				references.set(id, { source: text, lint, suggestions });
				if (mapped.length >= 8) break;
			}
			this.references.clear();
			for (const [id, reference] of references)
				this.references.set(id, reference);
			this.issues.set(mapped);
			this.summary.update((value) => ({
				...value,
				detected: this.detectedIds.size,
			}));
			this.status.set("ready");
		} catch {
			if (this.disposed || generation !== this.generation) return;
			this.references.clear();
			this.issues.set([]);
			this.status.set("unavailable");
		}
	}
}

@Injectable({ providedIn: "root" })
export class WritingAssistantService {
	private linterPromise?: Promise<Linter>;

	create(): WritingAssistantController {
		return new WritingAssistantSession(() => this.getLinter());
	}

	private getLinter(): Promise<Linter> {
		return (this.linterPromise ??= Promise.all([
			import("harper.js"),
			import("harper.js/binary"),
		]).then(async ([harper, wasm]) => {
			const linter = new harper.WorkerLinter({
				binary: wasm.binary,
				dialect: harper.Dialect.British,
			});
			return initializeWritingAssistantLinter(linter);
		}));
	}
}
