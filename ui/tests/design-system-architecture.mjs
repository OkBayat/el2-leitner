import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const BASELINE_PATH = "ui/tests/design-system-architecture-baseline.json";
const STYLE_EXTENSIONS = new Set([".css", ".less", ".sass", ".scss"]);
const FOUNDATION_COLOR_OWNER = "ui/src/styles/_vocora-design-system.scss";
const CSS_NAMED_COLORS = new Set(
	("aliceblue antiquewhite aqua aquamarine azure beige bisque black " +
		"blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse " +
		"chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan " +
		"darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta " +
		"darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
		"darkslateblue darkslategray darkslategrey darkturquoise darkviolet " +
		"deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite " +
		"forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green " +
		"greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender " +
		"lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
		"lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon " +
		"lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue " +
		"lightyellow lime limegreen linen magenta maroon mediumaquamarine " +
		"mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue " +
		"mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
		"mistyrose moccasin navajowhite navy oldlace olive olivedrab orange " +
		"orangered orchid palegoldenrod palegreen paleturquoise palevioletred " +
		"papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red " +
		"rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell " +
		"sienna silver skyblue slateblue slategray slategrey snow springgreen " +
		"steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke " +
		"yellow yellowgreen").split(" "),
);
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
		FOUNDATION_COLOR_OWNER,
	],
];
const INTEGRATION_OWNERS = new Map([
	[
		"important_declarations",
		new Set([
			"ui/src/styles/_angular-material-components.scss",
			"ui/src/styles/_bootstrap-theme.scss",
		]),
	],
	[
		"raw_colors",
		new Set([
			"ui/src/pwa.scss",
		]),
	],
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
	const protect = (end, token = value.slice(index, end)) => {
		const marker = `__VOCORA_CSS_PROTECTED_${protectedTokens.length}__`;
		protectedTokens.push(token);
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
			const rawUrl = value.slice(index, end);
			const opening = rawUrl.indexOf("(");
			const normalizedUrl = rawUrl.endsWith(")")
				? `${rawUrl.slice(0, opening + 1)}${rawUrl.slice(opening + 1, -1).trim()})`
				: rawUrl;
			protect(end, normalizedUrl);
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

function maskCssSyntax(value, { lineComments = false } = {}) {
	const cleaned = value.split("");
	const syntax = value.split("");
	let index = 0;
	const maskRange = (target, start, end, replacement = " ") => {
		for (let position = start; position < end; position += 1) {
			if (target[position] !== "\n" && target[position] !== "\r") {
				target[position] = replacement;
			}
		}
	};

	while (index < value.length) {
		const character = value[index];
		if (["'", '"'].includes(character)) {
			const start = index;
			index += 1;
			let escaped = false;
			while (index < value.length) {
				const current = value[index];
				index += 1;
				if (!escaped && current === character) break;
				escaped = !escaped && current === "\\";
				if (current !== "\\") escaped = false;
			}
			maskRange(syntax, start, index, "_");
			continue;
		}

		const startsUrl =
			value.slice(index, index + 4).toLowerCase() === "url(" &&
			(index === 0 || !/[a-z0-9_-]/iu.test(value[index - 1]));
		if (startsUrl) {
			const start = index;
			index += 4;
			let depth = 1;
			let quote = null;
			let escaped = false;
			while (index < value.length && depth > 0) {
				const current = value[index];
				index += 1;
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
			maskRange(syntax, start, index, "_");
			continue;
		}

		if (character === "/" && value[index + 1] === "*") {
			const close = value.indexOf("*/", index + 2);
			const end = close < 0 ? value.length : close + 2;
			maskRange(cleaned, index, end);
			maskRange(syntax, index, end);
			index = end;
			continue;
		}
		if (lineComments && character === "/" && value[index + 1] === "/") {
			const newline = value.indexOf("\n", index + 2);
			const end = newline < 0 ? value.length : newline;
			maskRange(cleaned, index, end);
			maskRange(syntax, index, end);
			index = end;
			continue;
		}
		index += 1;
	}

	return { cleaned: cleaned.join(""), syntax: syntax.join("") };
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

function extractBracedImportantDeclarations(text, syntax = text) {
	const declarations = [];
	for (const match of syntax.matchAll(
		/([a-z-]+)\s*:\s*([^;{}]+?)\s*!important\b/dgiu,
	)) {
		const propertyName = text
			.slice(...match.indices[1])
			.trim()
			.toLowerCase();
		const value = text.slice(...match.indices[2]).trim();
		const blockStart = syntax.lastIndexOf("{", match.index);
		const previousBoundary = Math.max(
			syntax.lastIndexOf("{", blockStart - 1),
			syntax.lastIndexOf("}", blockStart - 1),
		);
		const selector = text.slice(previousBoundary + 1, blockStart).trim();
		declarations.push(`${selector} => ${propertyName}:${value}!important`);
	}
	return declarations;
}

function extractIndentedSassImportantDeclarations(text, syntax = text) {
	const declarations = [];
	const selectors = [];
	const textLines = text.split(/\r?\n/u);
	const syntaxLines = syntax.split(/\r?\n/u);
	for (const [lineIndex, line] of textLines.entries()) {
		const syntaxLine = syntaxLines[lineIndex] ?? "";
		const syntaxTrimmed = syntaxLine.trim();
		if (!syntaxTrimmed) continue;
		const indent = line.length - line.trimStart().length;
		const declaration = syntaxLine.match(
			/^\s*([a-z-]+)\s*:\s*(.+?)\s*!important\b/diu,
		);
		if (declaration) {
			while (selectors.length && selectors.at(-1).indent >= indent)
				selectors.pop();
			const selector = selectors.at(-1)?.text ?? "";
			const propertyName = line
				.slice(...declaration.indices[1])
				.trim()
				.toLowerCase();
			const value = line.slice(...declaration.indices[2]).trim();
			declarations.push(
				`${selector} => ${propertyName}:${value}!important`,
			);
			continue;
		}
		if (
			!syntaxTrimmed.startsWith("@") &&
			!/^[a-z-]+\s*:/iu.test(syntaxTrimmed)
		) {
			while (selectors.length && selectors.at(-1).indent >= indent)
				selectors.pop();
			selectors.push({ indent, text: line.trim() });
		}
	}
	return declarations;
}

export function extractImportantDeclarations(
	text,
	{ indentedSass = false, syntax = text } = {},
) {
	return indentedSass
		? extractIndentedSassImportantDeclarations(text, syntax)
		: extractBracedImportantDeclarations(text, syntax);
}

export function extractMaterialInternalSelectors(
	text,
	{ indentedSass = false, syntax = text } = {},
) {
	if (indentedSass) {
		const textLines = text.split(/\r?\n/u);
		return syntax
			.split(/\r?\n/u)
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => /\.mat-mdc-[a-z0-9_-]+/iu.test(line))
			.map(({ index }) => textLines[index].trim());
	}
	return [...syntax.matchAll(/([^{}]+)\{/dgu)]
		.filter((match) => /\.mat-mdc-[a-z0-9_-]+/iu.test(match[1]))
		.map((match) => text.slice(...match.indices[1]).trim());
}

export function extractRawColors(syntax) {
	const colors = [
		...syntax.matchAll(
			/#[0-9a-f]{3,8}\b|\b(?:color|hsl|hsla|hwb|lab|lch|oklab|oklch|rgb|rgba)\([^)]*\)/giu,
		),
	]
		.map((match) => normalizeWhitespace(match[0]).toLowerCase())
		.filter((value) => !/\bvar\(/iu.test(value));
	for (const match of syntax.matchAll(/(--[a-z0-9-]+|[a-z-]+)\s*:\s*([^;{}]+)/giu)) {
		const property = match[1].toLowerCase();
		if (
			!property.startsWith("--") &&
			!/^(?:accent-color|background(?:-color)?|border(?:-[a-z-]+)?|box-shadow|caret-color|color|fill|outline(?:-color)?|stroke|text-shadow)$/u.test(property)
		) {
			continue;
		}
		const literalValue = match[2]
			.replace(/var\([^)]*\)/giu, "")
			.replace(/\$[a-z0-9_-]+/giu, "");
		for (const word of literalValue.toLowerCase().match(/[a-z]+/gu) ?? []) {
			if (CSS_NAMED_COLORS.has(word)) colors.push(word);
		}
	}
	return colors;
}

export function extractThemeSelectors(
	text,
	syntax = text,
	{ indentedSass = false } = {},
) {
	if (indentedSass) {
		const textLines = text.split(/\r?\n/u);
		return syntax
			.split(/\r?\n/u)
			.map((line, index) => ({ line, index }))
			.filter(({ line }) => /\[data-theme\s*=/iu.test(line))
			.flatMap(({ index }) => [
				...textLines[index].matchAll(
					/\[data-theme\s*=\s*(?:"[^"]+"|'[^']+'|[a-z-]+)\]/giu,
				),
			])
			.map((match) => normalizeWhitespace(match[0]));
	}
	return [...syntax.matchAll(/([^{}]+)\{/dgu)]
		.filter((match) => /\[data-theme\s*=/iu.test(match[1]))
		.flatMap((match) => [
			...text
				.slice(...match.indices[1])
				.matchAll(/\[data-theme\s*=\s*(?:"[^"]+"|'[^']+'|[a-z-]+)\]/giu),
		])
		.map((match) => normalizeWhitespace(match[0]));
}

function extractTemplateStyles(text) {
	const withoutComments = text.replace(/<!--[\s\S]*?-->/gu, "");
	const styles = [
		...[...withoutComments.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/giu)]
			.map((match) => match[1]),
		...[...withoutComments.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/giu)]
			.map((match) => match[2]),
	];
	for (const match of withoutComments.matchAll(
		/\b(fill|stroke|color|bgcolor)\s*=\s*(["'])([\s\S]*?)\2/giu,
	)) {
		styles.push(`${match[1]}: ${match[3]};`);
	}
	return styles.join("\n");
}

function styleUnits(sources, errors) {
	const units = [];
	for (const [relative, text] of sources) {
		const extension = path.extname(relative).toLowerCase();
		if (STYLE_EXTENSIONS.has(extension)) {
			const views = maskCssSyntax(text, {
				lineComments: [".less", ".sass", ".scss"].includes(extension),
			});
			units.push({
				relative,
				text: views.cleaned,
				syntax: views.syntax,
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
			if (inlineStyles.length) {
				const views = maskCssSyntax(inlineStyles.join("\n"));
				units.push({
					relative,
					text: views.cleaned,
					syntax: views.syntax,
					indentedSass: false,
				});
			}
		} else if (extension === ".html") {
			const templateStyles = extractTemplateStyles(text);
			if (templateStyles) {
				const views = maskCssSyntax(templateStyles);
				units.push({
					relative,
					text: views.cleaned,
					syntax: views.syntax,
					indentedSass: false,
				});
			}
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
	const rawColors = new Map();
	const themeSelectors = new Map();
	for (const { relative, text, syntax, indentedSass } of units) {
		for (const occurrence of extractImportantDeclarations(text, {
			indentedSass,
			syntax,
		})) {
			increment(important, relative, occurrence);
		}
		if (relative.startsWith("ui/src/app/")) {
			for (const occurrence of extractMaterialInternalSelectors(text, {
				indentedSass,
				syntax,
			})) {
				increment(material, relative, occurrence);
			}
		}
		if (relative !== FOUNDATION_COLOR_OWNER) {
			for (const occurrence of extractRawColors(syntax)) {
				increment(rawColors, relative, occurrence);
			}
			for (const occurrence of extractThemeSelectors(text, syntax, {
				indentedSass,
			})) {
				increment(themeSelectors, relative, occurrence);
			}
		}
	}
	return { important, material, rawColors, themeSelectors };
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
			if (!INTEGRATION_OWNERS.get(category)?.has(relative)) {
				errors.push(
					`Integration exception owner ${relative} is not approved for ${category}`,
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
		normalizeWhitespace(unprotected)
			.replace(/\s*([,>+~])\s*/gu, "$1")
			.replace(/\(\s+/gu, "(")
			.replace(/\s+\)/gu, ")"),
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
	if (baseline?.schema_version !== 3)
		errors.push(
			"Design-system architecture baseline must use schema_version 3",
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
	for (const { relative, syntax } of currentUnits) {
		for (const [pattern, label, owner] of STYLE_OWNERS) {
			if (relative === owner) continue;
			pattern.lastIndex = 0;
			for (const match of syntax.matchAll(pattern)) {
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
	const legacyRawColors = baselineEntries(
		baseline,
		"legacy_debt",
		"raw_colors",
		errors,
	);
	const legacyThemeSelectors = baselineEntries(
		baseline,
		"legacy_debt",
		"theme_selectors",
		errors,
	);
	const integrationImportant = baselineEntries(
		baseline,
		"integration_exceptions",
		"important_declarations",
		errors,
	);
	const integrationRawColors = baselineEntries(
		baseline,
		"integration_exceptions",
		"raw_colors",
		errors,
	);
	const declaredImportant = addMaps(
		legacyImportant,
		integrationImportant,
		errors,
		"!important debt",
	);
	const declaredRawColors = addMaps(
		legacyRawColors,
		integrationRawColors,
		errors,
		"raw color debt",
	);

	compareExact(actual.important, declaredImportant, "!important", errors);
	compareExact(
		actual.material,
		legacyMaterial,
		"feature Material-internal selector",
		errors,
	);
	compareExact(actual.rawColors, declaredRawColors, "raw color", errors);
	compareExact(
		actual.themeSelectors,
		legacyThemeSelectors,
		"local theme-selector",
		errors,
	);
	compareLegacyToBase(
		legacyImportant,
		baseActual.important,
		"!important",
		errors,
	);
	compareLegacyToBase(
		legacyRawColors,
		baseActual.rawColors,
		"raw color",
		errors,
	);
	compareLegacyToBase(
		legacyThemeSelectors,
		baseActual.themeSelectors,
		"local theme-selector",
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
		...Object.keys(baseline?.legacy_debt?.raw_colors ?? {}),
		...Object.keys(baseline?.legacy_debt?.theme_selectors ?? {}),
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
