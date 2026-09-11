import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DESIGN_SYSTEM_PATH = "src/styles/_vocora-design-system.scss";
const ARTIFACT_PATHS = [
	"src/theme-bootstrap.js",
	"src/index.html",
	"src/manifest.webmanifest",
	"src/vocora-v4.webmanifest",
];

function replaceExactlyOnce(source, pattern, replacement, label) {
	const matches = [...source.matchAll(pattern)];
	if (matches.length !== 1) {
		throw new Error(
			`Expected exactly one ${label}; found ${matches.length}.`,
		);
	}
	return source.replace(pattern, replacement);
}

function extractFoundationHex(source, token) {
	const foundation = source.split("// Layer B: Vocora semantic tokens")[0];
	const pattern = new RegExp(
		`${token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\s*:\\s*(#[0-9a-f]{6})\\s*;`,
		"giu",
	);
	const matches = [...foundation.matchAll(pattern)];
	if (matches.length !== 1) {
		throw new Error(
			`Expected exactly one Layer A ${token} hex value; found ${matches.length}.`,
		);
	}
	return matches[0][1].toLowerCase();
}

export function extractFirstPaintThemeColors(designSystemSource) {
	return {
		light: extractFoundationHex(designSystemSource, "--color-paper-white"),
		dark: extractFoundationHex(designSystemSource, "--color-dark-page"),
	};
}

function synchronizeThemeBootstrap(source, colors) {
	return replaceExactlyOnce(
		source,
		/const pageColors = \{light: '#[0-9a-f]{6}', dark: '#[0-9a-f]{6}'\};/giu,
		`const pageColors = {light: '${colors.light}', dark: '${colors.dark}'};`,
		"theme-bootstrap pageColors declaration",
	);
}

function synchronizeIndex(source, colors) {
	let result = source;
	for (const mode of ["light", "dark"]) {
		const tagPattern = new RegExp(
			`<meta name="theme-color"[^>]*data-vocora-theme="${mode}"[^>]*>`,
			"gu",
		);
		const tags = [...result.matchAll(tagPattern)];
		if (tags.length !== 1) {
			throw new Error(
				`Expected exactly one ${mode} theme-color meta tag; found ${tags.length}.`,
			);
		}
		const synchronizedTag = replaceExactlyOnce(
			tags[0][0],
			/content="[^"]+"/gu,
			`content="${colors[mode]}"`,
			`${mode} theme-color content attribute`,
		);
		result = result.replace(tags[0][0], synchronizedTag);
	}
	return result;
}

function synchronizeManifest(source, colors, relativePath) {
	return replaceExactlyOnce(
		source,
		/"theme_color"\s*:\s*"#[0-9a-f]{6}"/giu,
		`"theme_color": "${colors.light}"`,
		`${relativePath} theme_color`,
	);
}

function expectedArtifactContents(uiRoot) {
	const read = (relativePath) =>
		fs.readFileSync(path.join(uiRoot, relativePath), "utf8");
	const colors = extractFirstPaintThemeColors(read(DESIGN_SYSTEM_PATH));
	return new Map([
		[
			ARTIFACT_PATHS[0],
			synchronizeThemeBootstrap(read(ARTIFACT_PATHS[0]), colors),
		],
		[ARTIFACT_PATHS[1], synchronizeIndex(read(ARTIFACT_PATHS[1]), colors)],
		...ARTIFACT_PATHS.slice(2).map((relativePath) => [
			relativePath,
			synchronizeManifest(read(relativePath), colors, relativePath),
		]),
	]);
}

export function inspectFirstPaintThemeArtifacts(uiRoot) {
	return [...expectedArtifactContents(uiRoot)]
		.filter(
			([relativePath, expected]) =>
				fs.readFileSync(path.join(uiRoot, relativePath), "utf8") !==
				expected,
		)
		.map(([relativePath]) => relativePath);
}

export function writeFirstPaintThemeArtifacts(uiRoot) {
	for (const [relativePath, expected] of expectedArtifactContents(uiRoot)) {
		const absolutePath = path.join(uiRoot, relativePath);
		if (fs.readFileSync(absolutePath, "utf8") !== expected) {
			fs.writeFileSync(absolutePath, expected);
		}
	}
}

const isMain =
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	const uiRoot = path.resolve(
		path.dirname(fileURLToPath(import.meta.url)),
		"..",
	);
	if (process.argv.includes("--write")) {
		writeFirstPaintThemeArtifacts(uiRoot);
	} else {
		const mismatches = inspectFirstPaintThemeArtifacts(uiRoot);
		if (mismatches.length > 0) {
			throw new Error(
				`First-paint theme artifacts are stale: ${mismatches.join(", ")}. Run npm run sync:first-paint-theme.`,
			);
		}
	}
}
