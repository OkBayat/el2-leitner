import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(testDir, "..");
const theme = fs.readFileSync(
	path.join(uiRoot, "src", "styles", "_angular-material-theme.scss"),
	"utf8",
);
const components = fs.readFileSync(
	path.join(uiRoot, "src", "styles", "_angular-material-components.scss"),
	"utf8",
);
const buttonStyles = fs.readFileSync(
	path.join(uiRoot, "src", "app", "shared", "voco-button", "voco-button.component.scss"),
	"utf8",
);
const buttonTemplate = fs.readFileSync(
	path.join(uiRoot, "src", "app", "shared", "voco-button", "voco-button.component.html"),
	"utf8",
);
const styles = fs.readFileSync(path.join(uiRoot, "src", "styles.scss"), "utf8");
const designSystem = fs.readFileSync(
	path.join(uiRoot, "src", "styles", "_vocora-design-system.scss"),
	"utf8",
);
const referenceTokens = JSON.parse(
	fs.readFileSync(
		path.join(
			uiRoot,
			"..",
			".agents",
			"skills",
			"k2-design-system",
			"references",
			"tokens.json",
		),
		"utf8",
	),
);
const exerciseAction = fs.readFileSync(
	path.join(
		uiRoot,
		"src",
		"app",
		"shared",
		"slide-exercise",
		"slide-exercise-action.component.scss",
	),
	"utf8",
);
const exerciseFooter = fs.readFileSync(
	path.join(
		uiRoot,
		"src",
		"app",
		"shared",
		"slide-exercise",
		"slide-exercise-footer.component.scss",
	),
	"utf8",
);
const exerciseFooterTemplate = fs.readFileSync(
	path.join(
		uiRoot,
		"src",
		"app",
		"shared",
		"slide-exercise",
		"slide-exercise-footer.component.html",
	),
	"utf8",
);

const expectedMappings = new Map([
	["primary", "primary"],
	["on-primary", "text-on-primary"],
	["primary-container", "state-primary-surface"],
	["on-primary-container", "state-primary-foreground"],
	["inverse-primary", "inverse-primary"],
	["secondary", "secondary"],
	["on-secondary", "text-on-secondary"],
	["secondary-container", "surface-subtle"],
	["on-secondary-container", "text-primary"],
	["tertiary", "information"],
	["on-tertiary", "text-on-primary"],
	["tertiary-container", "state-information-surface"],
	["on-tertiary-container", "state-information-foreground"],
	["error", "error"],
	["on-error", "text-on-error"],
	["error-container", "state-error-surface"],
	["on-error-container", "state-error-foreground"],
	["surface", "surface-page"],
	["on-surface", "text-primary"],
	["on-surface-variant", "text-secondary"],
	["surface-bright", "surface-base"],
	["surface-container", "surface-raised"],
	["surface-container-high", "surface-subtle"],
	["surface-container-highest", "surface-subtle"],
	["surface-container-low", "surface-base"],
	["surface-container-lowest", "surface-base"],
	["surface-dim", "surface-subtle"],
	["surface-tint", "primary"],
	["surface-variant", "surface-subtle"],
	["inverse-surface", "surface-inverse"],
	["inverse-on-surface", "text-on-inverse"],
	["background", "surface-page"],
	["on-background", "text-primary"],
	["neutral-variant20", "text-secondary"],
	["neutral10", "text-primary"],
	["outline", "border"],
	["outline-variant", "border-subtle"],
	["scrim", "scrim"],
	["shadow", "shadow"],
]);

for (const [token, vocoraToken] of expectedMappings) {
	assert.match(
		theme,
		new RegExp(`--mat-sys-${token}:\\s*var\\(--vocora-${vocoraToken}\\);`),
		`Material token ${token} must map to Vocora ${vocoraToken}.`,
	);
}

assert.doesNotMatch(
	theme,
	/#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/iu,
	"Angular Material theme adapter must not own raw colors.",
);
assert.doesNotMatch(
	theme,
	/--(?:mdc|mat-(?!sys-))[^:]+:/u,
	"Component-specific Material color overrides must not live in the system color adapter.",
);
assert.doesNotMatch(
	theme,
	/\.mat-mdc-/u,
	"Material component geometry must live outside the semantic adapter.",
);
assert.doesNotMatch(
	theme,
	/--mat-sys-[a-z-]*fixed(?:-dim|-variant)?:/u,
	"Theme-changing Vocora roles must not override Material fixed-color roles.",
);
const materialDefinitionOwners = fs.readdirSync(path.join(uiRoot, "src", "styles"))
	.filter((name) => name.endsWith(".scss"))
	.filter((name) =>
		/--mat-sys-[a-z0-9-]+\s*:/iu.test(
			fs.readFileSync(path.join(uiRoot, "src", "styles", name), "utf8"),
		),
	);
assert.deepEqual(
	materialDefinitionOwners,
	["_angular-material-theme.scss"],
	"The Material adapter must be the only application-owned Material system-token owner.",
);
assert.match(
	designSystem,
	/--color-neutral-black:\s*#000000;[\s\S]*--vocora-shadow:\s*var\(--color-neutral-black\);/iu,
	"Shared shadow/scrim color must live in the Vocora design system.",
);
assert.doesNotMatch(
	styles,
	/angular-material-defaults/u,
	"Legacy Angular Material color defaults must not remain wired into global styles.",
);
assert.ok(
	styles.indexOf("@include angular-material-theme.apply();") >
		styles.indexOf("@include mat.theme(("),
	"Vocora Angular Material color overrides must be applied after the base Material theme.",
);
assert.ok(
	styles.indexOf("@include vocora-design-system.apply();") >= 0 &&
		styles.indexOf("@include vocora-design-system.apply();") <
			styles.indexOf("@include angular-material-theme.apply();"),
	"The Material adapter must be applied after the Vocora semantic layer.",
);
assert.match(
	styles,
	/@use '\.\/styles\/angular-material-components' as angular-material-components;/u,
);
assert.ok(
	styles.indexOf("@include angular-material-components.apply();") >
		styles.indexOf("@include angular-material-theme.apply();"),
	"Shared Material component styles must be applied after semantic Material colors.",
);
const semanticSection = designSystem.split("// Layer B: Vocora semantic tokens")[1];
assert.ok(semanticSection, "The runtime token source must identify its semantic layer.");
assert.doesNotMatch(
	semanticSection,
	/#[0-9a-f]{3,8}\b|\brgba?\(|:\s*\d+\s*,\s*\d+\s*,\s*\d+/iu,
	"Semantic tokens must derive from the canonical foundation layer rather than own raw colors.",
);
for (const semanticToken of [
	"surface-page",
	"surface-base",
	"surface-raised",
	"surface-subtle",
	"surface-inverse",
	"text-primary",
	"text-secondary",
	"text-disabled",
	"border",
	"border-subtle",
	"border-strong",
	"border-disabled",
	"primary",
	"secondary",
	"success",
	"information",
	"warning",
	"error",
	"focus-ring",
]) {
	assert.equal(
		(designSystem.match(new RegExp(`--vocora-${semanticToken}:`, "gu")) ?? []).length,
		2,
		`Vocora ${semanticToken} must have light and dark definitions.`,
	);
}

function declarations(source) {
	return new Map(
		[...source.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/giu)].map(
			([, name, value]) => [name, value.trim()],
		),
	);
}

function themeBlock(themeName) {
	const pattern = themeName === "light"
		? /:root,\s*html\[data-theme="light"\]\s*\{([\s\S]*?)\n\t\}/u
		: /html\[data-theme="dark"\]\s*\{([\s\S]*?)\n\t\}/u;
	const match = designSystem.match(pattern);
	assert.ok(match, `Runtime design system must define the ${themeName} theme.`);
	return match[1];
}

const foundation = declarations(
	designSystem.split("// Layer B: Vocora semantic tokens")[0],
);
const toKebab = (value) => value.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`);
const runtimeTokenName = (group, key) => {
	if (group === "border" && key === "default") return "--vocora-border";
	if (group === "semantic") return `--vocora-${toKebab(key)}`;
	return `--vocora-${group}-${toKebab(key)}`;
};

for (const themeName of ["light", "dark"]) {
	const semantic = declarations(themeBlock(themeName));
	const allDeclarations = new Map([...foundation, ...semantic]);
	const resolve = (name, seen = new Set()) => {
		assert.ok(!seen.has(name), `Token reference cycle detected at ${name}.`);
		const value = allDeclarations.get(name);
		assert.ok(value, `Runtime token ${name} is required by the reference mirror.`);
		const reference = value.match(/^var\((--[a-z0-9-]+)\)$/iu);
		return reference ? resolve(reference[1], new Set([...seen, name])) : value.toUpperCase();
	};

	for (const [group, values] of Object.entries(referenceTokens.themes[themeName])) {
		for (const [key, expected] of Object.entries(values)) {
			assert.equal(
				resolve(runtimeTokenName(group, key)),
				expected,
				`Runtime ${themeName} ${group}.${key} must match tokens.json.`,
			);
		}
	}

	const hexToRgb = (hex) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
	const relativeLuminance = (hex) => {
		const channels = hexToRgb(hex).map((channel) => {
			const normalized = channel / 255;
			return normalized <= 0.04045
				? normalized / 12.92
				: ((normalized + 0.055) / 1.055) ** 2.4;
		});
		return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
	};
	const contrastRatio = (first, second) => {
		const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
		const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
		return (lighter + 0.05) / (darker + 0.05);
	};
	const inverseSurface = resolve("--vocora-surface-inverse");
	const inversePrimary = resolve("--vocora-inverse-primary");
	assert.ok(
		contrastRatio(inverseSurface, inversePrimary) >= 4.5,
		`${themeName} inverse-primary must meet 4.5:1 contrast on inverse-surface.`,
	);
	assert.ok(
		contrastRatio(
			resolve("--vocora-state-primary-surface"),
			resolve("--vocora-text-primary"),
		) >= 4.5,
		`${themeName} primary state surfaces must remain readable with primary text.`,
	);
	for (const intent of ["success", "warning", "error"]) {
		assert.ok(
			contrastRatio(
				resolve(`--vocora-state-${intent}-icon`),
				resolve(`--vocora-state-${intent}-icon-foreground`),
			) >= 3,
			`${themeName} ${intent} feedback icons must meet 3:1 graphical contrast.`,
		);
	}
}

assert.doesNotMatch(
	components,
	/\.mat-mdc-icon-button\s*\{[\s\S]*?vertical-align:\s*middle;/u,
	"Material component integration must not add unowned global icon-button geometry.",
);
assert.match(buttonTemplate, /mat-flat-button/u);
assert.match(
	buttonStyles,
	/--mat-button-filled-container-color:\s*var\(--voco-button-background\);/u,
);
assert.match(
	buttonStyles,
	/--mat-button-filled-label-text-color:\s*var\(--voco-button-foreground\);/u,
);
assert.doesNotMatch(buttonStyles, /--mdc-filled-button-/u);
assert.match(
	buttonStyles,
	/\.voco-button:not\(:disabled\):active/u,
	"The shared button must own its pressed interaction.",
);
assert.match(
	buttonStyles,
	/\.voco-icon-button\s*\{[^}]*display:\s*inline-grid;[^}]*place-items:\s*center;/u,
	"The shared secondary icon button must center its Material icon.",
);
assert.match(
	buttonStyles,
	/\.voco-icon-button--secondary\s*\{[^}]*--mat-icon-button-icon-color:\s*var\(--vocora-action-secondary-foreground\);/u,
	"The shared secondary icon button must map its Material icon color to the Vocora secondary action token.",
);
assert.match(
	buttonStyles,
	/\.voco-icon-button\s*\{/u,
	"Plain Material icon actions must have one reusable central variant.",
);
assert.match(
	buttonStyles,
	/\.voco-icon-button--primary\b/u,
	"Filled primary Material icon actions must have one reusable central variant.",
);
assert.match(theme, /--mat-sys-error-container:\s*var\(--vocora-state-error-surface\);/u);
assert.match(designSystem, /--color-eager-green:\s*#58cc02;/iu);
assert.match(designSystem, /--color-spark-blue:\s*#1cb0f6;/iu);
assert.match(designSystem, /--color-paper-white:\s*#ffffff;/iu);
assert.match(designSystem, /--color-charcoal:\s*#4b4b4b;/iu);
assert.match(designSystem, /--color-pencil-gray:\s*#777777;/iu);
assert.match(designSystem, /--color-faded-gray:\s*#afafaf;/iu);
assert.match(
	designSystem,
	/--vocora-primary:\s*var\(--color-spark-blue\);[\s\S]*--vocora-action-primary:\s*var\(--vocora-primary\);/iu,
);
assert.match(
	designSystem,
	/--vocora-success:\s*var\(--color-eager-green\);[\s\S]*--vocora-action-success:\s*var\(--vocora-success\);/iu,
	"Success actions must retain the canonical Eager Green role.",
);
assert.match(
	designSystem,
	/html\[data-theme=["']dark["']\][^{]*\{[^}]*--vocora-primary:\s*var\(--color-dark-primary\);[^}]*--vocora-success:\s*var\(--color-dark-success\);[^}]*--vocora-action-primary:\s*var\(--vocora-primary\);[^}]*--vocora-action-success:\s*var\(--vocora-success\);/iu,
	"The new button language must define independently tuned dark-theme actions.",
);
assert.match(
	designSystem,
	/--vocora-action-secondary-foreground:\s*var\(--color-charcoal\);/iu,
	"Light secondary buttons must use the canonical Charcoal label color.",
);
assert.match(designSystem, /--color-button-disabled-gray:\s*#d9d9d9;/iu);
assert.match(designSystem, /--color-button-border-gray:\s*#e5e5e5;/iu);
assert.match(designSystem, /--vocora-action-secondary-border:\s*var\(--color-button-border-gray\);/iu);
assert.match(designSystem, /--vocora-action-secondary-disabled-foreground:\s*var\(--color-button-disabled-gray\);/iu);
assert.match(designSystem, /--vocora-action-disabled-background:\s*var\(--color-button-disabled-gray\);/iu);
assert.match(designSystem, /--vocora-action-disabled-foreground:\s*var\(--color-pencil-gray\);/iu);
assert.match(
	designSystem,
	/html\[data-theme=["']dark["']\][^{]*\{[^}]*--vocora-action-secondary:\s*var\(--color-paper-white\);[^}]*--vocora-action-secondary-foreground:\s*var\(--color-charcoal\);/iu,
	"Dark secondary buttons must preserve the white surface and Charcoal label pairing.",
);
assert.match(designSystem, /--vocora-error:\s*var\(--color-answer-red\);/iu);
assert.match(designSystem, /--vocora-information-surface:\s*var\(--vocora-state-information-surface\);/iu);

for (const intent of ["primary", "secondary", "success", "warning", "error"]) {
	assert.match(
		buttonStyles,
		new RegExp(`\\.voco-button--${intent}\\b`),
		`voco button intent '${intent}' must have a shared modifier class.`,
	);
}

for (const [intent, token] of [
	["primary", "primary"],
	["secondary", "secondary"],
	["success", "success"],
	["warning", "warning"],
	["error", "error"],
]) {
	assert.match(
		buttonStyles,
		new RegExp(
			`\\.voco-button--${intent}\\s*\\{[^}]*--voco-button-default-background:\\s*var\\(--vocora-action-${token}\\);`,
			"u",
		),
		`voco button intent '${intent}' must map to its semantic background token.`,
	);
}

for (const token of ["disabled-background", "disabled-foreground"]) {
	assert.match(
		designSystem,
		new RegExp(
			`--vocora-action-${token}:\\s*var\\(--color-[^)]+\\);`,
			"iu",
		),
		`Button token '${token}' must exist in the product design system.`,
	);
}

assert.equal(
	[
		...designSystem.matchAll(
			/--vocora-action-warning-foreground:\s*var\(--(?:vocora-text-on-strong|color-paper-white)\);/gu,
		),
	].length,
	2,
	"Warning actions must use white labels in both light and dark themes.",
);

assert.match(
	buttonStyles,
	/\.voco-button,\s*\.voco-audio-button\s*\{[^}]*min-height:\s*44px;[^}]*height:\s*auto;/u,
	"All textual voco buttons must allow wrapped labels while preserving the minimum touch target.",
);
assert.match(
	buttonStyles,
	/border-radius:\s*var\(--vocora-radius-button\);/u,
	"voco action buttons must use the shared 13px radius token.",
);
assert.match(
	buttonStyles,
	/box-shadow:\s*0 4px 0/u,
	"Enabled voco buttons must use the canonical four-pixel lower edge.",
);
assert.match(
	buttonStyles,
	/\.voco-button--secondary\s*\{[^}]*--voco-button-default-border-width:\s*2px;/u,
	"Secondary buttons must keep the canonical two-pixel border.",
);
assert.match(
	buttonStyles,
	/\.voco-button:disabled,[\s\S]*?\.voco-audio-button:disabled\s*\{[^}]*box-shadow:\s*none;[^}]*transform:\s*translateY\(4px\);/u,
	"Disabled voco buttons must remove the lower edge within the preserved footprint.",
);
assert.match(
	buttonStyles,
	/transition:\s*none;/u,
	"Textual voco buttons must not animate any visual property.",
);
assert.match(
	buttonStyles,
	/\.voco-button--secondary\s*\{[^}]*--voco-button-default-border:\s*var\(--vocora-action-secondary-border\);/u,
	"Secondary buttons must use the canonical outlined treatment.",
);
assert.doesNotMatch(
	components,
	/\.mat-mdc-outlined-button:not\(:disabled\)\s*\{/u,
	"Bare enabled Material outlined buttons must retain their original Material text color.",
);
assert.doesNotMatch(
	components,
	/\.mat-mdc-outlined-button\s*\{[^}]*background\s*:/u,
	"Bare Material outlined buttons must retain their original Material background.",
);
assert.doesNotMatch(
	components,
	/\.mat-mdc-outlined-button:disabled\s*\{/u,
	"Bare disabled Material outlined buttons must retain their original Material colors.",
);
assert.match(
	buttonStyles,
	/--mat-button-filled-disabled-container-color:\s*var\(--voco-button-disabled-background\);/u,
	"Every button intent must inherit a deterministic disabled treatment.",
);
assert.match(
	exerciseAction,
	/\.slide-exercise-action\[data-state=["']primary["']\][^{]*\{[^}]*--vocora-component-action-foreground:\s*var\(\s*--vocora-action-primary-foreground\s*\);/u,
	"Exercise primary actions must use the canonical button foreground token.",
);
assert.match(
	exerciseAction,
	/\.slide-exercise-action__spinner\s*\{[^}]*display:\s*inline-block;[^}]*width:\s*16px;[^}]*height:\s*16px;/u,
	"Exercise action loading indicators must retain their circular box instead of collapsing into a line beside the label.",
);
assert.doesNotMatch(
	exerciseFooter,
	/data-tone='error'[^}]*\.slide-exercise-action/u,
	"Error feedback must not override the primary action colors.",
);
assert.match(
	exerciseFooter,
	/\.slide-exercise-footer__copy span\s*\{[^}]*color:\s*var\(--slide-exercise-footer-accent\);/u,
	"Feedback detail text must inherit the semantic event color.",
);
assert.match(
	exerciseFooterTemplate,
	/@case \('success'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[^>]*fill="var\(--vocora-state-success-icon\)"[\s\S]*?<path[^>]*d="M10\.5 15\.5L14 19\.5L21 12"[^>]*stroke="var\(--vocora-state-success-icon-foreground\)"[^>]*stroke-width="3"/u,
	"Successful feedback must use the rounded check SVG and theme-aware success icon role.",
);
assert.match(
	exerciseFooterTemplate,
	/@case \('error'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[^>]*fill="var\(--vocora-state-error-icon\)"[\s\S]*?<path[^>]*d="M10\.5 10\.5L19\.5 19\.5M19\.5 10\.5L10\.5 19\.5"[^>]*stroke="var\(--vocora-state-error-icon-foreground\)"[^>]*stroke-width="3"/u,
	"Incorrect feedback must use a matching rounded cross SVG at 35px.",
);
assert.match(
	exerciseFooterTemplate,
	/@case \('warning'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[^>]*fill="var\(--vocora-state-warning-icon\)"[\s\S]*?<path[^>]*stroke="var\(--vocora-state-warning-icon-foreground\)"[^>]*stroke-width="3"/u,
	"Warning feedback must use a matching rounded SVG at 35px.",
);
assert.doesNotMatch(
	exerciseFooterTemplate,
	/<span>[✓×!]<\/span>/u,
	"Semantic feedback must not fall back to text glyph icons.",
);

console.log("Angular Material theme contract passed.");
