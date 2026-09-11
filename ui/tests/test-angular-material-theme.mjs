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
const styles = fs.readFileSync(path.join(uiRoot, "src", "styles.scss"), "utf8");
const designSystem = fs.readFileSync(
	path.join(uiRoot, "src", "styles", "_vocora-design-system.scss"),
	"utf8",
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

const expectedTokens = [
	"primary",
	"on-primary",
	"primary-container",
	"on-primary-container",
	"primary-fixed",
	"on-primary-fixed",
	"on-primary-fixed-variant",
	"primary-fixed-dim",
	"inverse-primary",
	"secondary",
	"on-secondary",
	"secondary-container",
	"on-secondary-container",
	"secondary-fixed",
	"on-secondary-fixed",
	"on-secondary-fixed-variant",
	"secondary-fixed-dim",
	"tertiary",
	"on-tertiary",
	"tertiary-container",
	"on-tertiary-container",
	"tertiary-fixed",
	"on-tertiary-fixed",
	"on-tertiary-fixed-variant",
	"tertiary-fixed-dim",
	"error",
	"on-error",
	"error-container",
	"on-error-container",
	"surface",
	"on-surface",
	"on-surface-variant",
	"surface-bright",
	"surface-container",
	"surface-container-high",
	"surface-container-highest",
	"surface-container-low",
	"surface-container-lowest",
	"surface-dim",
	"surface-tint",
	"surface-variant",
	"inverse-surface",
	"inverse-on-surface",
	"background",
	"on-background",
	"neutral-variant20",
	"neutral10",
	"outline",
	"outline-variant",
	"scrim",
	"shadow",
];

for (const token of expectedTokens) {
	assert.match(
		theme,
		new RegExp(`--mat-sys-${token}:\\s*var\\(--vocora-[^)]+\\);`),
		`Material token ${token} must map to a Vocora design token.`,
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
assert.match(
	designSystem,
	/--vocora-neutral-black:\s*#[0-9a-f]{6};/iu,
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
assert.match(
	styles,
	/@use '\.\/styles\/angular-material-components' as angular-material-components;/u,
);
assert.ok(
	styles.indexOf("@include angular-material-components.apply();") >
		styles.indexOf("@include angular-material-theme.apply();"),
	"Shared Material component styles must be applied after semantic Material colors.",
);
assert.match(components, /\.mat-mdc-unelevated-button/u);
assert.match(
	components,
	/--mat-button-filled-container-color:\s*var\(\s*--vocora-component-action-background,\s*var\(--vocora-action-primary\)\s*\);/u,
);
assert.match(
	components,
	/--mat-button-filled-label-text-color:\s*var\(\s*--vocora-component-action-foreground,\s*var\(--vocora-action-primary-foreground\)\s*\);/u,
);
assert.doesNotMatch(components, /--mdc-filled-button-/u);
assert.match(
	components,
	/@media\s*\(hover:\s*hover\)[\s\S]*\.mat-mdc-unelevated-button\.vocora-action-button:not\(:disabled\):hover/u,
	"Primary hover colors must only apply on devices that support hover.",
);
assert.match(
	components,
	/\.mat-mdc-icon-button\.vocora-secondary-icon-action\s*\{[^}]*display:\s*inline-grid;[^}]*place-items:\s*center;/u,
	"The shared secondary icon button must center its Material icon.",
);
assert.match(
	components,
	/\.mat-mdc-icon-button\.vocora-secondary-icon-action\s*\{[^}]*--mat-icon-button-icon-color:\s*var\(\s*--vocora-action-secondary-foreground\s*\);/u,
	"The shared secondary icon button must map its Material icon color to the Vocora secondary action token.",
);
assert.match(
	components,
	/\.mat-mdc-icon-button\.vocora-plain-icon-action\b/u,
	"Plain Material icon actions must have one reusable central variant.",
);
assert.match(
	components,
	/\.mat-mdc-icon-button\.vocora-primary-icon-action\b/u,
	"Filled primary Material icon actions must have one reusable central variant.",
);
assert.match(
	theme,
	/--mat-sys-error-container:\s*var\(--vocora-error-surface\);/u,
);
assert.match(designSystem, /--color-eager-green:\s*#58cc02;/iu);
assert.match(designSystem, /--color-spark-blue:\s*#1cb0f6;/iu);
assert.match(designSystem, /--color-paper-white:\s*#ffffff;/iu);
assert.match(designSystem, /--color-charcoal:\s*#4b4b4b;/iu);
assert.match(designSystem, /--color-pencil-gray:\s*#777777;/iu);
assert.match(designSystem, /--color-faded-gray:\s*#afafaf;/iu);
assert.match(
	designSystem,
	/--vocora-action-primary:\s*var\(--color-spark-blue\);/iu,
);
assert.match(
	designSystem,
	/--vocora-action-success:\s*var\(--color-eager-green\);/iu,
	"Success actions must retain the canonical Eager Green role.",
);
assert.match(
	designSystem,
	/html\[data-theme=["']dark["']\][^{]*\{[^}]*--vocora-action-primary:\s*#49c0f8;[^}]*--vocora-action-success:\s*#72d72b;/iu,
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
	/html\[data-theme=["']dark["']\][^{]*\{[^}]*--vocora-action-secondary:\s*#ffffff;[^}]*--vocora-action-secondary-foreground:\s*#4b4b4b;/iu,
	"Dark secondary buttons must preserve the white surface and Charcoal label pairing.",
);
assert.match(designSystem, /--vocora-error:\s*#ff4b4b;/iu);
assert.match(designSystem, /--vocora-information-surface:\s*#ddf4ff;/iu);

for (const intent of ["primary", "secondary", "success", "warning", "error"]) {
	assert.match(
		components,
		new RegExp(`\\.vocora-button--${intent}\\b`),
		`Material button intent '${intent}' must have a central modifier class.`,
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
		components,
		new RegExp(
			`\\.vocora-button--${intent}\\s*\\{[^}]*--vocora-component-action-background:\\s*var\\(--vocora-action-${token}\\);`,
			"u",
		),
		`Material button intent '${intent}' must map to its semantic background token.`,
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
			/--vocora-action-warning-foreground:\s*(?:var\(--color-paper-white\)|#ffffff);/gu,
		),
	].length,
	2,
	"Warning actions must use white labels in both light and dark themes.",
);

assert.match(
	components,
	/\.mat-mdc-button,\s*\.mat-mdc-unelevated-button,\s*\.mat-mdc-raised-button,\s*\.mat-mdc-outlined-button,\s*\.mat-tonal-button\s*\{[^}]*height:\s*auto;[^}]*min-height:\s*44px;/u,
	"All textual Material buttons must allow wrapped labels while preserving the minimum touch target.",
);
assert.match(
	components,
	/border-radius:\s*var\(--vocora-radius-button\);/u,
	"Material action buttons must use the shared 13px radius token.",
);
assert.match(
	components,
	/box-shadow:\s*0 4px 0/u,
	"Enabled Material buttons must use the canonical four-pixel lower edge.",
);
assert.match(
	components,
	/\.mat-mdc-unelevated-button\s*\{[^}]*border-width:\s*0;[\s\S]*?\.mat-mdc-raised-button\s*\{[^}]*border-width:\s*0;[\s\S]*?\.mat-mdc-outlined-button\s*\{[^}]*border-width:\s*2px;/u,
	"Filled buttons must be borderless while outlined buttons keep the canonical two-pixel border.",
);
assert.match(
	components,
	/\.mat-mdc-button:not\(:disabled\):active,[\s\S]*?\.mat-tonal-button:disabled\s*\{[^}]*box-shadow:\s*none;[^}]*transform:\s*translateY\(4px\);/u,
	"Pressed and disabled Material buttons must remove the lower edge within the preserved footprint.",
);
assert.match(
	components,
	/\.mat-mdc-button,\s*\.mat-mdc-unelevated-button,\s*\.mat-mdc-raised-button,\s*\.mat-mdc-outlined-button,\s*\.mat-tonal-button\s*\{[^}]*transition:\s*none\s*!important;/u,
	"Textual Material buttons must not animate any visual property.",
);
assert.match(
	components,
	/\.vocora-button--secondary\s*\{[^}]*--vocora-component-action-border:\s*var\(--vocora-action-secondary-border\);/u,
	"Secondary buttons must use the canonical outlined treatment.",
);
assert.match(
	components,
	/\.mat-mdc-outlined-button:not\(:disabled\)\s*\{[^}]*--mat-button-outlined-label-text-color:\s*var\(\s*--vocora-action-secondary-foreground\s*\);[^}]*color:\s*var\(--vocora-action-secondary-foreground\);/u,
	"Every enabled Material outlined button must use the canonical secondary label color.",
);
assert.match(
	components,
	/:disabled[^{]*\{[^}]*--mat-button-filled-disabled-container-color:/u,
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
	/@case \('success'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[^>]*fill="#58A700"[\s\S]*?<path[^>]*d="M10\.5 15\.5L14 19\.5L21 12"[^>]*stroke-width="3"/u,
	"Successful feedback must use the supplied rounded check SVG at 35px.",
);
assert.match(
	exerciseFooterTemplate,
	/@case \('error'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[\s\S]*?<path[^>]*d="M10\.5 10\.5L19\.5 19\.5M19\.5 10\.5L10\.5 19\.5"[^>]*stroke-width="3"/u,
	"Incorrect feedback must use a matching rounded cross SVG at 35px.",
);
assert.match(
	exerciseFooterTemplate,
	/@case \('warning'\)\s*\{[\s\S]*?<svg[^>]*width="35"[^>]*height="35"[^>]*viewBox="0 0 30 30"[\s\S]*?<circle[^>]*cx="15"[^>]*cy="15"[^>]*r="15"[^>]*fill="var\(--vocora-action-warning\)"[\s\S]*?<path[^>]*stroke="white"[^>]*stroke-width="3"/u,
	"Warning feedback must use a matching rounded SVG at 35px.",
);
assert.doesNotMatch(
	exerciseFooterTemplate,
	/<span>[✓×!]<\/span>/u,
	"Semantic feedback must not fall back to text glyph icons.",
);

console.log("Angular Material theme contract passed.");
