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
	schema_version: 2,
	legacy_debt: {
		important_declarations: {},
		feature_material_internal_selectors: {},
	},
	integration_exceptions: {
		important_declarations: {},
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
				"const BAD = '.mat-mdc-example { color: red !important; }';\n" +
					"// @Component({styles: BAD}) export class CommentedOut {}\n" +
					"@Component({styles: BAD}) export class Scalar {}\n" +
					"@Component({styles: [BAD]}) export class ArrayValue {}\n" +
					"@Component({styles: '.safe {}' + BAD}) export class ConcatenatedScalar {}\n" +
					"@Component({styles: ['.safe {}'] + BAD}) export class ConcatenatedArray {}\n" +
					"@Component({styles: `.safe { color: ${BAD}; }`}) export class Interpolated {}\n" +
					"@Component({styles: [/* allowed note */ '.safe {}']}) export class CommentedLiteralArray {}",
			],
		],
	});
	assert.equal(
		errors.filter((error) =>
			error.includes("Unsupported Angular inline styles expression"),
		).length,
		5,
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
	const relative = "ui/src/app/features/example/example.component.scss";
	const occurrence = ".legacy => color:red!important";
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: [occurrence],
		reason: "Existing test debt.",
	};
	const errors = validateFixture({
		files: [[relative, ".legacy { color: red !important; }"]],
		baseline,
	});
	assert.ok(
		errors.includes(
			`Legacy !important baseline grew beyond base source debt in ${relative}: ${occurrence}`,
		),
	);

	const passingErrors = validateFixture({
		files: [[relative, ".legacy { color: red !important; }"]],
		baseFiles: [[relative, ".legacy { color: red !important; }"]],
		baseline,
	});
	assert.deepEqual(passingErrors, []);
}

{
	const relative = "ui/src/app/features/example/example.component.scss";
	const occurrence =
		".legacy,.second /* baseline note */ => color: red !important";
	const baseline = emptyBaseline();
	baseline.legacy_debt.important_declarations[relative] = {
		occurrences: [occurrence],
		reason: "Existing test debt.",
	};
	assert.deepEqual(
		validateFixture({
			files: [[relative, ".legacy, .second { color: red !important; }"]],
			baseFiles: [
				[
					relative,
					".legacy,.second /* formatting note */ { color: red !important; }",
				],
			],
			baseline,
		}),
		[],
	);

	const substitutionErrors = validateFixture({
		files: [[relative, ".legacy, .second { color: red !important; }"]],
		baseFiles: [
			[relative, ".legacy, .different { color: red !important; }"],
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
		occurrences: [".host,.mat-mdc-example /* baseline note */"],
		reason: "Existing Material selector debt.",
	};
	assert.deepEqual(
		validateFixture({
			files: [[relative, ".host, .mat-mdc-example { color: red; }"]],
			baseFiles: [
				[
					relative,
					".host,.mat-mdc-example /* formatting note */ { color: red; }",
				],
			],
			baseline,
		}),
		[],
	);

	const substitutionErrors = validateFixture({
		files: [[relative, ".host, .mat-mdc-example { color: red; }"]],
		baseFiles: [[relative, ".host, .mat-mdc-different { color: red; }"]],
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
	const occurrence = ".bg-light => background:white!important";
	const baseline = emptyBaseline();
	baseline.integration_exceptions.important_declarations[relative] = {
		occurrences: [occurrence],
		reason: "Bootstrap generates this utility with important specificity.",
		upstream_constraint:
			"Bootstrap utility output cannot be configured without !important.",
	};
	assert.deepEqual(
		validateFixture({
			files: [[relative, ".bg-light { background: white !important; }"]],
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
		files: [[feature, ".bg-light { background: white !important; }"]],
		baseline,
	});
	assert.ok(
		errors.some((error) =>
			error.includes("is not an approved framework integration owner"),
		),
	);
}

{
	const relative = "ui/src/app/features/example/example.component.sass";
	assert.deepEqual(
		validateFixture({ files: [[relative, ".example\n  color: red"]] }),
		[],
	);
	const errors = validateFixture({
		files: [[relative, ".example\n  color: red !important"]],
	});
	assert.ok(
		errors.includes(
			`Untracked !important debt in ${relative}: .example => color:red!important`,
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
