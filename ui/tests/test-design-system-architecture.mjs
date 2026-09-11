import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

import {
	validateArchitectureSnapshot,
	validateRepository,
} from "./design-system-architecture.mjs";

const sharedMarker = [
	"ui/src/app/shared/example.component.ts",
	"export class ExampleComponent {}",
];
const emptyBaseline = () => ({
	schema_version: 3,
	legacy_debt: {
		important_declarations: {},
		feature_material_internal_selectors: {},
		raw_colors: {},
		theme_selectors: {},
	},
	integration_exceptions: {
		important_declarations: {},
		raw_colors: {},
	},
});

function validateFixture({
	files = [],
	baseline = emptyBaseline(),
	baseFiles = [],
} = {}) {
	return validateArchitectureSnapshot({
		currentSources: new Map([sharedMarker, ...files]),
		baseSources: new Map([sharedMarker, ...baseFiles]),
		baseline,
	});
}

{
	const relative = "ui/src/app/features/example/named-colors.component.scss";
	const errors = validateFixture({
		files: [[
			relative,
			":host { color: red; background: white; box-shadow: 0 0 rgb(var(--vocora-primary-rgb) / .5); }",
		]],
	});
	assert.equal(
		errors.filter((error) => error.includes("raw color debt")).length,
		2,
	);
}

{
	assert.deepEqual(
		validateFixture({
			files: [[
				"ui/src/app/features/example/semantic-colors.component.scss",
				":host { color: var(--vocora-brand-green); background: rgb(var(--vocora-primary-rgb) / .5); }",
			]],
		}),
		[],
	);
}

{
	const relative = "ui/src/app/features/example/template.component.html";
	const errors = validateFixture({
		files: [[
			relative,
			'<svg fill="#123456"><path stroke="white" /></svg><div style="color: var(--vocora-text-primary)"></div>',
		]],
	});
	assert.equal(
		errors.filter((error) => error.includes("raw color debt")).length,
		2,
	);
}

{
	const relative = "ui/src/app/features/example/local-theme.component.sass";
	const errors = validateFixture({
		files: [[
			relative,
			":host-context([data-theme='dark'])\n  color: var(--vocora-text-primary)",
		]],
	});
	assert.ok(
		errors.some((error) => error.includes("local theme-selector debt")),
	);
}

{
	const errors = validateFixture({
		files: [
			[
				"ui/src/app/features/example/example.component.scss",
				":host { --bs-light-rgb: 1, 2, 3; --mat-sys-primary: blue; --color-feature-blue: green; }",
			],
		],
	});
	assert.ok(errors.some((error) => error.includes("defines --bs-light-rgb")));
	assert.ok(
		errors.some((error) => error.includes("defines --mat-sys-primary")),
	);
	assert.ok(
		errors.some((error) => error.includes("defines --color-feature-blue")),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.ts";
	const errors = validateFixture({
		files: [
			[
				relative,
				"@Component({styles: '.mat-mdc-example { color: red !important; --bs-border-color: red; }'}) export class Example {}\n" +
					"@Component({styles: [`.secondary { --color-feature-red: red; }`]}) export class Secondary {}",
			],
		],
	});
	assert.ok(
		errors.includes(
			`Untracked !important debt in ${relative}: .mat-mdc-example => color:red!important`,
		),
	);
	assert.ok(
		errors.includes(
			`Untracked feature Material-internal selector debt in ${relative}: .mat-mdc-example`,
		),
	);
	assert.ok(
		errors.some((error) => error.includes("defines --bs-border-color")),
	);
	assert.ok(
		errors.some((error) => error.includes("defines --color-feature-red")),
	);
}

{
	const relative = "ui/src/app/features/example/identifier.component.ts";
	const errors = validateFixture({
		files: [
			[
				relative,
				"import { Component as NgComponent } from '@angular/core';\n" +
					"const BAD = '.mat-mdc-example { color: red !important; }';\n" +
					"const styles = [BAD];\n" +
					"// @Component({styles: BAD}) export class CommentedOut {}\n" +
					"@Component({styles: BAD}) export class Scalar {}\n" +
					"@Component({styles: [BAD]}) export class ArrayValue {}\n" +
					"@Component({styles: '.safe {}' + BAD}) export class ConcatenatedScalar {}\n" +
					"@Component({styles: ['.safe {}'] + BAD}) export class ConcatenatedArray {}\n" +
					"@Component({styles: `.safe { color: ${BAD}; }`}) export class Interpolated {}\n" +
					"@Component({styles}) export class Shorthand {}\n" +
					"@NgComponent({styles: BAD}) export class Aliased {}\n" +
					"@ Component({styles: BAD}) export class SpacedDecorator {}\n" +
					"@Component({styles: [/* allowed note */ '.safe {}']}) export class CommentedLiteralArray {}",
			],
		],
	});
	assert.equal(
		errors.filter((error) =>
			error.includes("Unsupported Angular inline styles expression"),
		).length,
		8,
	);
}

{
	const relative = "ui/src/app/features/example/commented.component.scss";
	assert.deepEqual(
		validateFixture({
			files: [
				[
					relative,
					"/* .mat-mdc-commented { color: red !important; --bs-primary: red; } */",
				],
			],
		}),
		[],
	);
	assert.deepEqual(
		validateFixture({
			files: [
				[
					"ui/src/app/features/example/commented.component.less",
					"// .mat-mdc-commented { color: red !important; --bs-primary: red; }",
				],
			],
		}),
		[],
	);
}

{
	const relative =
		"ui/src/app/features/example/protected-content.component.scss";
	assert.deepEqual(
		validateFixture({
			files: [
				[
					relative,
					'.tokens::before { content: "--bs-primary: red"; }\n' +
						'.selectors::before { content: ".mat-mdc-example {"; }\n' +
						'.importance::before { content: "color:red!important"; }',
				],
			],
		}),
		[],
	);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: [".legacy => color:red!important"],
		reason: "Existing test debt.",
	};
	const errors = validateFixture({ baseline });
	assert.ok(
		errors.includes(
			`Stale !important baseline debt in ${relative}: .legacy => color:red!important`,
		),
	);
}

{
	const relative = "ui/src/app/features/example/local-theme.component.scss";
	const errors = validateFixture({
		files: [
			[
				relative,
				":host { --feature-accent: #123456; color: rgb(1 2 3); } :host-context([data-theme='dark']) { --feature-accent: oklch(70% .1 250); }",
			],
		],
	});
	assert.equal(
		errors.filter((error) => error.includes("raw color debt")).length,
		3,
	);
	assert.ok(
		errors.some((error) => error.includes("local theme-selector debt")),
	);
}

{
	const foundation = "ui/src/styles/_vocora-design-system.scss";
	assert.deepEqual(
		validateFixture({
			files: [[foundation, ":root, html[data-theme='light'] { --color-example: #123456; }"]],
		}),
		[],
	);

	const exception = "ui/src/pwa.scss";
	const baseline = emptyBaseline();
	baseline.integration_exceptions.raw_colors[exception] = {
		occurrences: ["#ffffff"],
		reason: "Early paint needs a deterministic fallback.",
		upstream_constraint: "The semantic runtime is not initialized yet.",
	};
	assert.deepEqual(
		validateFixture({ files: [[exception, "html { background: #ffffff; }"]], baseline }),
		[],
	);

	const feature = "ui/src/app/features/example/example.component.scss";
	baseline.integration_exceptions.raw_colors = {
		[feature]: baseline.integration_exceptions.raw_colors[exception],
	};
	const errors = validateFixture({
		files: [[feature, ":host { background: #ffffff; }"]],
		baseline,
	});
	assert.ok(
		errors.some((error) => error.includes("is not approved for raw_colors")),
	);
}

{
	const relative =
		"ui/src/app/features/example/semantic-values.component.scss";
	const currentOccurrences = [
		".image => background:url(https://new.example/b.png)!important",
		'.label => content:"a b"!important',
		'.comment-label => content:"/*new*/"!important',
	];
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: currentOccurrences,
		reason: "Existing semantic value test debt.",
	};
	const errors = validateFixture({
		files: [
			[
				relative,
				".image { background: url(https://new.example/b.png) !important; }\n" +
					'.label { content: "a b" !important; }\n' +
					'.comment-label { content: "/*new*/" !important; }',
			],
		],
		baseFiles: [
			[
				relative,
				".image { background: url(https://old.example/a.png) !important; }\n" +
					'.label { content: "a  b" !important; }\n' +
					'.comment-label { content: "/*old*/" !important; }',
			],
		],
		baseline,
	});
	assert.equal(
		errors.filter((error) =>
			error.includes("baseline grew beyond base source debt"),
		).length,
		3,
	);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const occurrence = ".legacy => color:var(--vocora-error)!important";
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: [occurrence],
		reason: "Existing test debt.",
	};
	const errors = validateFixture({
		files: [[relative, ".legacy { color: var(--vocora-error) !important; }"]],
		baseline,
	});
	assert.ok(
		errors.includes(
			`Legacy !important baseline grew beyond base source debt in ${relative}: ${occurrence}`,
		),
	);

	const passingErrors = validateFixture({
		files: [[relative, ".legacy { color: var(--vocora-error) !important; }"]],
		baseFiles: [[relative, ".legacy { color: var(--vocora-error) !important; }"]],
		baseline,
	});
	assert.deepEqual(passingErrors, []);
}

{
	const relative =
		"ui/src/app/features/example/semantic-selector.component.scss";
	const baseline = emptyBaseline();
	baseline.legacy_debt.feature_material_internal_selectors[relative] = {
		occurrences: ['[data-label="a b"] .mat-mdc-example'],
		reason: "Existing semantic selector test debt.",
	};
	const errors = validateFixture({
		files: [
			[relative, '[data-label="a b"] .mat-mdc-example { color: red; }'],
		],
		baseFiles: [
			[relative, '[data-label="a  b"] .mat-mdc-example { color: red; }'],
		],
		baseline,
	});
	assert.ok(
		errors.some((error) =>
			error.includes("baseline grew beyond base source debt"),
		),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const occurrence =
		".legacy,.second /* baseline note */ => color: var(--vocora-error) !important";
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: [
			occurrence,
			".image => background:url(https://same.example/a)!important",
		],
		reason: "Existing test debt.",
	};
	assert.deepEqual(
		validateFixture({
			files: [
				[
					relative,
					".legacy, .second { color: var(--vocora-error) !important; } .image { background: url(https://same.example/a) !important; }",
				],
			],
			baseFiles: [
				[
					relative,
					".legacy,.second /* formatting note */ { color: var(--vocora-error) !important; } .image { background: url( https://same.example/a ) !important; }",
				],
			],
			baseline,
		}),
		[],
	);

	const substitutionErrors = validateFixture({
		files: [
			[
				relative,
				".legacy, .second { color: var(--vocora-error) !important; } .image { background: url(https://same.example/a) !important; }",
			],
		],
		baseFiles: [
			[
				relative,
				".legacy, .different { color: var(--vocora-error) !important; } .image { background: url(https://same.example/a) !important; }",
			],
		],
		baseline,
	});
	assert.ok(
		substitutionErrors.some((error) =>
			error.includes("baseline grew beyond base source debt"),
		),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const occurrence = ".mat-mdc-example";
	const baseline = emptyBaseline();
	baseline.legacy_debt.feature_material_internal_selectors[relative] = {
		occurrences: [occurrence],
		reason: "Existing Material selector debt.",
	};
	const staleErrors = validateFixture({ baseline });
	assert.ok(
		staleErrors.includes(
			`Stale feature Material-internal selector baseline debt in ${relative}: ${occurrence}`,
		),
	);

	const growthErrors = validateFixture({
		files: [[relative, ".mat-mdc-example { color: red; }"]],
		baseline,
	});
	assert.ok(
		growthErrors.includes(
			`Legacy feature Material-internal selector baseline grew beyond base source debt in ${relative}: ${occurrence}`,
		),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const baseline = emptyBaseline();
	baseline.legacy_debt.feature_material_internal_selectors[relative] = {
		occurrences: [
			".host,.mat-mdc-example:not(.disabled) /* baseline note */",
		],
		reason: "Existing Material selector debt.",
	};
	assert.deepEqual(
		validateFixture({
			files: [
				[
					relative,
					".host, .mat-mdc-example:not(.disabled) { color: var(--vocora-error); }",
				],
			],
			baseFiles: [
				[
					relative,
					".host,.mat-mdc-example:not( .disabled ) /* formatting note */ { color: var(--vocora-error); }",
				],
			],
			baseline,
		}),
		[],
	);

	const substitutionErrors = validateFixture({
		files: [
			[
				relative,
				".host, .mat-mdc-example:not(.disabled) { color: var(--vocora-error); }",
			],
		],
		baseFiles: [[relative, ".host, .mat-mdc-different { color: var(--vocora-error); }"]],
		baseline,
	});
	assert.ok(
		substitutionErrors.some((error) =>
			error.includes("baseline grew beyond base source debt"),
		),
	);
}

{
	const relative = "ui/src/styles/_bootstrap-theme.scss";
	const occurrence =
		".bg-light => background:var(--vocora-surface-page)!important";
	const baseline = emptyBaseline();
	baseline.integration_exceptions.important_declarations[relative] = {
		occurrences: [occurrence],
		reason: "Bootstrap generates this utility with important specificity.",
		upstream_constraint:
			"Bootstrap utility output cannot be configured without !important.",
	};
	assert.deepEqual(
		validateFixture({
			files: [[relative, ".bg-light { background: var(--vocora-surface-page) !important; }"]],
			baseline,
		}),
		[],
	);

	const feature = "ui/src/app/features/example/example.component.scss";
	baseline.integration_exceptions.important_declarations = {
		[feature]:
			baseline.integration_exceptions.important_declarations[relative],
	};
	const errors = validateFixture({
		files: [[feature, ".bg-light { background: var(--vocora-surface-page) !important; }"]],
		baseline,
	});
	assert.ok(
		errors.some((error) =>
			error.includes("is not approved for important_declarations"),
		),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.sass";
	assert.deepEqual(
		validateFixture({ files: [[relative, ".example\n  color: var(--vocora-error)"]] }),
		[],
	);
	const errors = validateFixture({
		files: [[relative, ".example\n  color: var(--vocora-error) !important"]],
	});
	assert.ok(
		errors.includes(
			`Untracked !important debt in ${relative}: .example => color:var(--vocora-error)!important`,
		),
	);
}

{
	const errors = validateFixture({
		files: [
			[
				"ui/src/app/shared/shared.module.ts",
				"export class SharedModule {}",
			],
		],
	});
	assert.ok(
		errors.some((error) =>
			error.includes("must not introduce a giant SharedModule"),
		),
	);
}

const repositoryErrors = validateRepository({
	repoRoot: new URL("../..", import.meta.url),
	baseRef: process.env.VOCORA_UI_BASE_SHA || undefined,
});
assert.deepEqual(repositoryErrors, [], repositoryErrors.join("\n"));

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const packageJson = JSON.parse(
	fs.readFileSync(`${repoRoot}/ui/package.json`, "utf8"),
);
assert.equal(
	packageJson.scripts["check:design-system-architecture"],
	"node tests/test-design-system-architecture.mjs",
);
assert.match(
	packageJson.scripts.test,
	/check:architecture.*check:design-system-architecture.*ng test/u,
);
const workflow = fs.readFileSync(
	`${repoRoot}/.github/workflows/test.yml`,
	"utf8",
);
assert.match(workflow, /pull_request:[\s\S]*- 'ui\/\*\*'/u);
assert.match(workflow, /fetch-depth:\s*0/u);
assert.match(
	workflow,
	/VOCORA_UI_BASE_SHA:\s*\$\{\{ github\.event\.pull_request\.base\.sha \}\}/u,
);
assert.match(workflow, /run:\s*npm test/u);

console.log("Design-system architecture contract passed.");
