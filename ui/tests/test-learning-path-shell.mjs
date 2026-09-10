import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(uiRoot, relative), 'utf8');
const exists = (relative) => fs.existsSync(path.join(uiRoot, relative));

const componentRoots = [
  'src/app/features/collection-learning-path/path-page/learning-path-page',
  'src/app/features/collection-learning-path/exercise-runner/exercise-runner-page',
  'src/app/features/collection-learning-path/components/progress-header/progress-header',
  'src/app/features/collection-learning-path/components/lesson-node/lesson-node',
  'src/app/features/collection-learning-path/components/exercise-node/exercise-node',
  'src/app/features/collection-learning-path/exercises/exercise-runtime/exercise-host',
  'src/app/features/collection-learning-path/exercises/vocabulary-intake/vocabulary-intake-exercise',
];
for (const root of componentRoots) {
  for (const suffix of ['.component.ts', '.component.html', '.component.scss', '.component.spec.ts']) {
    assert.ok(exists(`${root}${suffix}`), `${root}${suffix} is required by the Learning Path shell.`);
  }
  const source = read(`${root}.component.ts`);
  assert.match(source, /standalone:\s*true/u, `${root} must stay standalone.`);
  assert.match(source, /ChangeDetectionStrategy\.OnPush/u, `${root} must use OnPush.`);
  assert.match(source, /templateUrl:/u, `${root} must keep HTML in a separate file.`);
  assert.match(source, /styleUrl:/u, `${root} must keep SCSS in a separate file.`);
  assert.doesNotMatch(source, /\btemplate\s*:/u, `${root} must not use an inline template.`);
  assert.doesNotMatch(source, /\bstyles\s*:/u, `${root} must not use inline styles.`);
}

for (const required of [
  'src/app/domain/collection-learning-path/learning-path.ts',
  'src/app/domain/collection-learning-path/vocabulary-intake.ts',
  'src/app/application/collection-learning-path/collection-learning-path.facade.ts',
  'src/app/application/collection-learning-path/exercise-runner.facade.ts',
  'src/app/application/collection-learning-path/vocabulary-intake.facade.ts',
  'src/app/core/collection-learning-path/collection-learning-path-api.service.ts',
  'src/app/features/collection-learning-path/exercises/exercise-runtime/exercise-registry.ts',
  'src/app/features/collection-learning-path/exercises/exercise-runtime/learning-path-exercise-registry.ts',
]) assert.ok(exists(required), `${required} is required by the Learning Path bounded context.`);

const domain = read('src/app/domain/collection-learning-path/learning-path.ts');
const intakeDomain = read('src/app/domain/collection-learning-path/vocabulary-intake.ts');
assert.doesNotMatch(domain + intakeDomain, /@angular\//u, 'Learning Path domain models must remain Angular-framework neutral.');
assert.doesNotMatch(domain + intakeDomain, /HttpClient|ApiClientService/u, 'Learning Path domain models must not depend on transport code.');

const routes = read('src/app/app.routes.ts');
const shellRoute = "path: 'learning-paths/:pathId'";
const runnerRoute = "path: 'learning-paths/:pathId/lessons/:lessonId/exercises/:exerciseId'";
const legacyRunnerRoute = "path: 'learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId'";
const appShellRoute = "loadComponent: () => import('./shared/app-shell/app-shell.component')";
assert.ok(routes.includes(shellRoute), 'The canonical public-id Learning Path route is required.');
assert.ok(routes.includes(runnerRoute), 'The canonical exercise runner route is required.');
assert.ok(routes.indexOf(runnerRoute) < routes.indexOf(appShellRoute), 'The canonical exercise runner must stay outside AppShell.');
assert.ok(routes.includes(legacyRunnerRoute), 'The legacy slug route must remain available during migration.');
assert.ok(routes.indexOf(legacyRunnerRoute) < routes.indexOf(appShellRoute), 'The legacy exercise runner must stay outside AppShell during migration.');
assert.match(routes, /legacyLearningPathExerciseRouteGuard/u, 'The legacy slug route must resolve to its canonical numeric URL.');

const runnerStyles = read('src/app/features/collection-learning-path/exercise-runner/exercise-runner-page.component.scss');
assert.match(runnerStyles, /height:\s*100dvh/u, 'The exercise page must own its distraction-free mobile viewport.');
const slideExerciseStyles = read('src/app/shared/slide-exercise/slide-exercise.component.scss');
assert.match(slideExerciseStyles, /min-height:\s*100dvh/u, 'Shared slide exercises must fill the distraction-free mobile viewport.');

const exerciseNodeStyles = read('src/app/features/collection-learning-path/components/exercise-node/exercise-node.component.scss');
assert.match(exerciseNodeStyles, /:host\s*\{[^}]*width:\s*72px/su, 'Translated trail nodes must own only their visible width.');
assert.doesNotMatch(exerciseNodeStyles, /:host\s*\{[^}]*width:\s*100%/su, 'Translated trail nodes must not shift a full-width host beyond the viewport.');

const lessonNodeStyles = read('src/app/features/collection-learning-path/components/lesson-node/lesson-node.component.scss');
assert.match(
  lessonNodeStyles,
  /\.lesson\s*>\s*\.lesson__header\s*\{[^}]*position:\s*sticky/su,
  'Every lesson header must retain the sticky card behavior while scrolling.',
);
assert.doesNotMatch(
  lessonNodeStyles,
  /\.lesson\.is-active\s*>\s*\.lesson__header/u,
  'Sticky lesson headers must not be limited to the active lesson.',
);

const appShellStyles = read('src/app/shared/app-shell/app-shell.component.scss');
assert.match(appShellStyles, /:host\s*\{[^}]*overflow-x:\s*clip/su, 'AppShell must contain feature overflow without creating a horizontal scroller.');
assert.match(appShellStyles, /\.mobile-status\s*\{[^}]*position:\s*fixed/su, 'The mobile status header must remain fixed during document scrolling.');
assert.match(appShellStyles, /\.mobile-nav\s*\{[^}]*position:\s*fixed/su, 'The mobile navigation must remain fixed during document scrolling.');

const pathFacade = read('src/app/application/collection-learning-path/collection-learning-path.facade.ts');
const runnerFacade = read('src/app/application/collection-learning-path/exercise-runner.facade.ts');
const intakeFacade = read('src/app/application/collection-learning-path/vocabulary-intake.facade.ts');
assert.doesNotMatch(pathFacade + runnerFacade + intakeFacade, /@angular\/router|Router\b/u, 'Application facades must not own navigation concerns.');
assert.doesNotMatch(pathFacade + runnerFacade + intakeFacade, /HttpClient/u, 'Application facades must depend on the typed Learning Path API boundary, not HttpClient.');

const genericRegistry = read('src/app/features/collection-learning-path/exercises/exercise-runtime/exercise-registry.ts');
const composedRegistry = read('src/app/features/collection-learning-path/exercises/exercise-runtime/learning-path-exercise-registry.ts');
assert.doesNotMatch(genericRegistry, /vocabulary\.intake/u, 'The generic exercise registry must stay open for extension and free of exercise-specific registrations.');
assert.match(composedRegistry, /vocabulary\.intake/u, 'Vocabulary intake must be registered at the Learning Path composition boundary.');

const intakeStyles = read('src/app/features/collection-learning-path/exercises/vocabulary-intake/vocabulary-intake-exercise.component.scss');
assert.doesNotMatch(intakeStyles, /#[0-9a-f]{3,8}/iu, 'Vocabulary intake must use Vocora semantic design tokens instead of raw colors.');
assert.match(intakeStyles, /--vocora-/u, 'Vocabulary intake must consume Vocora semantic design tokens.');

const slideActionStyles = read('src/app/shared/slide-exercise/slide-exercise-action.component.scss');
const slideLayoutStyles = read('src/app/shared/slide-exercise/slide-exercise.component.scss');
const choiceStyles = read('src/app/shared/slide-exercise/library/slide-library.component.scss');
assert.match(slideActionStyles, /--vocora-action-primary/u, 'Slide exercise actions must use the Vocora primary-action token.');
assert.match(slideLayoutStyles, /--vocora-surface-page/u, 'Slide exercise chrome must use Vocora semantic surfaces.');
assert.match(slideActionStyles + choiceStyles, /prefers-reduced-motion/u, 'Slide exercise interactions must respect reduced-motion preferences.');
assert.doesNotMatch(choiceStyles, /#[0-9a-f]{3,8}/iu, 'Shared slide question renderers must not introduce raw colors.');

for (const relative of [
  'src/app/features/collection-learning-path/path-page/learning-path-page.component.scss',
  'src/app/features/collection-learning-path/components/progress-header/progress-header.component.scss',
  'src/app/features/collection-learning-path/components/lesson-node/lesson-node.component.scss',
  'src/app/features/collection-learning-path/components/exercise-node/exercise-node.component.scss',
]) {
  const styles = read(relative);
  assert.doesNotMatch(styles, /#[0-9a-f]{3,8}/iu, `${relative} must not introduce raw feature colors.`);
  assert.match(styles, /--vocora-/u, `${relative} must consume Vocora semantic design tokens.`);
}

const globalStyles = read('src/styles.scss');
assert.ok(exists('src/styles/_vocora-design-system.scss'), 'Vocora design-system token mapping must be available to the product UI.');
assert.match(globalStyles, /vocora-design-system/u, 'Global styles must load the Vocora design-system token mapping.');

console.log('Learning Path shell architecture checks passed.');
