import { loadListeningLessonDefinitions } from "../src/infrastructure/content/loadListeningLessonDefinitions.js";

const directory = new URL("../data/listening/bbc/", import.meta.url);

const definitions = await loadListeningLessonDefinitions(directory);
if (!definitions.length) throw new Error("No BBC listening lesson definitions were found.");
const tests = definitions.reduce((total, lesson) => total + lesson.testCount, 0);
const questions = definitions.reduce((total, lesson) => total + lesson.questionCount, 0);
console.info(
  `Validated ${definitions.length} BBC listening lesson(s) containing ${tests} test(s) and ${questions} question(s).`
);
