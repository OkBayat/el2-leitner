import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASELINE_PATH = "ui/tests/design-system-architecture-baseline.json";
const STYLE_EXTENSIONS = new Set([".css", ".less", ".sass", ".scss"]);
const STYLE_OWNERS = [
	[
		/(--bs-[a-z0-9-]+)\s*:/giu,
		"Bootstrap semantic variables",
		"ui/src/styles/_bootstrap-theme.scss",
	],
	[
		/(--mat-sys-[a-z0-9-]+)\s*:/giu,
		"Material system variables",
		"ui/src/styles/_angular-material-theme.scss",
	],
	[
		/(--color-[a-z0-9-]+)\s*:/giu,
		"Vocora foundation colors",
		"ui/src/styles/_vocora-design-system.scss",
	],
];
const INTEGRATION_OWNERS = new Set([
	"ui/src/styles/_angular-material-components.scss",
	"ui/src/styles/_bootstrap-theme.scss",
]);

function normalizeRoot(repoRoot) {
	return repoRoot instanceof URL
		? fileURLToPath(repoRoot)
		: path.resolve(repoRoot);
}

function normalizeWhitespace(value) {
	return value.replace(/\s+/gu, " ").trim();
}

function readTypeScriptString(text, start) {
	const quote = text[start];
	let index = start + 1;
	let escaped = false;
	let value = "";
	while (index < text.length) {
		const character = text[index];
		index += 1;
		if (escaped) {
			value += character;
			escaped = false;
		} else if (character === "\\") {
			value += character;
			escaped = true;
		} else if (character === quote) {
			return [value, index];
		} else {
			value += character;
		}
	}
	return [null, index];
}

function extractInlineStyleMetadata(text) {
	if (!text.includes("@Component")) return { styles: [], unsupported: 0 };

	const styles = [];
	let unsupported = 0;
	for (const match of text.matchAll(/\bstyles\s*:\s*/gu)) {
		let index = match.index + match[0].length;
		if (index >= text.length) continue;
		if (["'", '"', "`"].includes(text[index])) {
			const [value] = readTypeScriptString(text, index);
			if (value !== null) styles.push(value);
			continue;
		}
		if (text[index] !== "[") {
			unsupported += 1;
			continue;
		}

		index += 1;
		let depth = 1;
		let unsupportedArray = false;
		while (index < text.length && depth > 0) {
			const character = text[index];
			if (["'", '"', "`"].includes(character)) {
				const [value, nextIndex] = readTypeScriptString(text, index);
				index = nextIndex;
				if (value !== null) styles.push(value);
			} else {
				index += 1;
				if (character === "[") depth += 1;
				if (character === "]") depth -= 1;
				if (
					depth > 0 &&
					![",", " ", "\t", "\r", "\n"].includes(character)
				) {
					unsupportedArray = true;
				}
			}
		}
		if (unsupportedArray) unsupported += 1;
	}
	return { styles, unsupported };
}

export function extractInlineStyles(text) {
	return extractInlineStyleMetadata(text).styles;
}

function extractBracedImportantDeclarations(text) {
	const declarations = [];
	for (const match of text.matchAll(
		/([a-z-]+)\s*:\s*([^;{}]+?)\s*!important\b/giu,
	)) {
		const propertyName = match[1].toLowerCase();
		const value = normalizeWhitespace(match[2]);
		const blockStart = text.lastIndexOf("{", match.index);
		const previousBoundary = Math.max(
			text.lastIndexOf("{", blockStart - 1),
			text.lastIndexOf("}", blockStart - 1),
		);
		const selector = normalizeWhitespace(
			text.slice(previousBoundary + 1, blockStart),
		);
		declarations.push(`${selector} => ${propertyName}:${value}!important`);
	}
	return declarations;
}

function extractIndentedSassImportantDeclarations(text) {
	const declarations = [];
	const selectors = [];
	for (const line of text.split(/\r?\n/u)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("//")) continue;
		const indent = line.length - line.trimStart().length;
		const declaration = trimmed.match(
			/^([a-z-]+)\s*:\s*(.+?)\s*!important\b/iu,
		);
		if (declaration) {
			while (selectors.length && selectors.at(-1).indent >= indent)
				selectors.pop();
			const selector = selectors.at(-1)?.text ?? "";
			declarations.push(
				`${selector} => ${declaration[1].toLowerCase()}:${normalizeWhitespace(declaration[2])}!important`,
			);
			continue;
		}
		if (!trimmed.startsWith("@") && !/^[a-z-]+\s*:/iu.test(trimmed)) {
			while (selectors.length && selectors.at(-1).indent >= indent)
				selectors.pop();
			selectors.push({ indent, text: trimmed });
		}
	}
	return declarations;
}

export function extractImportantDeclarations(
	text,
	{ indentedSass = false } = {},
) {
	return indentedSass
		? extractIndentedSassImportantDeclarations(text)
		: extractBracedImportantDeclarations(text);
}

export function extractMaterialInternalSelectors(
	text,
	{ indentedSass = false } = {},
) {
	if (indentedSass) {
		return text
			.split(/\r?\n/u)
			.map((line) => line.trim())
			.filter(
				(line) =>
					!line.startsWith("//") &&
					/\.mat-mdc-[a-z0-9_-]+/iu.test(line),
			);
	}
	return [...text.matchAll(/([^{}]+)\{/gu)]
		.map((match) => normalizeWhitespace(match[1]))
		.filter((selector) => /\.mat-mdc-[a-z0-9_-]+/iu.test(selector));
}

function styleUnits(sources, errors) {
	const units = [];
	for (const [relative, text] of sources) {
		const extension = path.extname(relative).toLowerCase();
		if (STYLE_EXTENSIONS.has(extension)) {
			units.push({ relative, text, indentedSass: extension === ".sass" });
		} else if (extension === ".ts") {
			const { styles: inlineStyles, unsupported } =
				extractInlineStyleMetadata(text);
			for (let index = 0; index < unsupported; index += 1) {
				errors?.push(
					`Unsupported Angular inline styles expression in ${relative}; use a literal string or literal string array`,
				);
			}
			if (inlineStyles.length)
				units.push({
					relative,
					text: inlineStyles.join("\n"),
					indentedSass: false,
				});
		}
	}
	return units;
}

function increment(target, relative, occurrence) {
	const occurrences = target.get(relative) ?? new Map();
	occurrences.set(occurrence, (occurrences.get(occurrence) ?? 0) + 1);
	target.set(relative, occurrences);
}

function scanDebt(units) {
	const important = new Map();
	const material = new Map();
	for (const { relative, text, indentedSass } of units) {
		for (const occurrence of extractImportantDeclarations(text, {
			indentedSass,
		})) {
			increment(important, relative, occurrence);
		}
		if (relative.startsWith("ui/src/app/")) {
			for (const occurrence of extractMaterialInternalSelectors(text, {
				indentedSass,
			})) {
				increment(material, relative, occurrence);
			}
		}
	}
	return { important, material };
}

function baselineEntries(baseline, section, category, errors) {
	const entries = baseline?.[section]?.[category];
	if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
		errors.push(
			`Design-system baseline ${section}.${category} must be an object`,
		);
		return new Map();
	}

	const result = new Map();
	for (const [relative, entry] of Object.entries(entries)) {
		const validOccurrences =
			Array.isArray(entry?.occurrences) &&
			entry.occurrences.every(
				(item) => typeof item === "string" && item.length > 0,
			);
		const validReason =
			typeof entry?.reason === "string" && entry.reason.trim().length > 0;
		if (!validOccurrences || !validReason) {
			errors.push(
				`Design-system baseline ${section}.${category}.${relative} must define string occurrences and a non-empty reason`,
			);
			continue;
		}
		if (section === "integration_exceptions") {
			if (!INTEGRATION_OWNERS.has(relative)) {
				errors.push(
					`Integration exception owner ${relative} is not an approved framework integration owner`,
				);
			}
			if (
				typeof entry.upstream_constraint !== "string" ||
				!entry.upstream_constraint.trim()
			) {
				errors.push(
					`Integration exception ${relative} must document its upstream_constraint`,
				);
			}
		}
		const counts = new Map();
		for (const occurrence of entry.occurrences) {
			counts.set(occurrence, (counts.get(occurrence) ?? 0) + 1);
		}
		result.set(relative, counts);
	}
	return result;
}

function addMaps(left, right, errors, label) {
	const result = new Map(
		[...left].map(([relative, occurrences]) => [
			relative,
			new Map(occurrences),
		]),
	);
	for (const [relative, occurrences] of right) {
		const target = result.get(relative) ?? new Map();
		for (const [occurrence, count] of occurrences) {
			if (target.has(occurrence))
				errors.push(
					`${label} is declared as both legacy debt and an integration exception in ${relative}: ${occurrence}`,
				);
			target.set(occurrence, (target.get(occurrence) ?? 0) + count);
		}
		result.set(relative, target);
	}
	return result;
}

function compareExact(actual, declared, label, errors) {
	const paths = new Set([...actual.keys(), ...declared.keys()]);
	for (const relative of [...paths].sort()) {
		const actualItems = actual.get(relative) ?? new Map();
		const declaredItems = declared.get(relative) ?? new Map();
		const occurrences = new Set([
			...actualItems.keys(),
			...declaredItems.keys(),
		]);
		for (const occurrence of [...occurrences].sort()) {
			const actualCount = actualItems.get(occurrence) ?? 0;
			const declaredCount = declaredItems.get(occurrence) ?? 0;
			for (let index = declaredCount; index < actualCount; index += 1) {
				errors.push(
					`Untracked ${label} debt in ${relative}: ${occurrence}`,
				);
			}
			for (let index = actualCount; index < declaredCount; index += 1) {
				errors.push(
					`Stale ${label} baseline debt in ${relative}: ${occurrence}`,
				);
			}
		}
	}
}

function compareLegacyToBase(declared, baseActual, label, errors) {
	const canonicalBase = canonicalizeOccurrences(baseActual);
	for (const [relative, occurrences] of declared) {
		const baseItems = canonicalBase.get(relative) ?? new Map();
		for (const [occurrence, count] of occurrences) {
			const baseCount =
				baseItems.get(canonicalOccurrence(occurrence)) ?? 0;
			for (let index = baseCount; index < count; index += 1) {
				errors.push(
					`Legacy ${label} baseline grew beyond base source debt in ${relative}: ${occurrence}`,
				);
			}
		}
	}
}

function canonicalOccurrence(occurrence) {
	const withoutComments = occurrence.replace(/\/\*[\s\S]*?\*\//gu, " ");
	const match = withoutComments.match(
		/^(.*?)\s*=>\s*([a-z-]+):(.*)!important$/iu,
	);
	if (!match) return normalizeWhitespace(withoutComments);
	const selector = normalizeWhitespace(match[1]).replace(
		/\s*([,>+~])\s*/gu,
		"$1",
	);
	const value = normalizeWhitespace(match[3])
		.replace(/\(\s+/gu, "(")
		.replace(/\s+\)/gu, ")")
		.replace(/\s*,\s*/gu, ",");
	return `${selector} => ${match[2].toLowerCase()}:${value}!important`;
}

function canonicalizeOccurrences(occurrencesByPath) {
	const result = new Map();
	for (const [relative, occurrences] of occurrencesByPath) {
		const canonical = new Map();
		for (const [occurrence, count] of occurrences) {
			const key = canonicalOccurrence(occurrence);
			canonical.set(key, (canonical.get(key) ?? 0) + count);
		}
		result.set(relative, canonical);
	}
	return result;
}

export function validateArchitectureSnapshot({
	currentSources,
	baseSources,
	baseline,
}) {
	const errors = [];
	if (baseline?.schema_version !== 2)
		errors.push(
			"Design-system architecture baseline must use schema_version 2",
		);

	if (
		![...currentSources.keys()].some((relative) =>
			relative.startsWith("ui/src/app/shared/"),
		)
	) {
		errors.push(
			"Reusable frontend primitives must have ui/src/app/shared ownership",
		);
	}
	for (const relative of currentSources.keys()) {
		if (
			relative.startsWith("ui/src/app/") &&
			relative.endsWith("/shared.module.ts")
		) {
			errors.push(
				`Standalone frontend architecture must not introduce a giant SharedModule: ${relative}`,
			);
		}
	}

	const currentUnits = styleUnits(currentSources, errors);
	const baseUnits = styleUnits(baseSources);
	for (const { relative, text } of currentUnits) {
		for (const [pattern, label, owner] of STYLE_OWNERS) {
			if (relative === owner) continue;
			pattern.lastIndex = 0;
			for (const match of text.matchAll(pattern)) {
				errors.push(
					`${label} must be defined only in ${owner}: ${relative} defines ${match[1]}`,
				);
			}
		}
	}

	const actual = scanDebt(currentUnits);
	const baseActual = scanDebt(baseUnits);
	const legacyImportant = baselineEntries(
		baseline,
		"legacy_debt",
		"important_declarations",
		errors,
	);
	const legacyMaterial = baselineEntries(
		baseline,
		"legacy_debt",
		"feature_material_internal_selectors",
		errors,
	);
	const integrationImportant = baselineEntries(
		baseline,
		"integration_exceptions",
		"important_declarations",
		errors,
	);
	const declaredImportant = addMaps(
		legacyImportant,
		integrationImportant,
		errors,
		"!important debt",
	);

	compareExact(actual.important, declaredImportant, "!important", errors);
	compareExact(
		actual.material,
		legacyMaterial,
		"feature Material-internal selector",
		errors,
	);
	compareLegacyToBase(
		legacyImportant,
		baseActual.important,
		"!important",
		errors,
	);
	compareLegacyToBase(
		legacyMaterial,
		baseActual.material,
		"feature Material-internal selector",
		errors,
	);
	return errors;
}

function walk(directory) {
	return fs
		.readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const fullPath = path.join(directory, entry.name);
			return entry.isDirectory() ? walk(fullPath) : [fullPath];
		});
}

function loadWorkingTreeSources(repoRoot) {
	const sourceRoot = path.join(repoRoot, "ui", "src");
	return new Map(
		walk(sourceRoot).map((file) => [
			path.relative(repoRoot, file).split(path.sep).join("/"),
			fs.readFileSync(file, "utf8"),
		]),
	);
}

function legacyPaths(baseline) {
	return new Set([
		...Object.keys(baseline?.legacy_debt?.important_declarations ?? {}),
		...Object.keys(
			baseline?.legacy_debt?.feature_material_internal_selectors ?? {},
		),
	]);
}

function gitText(repoRoot, args) {
	return execFileSync("git", args, {
		cwd: repoRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim();
}

function resolveBaseRef(repoRoot, explicitBaseRef) {
	if (explicitBaseRef) return explicitBaseRef;
	for (const candidate of ["origin/main", "main"]) {
		try {
			return gitText(repoRoot, ["merge-base", "HEAD", candidate]);
		} catch {
			// Try the next canonical main reference.
		}
	}
	throw new Error(
		"Design-system architecture check requires VOCORA_UI_BASE_SHA or a resolvable main branch",
	);
}

function loadBaseSources(repoRoot, baseRef, baseline) {
	const sources = new Map();
	for (const relative of legacyPaths(baseline)) {
		try {
			sources.set(
				relative,
				gitText(repoRoot, ["show", `${baseRef}:${relative}`]),
			);
		} catch {
			sources.set(relative, "");
		}
	}
	return sources;
}

export function validateRepository({ repoRoot, baseRef } = {}) {
	const root = normalizeRoot(repoRoot ?? new URL("../..", import.meta.url));
	const baseline = JSON.parse(
		fs.readFileSync(path.join(root, BASELINE_PATH), "utf8"),
	);
	const resolvedBaseRef = resolveBaseRef(root, baseRef);
	return validateArchitectureSnapshot({
		currentSources: loadWorkingTreeSources(root),
		baseSources: loadBaseSources(root, resolvedBaseRef, baseline),
		baseline,
	});
}
