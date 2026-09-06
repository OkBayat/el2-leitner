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
  'src/app/application/collection-learning-path/collection-learning-path.facade.ts',
  'src/app/application/collection-learning-path/exercise-runner.facade.ts',
  'src/app/core/collection-learning-path/collection-learning-path-api.service.ts',
]) assert.ok(exists(required), `${required} is required by the Learning Path bounded context.`);

const domain = read('src/app/domain/collection-learning-path/learning-path.ts');
assert.doesNotMatch(domain, /@angular\//u, 'Learning Path domain models must remain Angular-framework neutral.');
assert.doesNotMatch(domain, /HttpClient|ApiClientService/u, 'Learning Path domain models must not depend on transport code.');

const routes = read('src/app/app.routes.ts');
const shellRoute = "path: 'library/:collectionId/learning-path'";
const runnerRoute = "path: 'learning-path/:pathId/lessons/:lessonId/exercises/:exerciseId'";
assert.ok(routes.includes(shellRoute), 'The collection-scoped Learning Path route is required.');
assert.ok(routes.includes(runnerRoute), 'The full-screen exercise runner route is required.');
assert.ok(routes.indexOf(runnerRoute) < routes.indexOf("loadComponent: () => import('./shared/app-shell/app-shell.component')"), 'The exercise runner must stay outside AppShell.');

const pathFacade = read('src/app/application/collection-learning-path/collection-learning-path.facade.ts');
const runnerFacade = read('src/app/application/collection-learning-path/exercise-runner.facade.ts');
assert.doesNotMatch(pathFacade + runnerFacade, /@angular\/router|Router\b/u, 'Application facades must not own navigation concerns.');
assert.doesNotMatch(pathFacade + runnerFacade, /HttpClient/u, 'Application facades must depend on the typed Learning Path API boundary, not HttpClient.');

console.log('Learning Path shell architecture checks passed.');
