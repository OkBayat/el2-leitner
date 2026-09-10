import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryDirectory = resolve(toolsDirectory, '../..');
const definitionsDirectory = resolve(repositoryDirectory, 'back/data/learning-paths');
const outputPath = resolve(repositoryDirectory, 'ui/src/app/generated/learning-path-podcast-catalog.ts');

function requiredString(value, label, fileName) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${fileName}: ${label} must be a non-empty string.`);
  }
  return value.trim();
}

function positiveInteger(value, label, fileName) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${fileName}: ${label} must be a positive integer.`);
  }
  return value;
}

async function readCourse(fileName) {
  const source = JSON.parse(await readFile(resolve(definitionsDirectory, fileName), 'utf8'));
  const collectionId = requiredString(source.path?.collectionId, 'path.collectionId', fileName);
  const lessons = Array.isArray(source.lessons) ? source.lessons : [];
  return {
    collectionId,
    lessons: lessons.map((lesson, index) => ({
      id: requiredString(lesson?.id, `lessons[${index}].id`, fileName),
      position: positiveInteger(lesson?.position, `lessons[${index}].position`, fileName),
      title: requiredString(lesson?.title, `lessons[${index}].title`, fileName),
    })).sort((left, right) => left.position - right.position || left.id.localeCompare(right.id)),
  };
}

const fileNames = (await readdir(definitionsDirectory))
  .filter((fileName) => fileName.endsWith('.json'))
  .sort();
const courses = await Promise.all(fileNames.map(readCourse));
courses.sort((left, right) => left.collectionId.localeCompare(right.collectionId));

await mkdir(dirname(outputPath), { recursive: true });
const catalog = JSON.stringify({ schemaVersion: 1, courses }, null, 2);
await writeFile(
  outputPath,
  `// Generated from back/data/learning-paths/*.json. Do not edit.\nexport const LEARNING_PATH_PODCAST_CATALOG = ${catalog} as const;\n`,
  'utf8',
);
console.info(`Generated ${outputPath} from ${courses.length} course definitions.`);
