import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

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

function transformCssOutsideProtected(
	value,
	transform,
	{ lineComments = true } = {},
) {
	const protectedTokens = [];
	let unprotected = "";
	let index = 0;
	const protect = (end) => {
		const marker = `__VOCORA_CSS_PROTECTED_${protectedTokens.length}__`;
		protectedTokens.push(value.slice(index, end));
		unprotected += marker;
		index = end;
	};

	while (index < value.length) {
		const character = value[index];
		if (["'", '"'].includes(character)) {
			let end = index + 1;
			let escaped = false;
			while (end < value.length) {
				const current = value[end];
				end += 1;
				if (!escaped && current === character) break;
				escaped = !escaped && current === "\\";
				if (current !== "\\") escaped = false;
			}
			protect(end);
			continue;
		}
		const startsUrl =
			value.slice(index, index + 4).toLowerCase() === "url(" &&
			(index === 0 || !/[a-z0-9_-]/iu.test(value[index - 1]));
		if (startsUrl) {
			let end = index + 4;
			let depth = 1;
			let quote = null;
			let escaped = false;
			while (end < value.length && depth > 0) {
				const current = value[end];
				end += 1;
				if (escaped) {
					escaped = false;
					continue;
				}
				if (current === "\\") {
					escaped = true;
					continue;
				}
				if (quote) {
					if (current === quote) quote = null;
					continue;
				}
				if (["'", '"'].includes(current)) quote = current;
				else if (current === "(") depth += 1;
				else if (current === ")") depth -= 1;
			}
			protect(end);
			continue;
		}
		if (character === "/" && value[index + 1] === "*") {
			const close = value.indexOf("*/", index + 2);
			index = close < 0 ? value.length : close + 2;
			continue;
		}
		if (lineComments && character === "/" && value[index + 1] === "/") {
			const newline = value.indexOf("\n", index + 2);
			index = newline < 0 ? value.length : newline;
			continue;
		}
		unprotected += character;
		index += 1;
	}

	let result = transform(unprotected);
	for (const [tokenIndex, token] of protectedTokens.entries()) {
		result = result.replace(
			`__VOCORA_CSS_PROTECTED_${tokenIndex}__`,
			token,
		);
	}
	return result;
}

function stripCssComments(value, options) {
	return transformCssOutsideProtected(
		value,
		(unprotected) => unprotected,
		options,
	);
}

function extractInlineStyleMetadata(text) {
	const source = ts.createSourceFile(
		"component.ts",
		text,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const styles = [];
	let unsupported = 0;
	const componentNames = new Set(["Component"]);
	const angularNamespaces = new Set();
	for (const statement of source.statements) {
		if (
			!ts.isImportDeclaration(statement) ||
			!ts.isStringLiteral(statement.moduleSpecifier) ||
			statement.moduleSpecifier.text !== "@angular/core"
		) {
			continue;
		}
		const bindings = statement.importClause?.namedBindings;
		if (bindings && ts.isNamespaceImport(bindings)) {
			angularNamespaces.add(bindings.name.text);
		} else if (bindings && ts.isNamedImports(bindings)) {
			for (const element of bindings.elements) {
				if (
					(element.propertyName ?? element.name).text === "Component"
				) {
					componentNames.add(element.name.text);
				}
			}
		}
	}

	function literalValue(node) {
		return ts.isStringLiteral(node) ||
			ts.isNoSubstitutionTemplateLiteral(node)
			? node.text
			: null;
	}

	function visit(node) {
		const decoratorTarget =
			ts.isDecorator(node) && ts.isCallExpression(node.expression)
				? node.expression.expression
				: null;
		const isComponentDecorator =
			(decoratorTarget &&
				ts.isIdentifier(decoratorTarget) &&
				componentNames.has(decoratorTarget.text)) ||
			(decoratorTarget &&
				ts.isPropertyAccessExpression(decoratorTarget) &&
				ts.isIdentifier(decoratorTarget.expression) &&
				angularNamespaces.has(decoratorTarget.expression.text) &&
				decoratorTarget.name.text === "Component");
		if (
			isComponentDecorator &&
			ts.isCallExpression(node.expression) &&
			node.expression.arguments.length > 0
		) {
			const metadata = node.expression.arguments[0];
			if (!metadata || !ts.isObjectLiteralExpression(metadata)) {
				unsupported += 1;
			} else {
				for (const property of metadata.properties) {
					if (ts.isSpreadAssignment(property)) {
						unsupported += 1;
						continue;
					}
					if (
						ts.isShorthandPropertyAssignment(property) &&
						property.name.text === "styles"
					) {
						unsupported += 1;
						continue;
					}
					if (
						"name" in property &&
						ts.isComputedPropertyName(property.name)
					) {
						unsupported += 1;
						continue;
					}
					if (!ts.isPropertyAssignment(property)) continue;
					const name = property.name;
					const isStyles =
						(ts.isIdentifier(name) || ts.isStringLiteral(name)) &&
						name.text === "styles";
					if (!isStyles) continue;

					const scalar = literalValue(property.initializer);
					if (scalar !== null) {
						styles.push(scalar);
						continue;
					}
					if (ts.isArrayLiteralExpression(property.initializer)) {
						const values =
							property.initializer.elements.map(literalValue);
						if (values.every((value) => value !== null)) {
							styles.push(...values);
							continue;
						}
					}
					unsupported += 1;
				}
			}
		}
		ts.forEachChild(node, visit);
	}
	visit(source);
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
			units.push({
				relative,
				text: stripCssComments(text, {
					lineComments:
						extension === ".sass" || extension === ".scss",
				}),
				indentedSass: extension === ".sass",
			});
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
					text: stripCssComments(inlineStyles.join("\n"), {
						lineComments: false,
					}),
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
	const canonicalActual = canonicalizeOccurrences(actual);
	const canonicalDeclared = canonicalizeOccurrences(declared);
	const paths = new Set([
		...canonicalActual.keys(),
		...canonicalDeclared.keys(),
	]);
	for (const relative of [...paths].sort()) {
		const actualItems = canonicalActual.get(relative) ?? new Map();
		const declaredItems = canonicalDeclared.get(relative) ?? new Map();
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
	const separator = occurrence.indexOf(" => ");
	if (separator < 0) return canonicalSelector(occurrence);
	const selector = canonicalSelector(occurrence.slice(0, separator));
	const declaration = occurrence.slice(separator + 4);
	const match = declaration.match(
		/^([a-z-]+)\s*:\s*([\s\S]*?)\s*!important$/iu,
	);
	if (!match) return canonicalSelector(occurrence);
	const value = transformCssOutsideProtected(match[2], (unprotected) =>
		normalizeWhitespace(unprotected)
			.replace(/\(\s+/gu, "(")
			.replace(/\s+\)/gu, ")")
			.replace(/\s*,\s*/gu, ","),
	);
	return `${selector} => ${match[1].toLowerCase()}:${value}!important`;
}

function canonicalSelector(selector) {
	return transformCssOutsideProtected(selector, (unprotected) =>
		normalizeWhitespace(unprotected).replace(/\s*([,>+~])\s*/gu, "$1"),
	);
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
