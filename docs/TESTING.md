# Testing Strategy

Vocora gets most of its confidence from fast tests close to the behavior they
own. Playwright is a small, manually run smoke diagnostic, not a coverage
suite.

## Testing pyramid

Choose the lowest test level that can prove the behavior:

1. **Unit test** — pure functions, isolated services, parsers, formatters, and
   deterministic adapters.
2. **Behavior test** — domain and application rules through their public
   behavior, without infrastructure details.
3. **Contract test** — HTTP endpoints, persistence ports, provider adapters,
   schemas, serialization, and other service boundaries.
4. **Regression test** — the smallest stable reproduction of a previously
   discovered bug, kept at the owning boundary.
5. **Agent evaluation/regression test** — agent decisions, permitted actions,
   outputs, and deterministic skill tooling.
6. **E2E smoke test** — only complete-system connectivity and a critical
   real-user journey that cannot be proven at a lower level.

E2E tests must not be created by default. Do not add scenarios to the smoke
suite. Any proposed replacement must first show why unit, behavior, contract,
regression, or agent evaluation coverage cannot prove the scenario.

GitHub CI must never install a browser for E2E or run the Playwright suite.
The fast `check:test-strategy` regression test enforces both the three-scenario
limit and the absence of Playwright execution in GitHub workflows.

## Manual smoke E2E

The three retained Playwright scenarios use the real Docker stack and verify:

- the application starts and registration reaches the dashboard;
- a learner completes one review and the result reaches canonical persistence;
- a learner starts the first course exercise from the library.

Run them locally from a clean checkout. The dedicated Compose project, database,
ports, and credentials keep the smoke run isolated from staging and production:

```bash
export COMPOSE_PROJECT_NAME=vocora-e2e-smoke
export DB_NAME=vocora_e2e_smoke
export DB_PASSWORD=vocora_e2e_smoke
export MYSQL_ROOT_PASSWORD=vocora_e2e_smoke_root
export DB_ADMIN_PASSWORD=vocora_e2e_smoke_root
export JWT_SECRET=vocora-e2e-smoke-local-secret-at-least-32-characters
export APP_HOST=127.0.0.1
export APP_PORT=3200
export PHPMYADMIN_HOST=127.0.0.1
export PHPMYADMIN_PORT=8281
docker compose up --build --detach
cd ui
npm ci
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:3200 npm run e2e:smoke
cd ..
docker compose down
```

The browser installation is local only. Do not add these commands to GitHub
Actions. The final command removes only the isolated smoke containers and
network; it intentionally preserves the smoke volumes for reuse. Never add
`--volumes` to the cleanup command.

## Removed browser coverage

The previous Playwright suite mixed system connectivity with business rules,
API contracts, component behavior, responsive layout, and edge cases. Those
scenarios were removed after confirming coverage at their owning boundaries:

| Removed E2E file | Former purpose | Lower-level coverage retained |
| --- | --- | --- |
| `bbc-listening.spec.ts` | Catalog, audio controls, grading, completion, and mistake capture | Listening page/player component specs; listening application, domain, API, persistence, and mistake-practice tests |
| `charts.spec.ts` | Overview/report Chart.js rendering | `learning-chart.component.spec.ts` and dashboard/report structural checks |
| `episode-vocabulary.spec.ts` | Episode metadata, vocabulary activation, and isolation | Episode vocabulary component, listening vocabulary service, API, and persistence tests |
| `home-dashboard.spec.ts` | Dashboard states, themes, responsive layout, and read-only navigation | Home component, home timeline service, app-shell component, and dashboard design regressions |
| `learning-path-bbc-journey.spec.ts` | Enrollment, resume, and rolling-course refresh | Library/BBC journey facade specs and backend BBC journey behavior/HTTP tests |
| `learning-path-vocabulary-intake.spec.ts` | Intake layout, quiz flow, command order, and completion | Intake component/factory/facade specs and backend intake behavior, HTTP, and persistence tests |
| `navigation.spec.ts` | Responsive navigation, accessibility, theme, sign-out, and safe areas | App-shell component specs plus theme and navigation structural regressions |
| `pwa.spec.ts` | Manifest, worker, registration, and offline shell | PWA artifact regression, platform, update-service, status-component, and response-header tests |
| `sentence-answer.spec.ts` | Answer field and definition popover behavior across viewports | Sentence answer component behavior specs |
| `sentence-practice.spec.ts` | Retry flow, speech highlighting, daily totals, and Leitner isolation | Sentence domain/session service specs and backend sentence API/daily-attempt tests |
| `shadowing-audio.spec.ts` | Native recorder silence and cleanup | PCM recorder and shadowing session specs plus backend silence/provider regressions |
| `shadowing.spec.ts` | Retry, permission failure, cleanup, and responsive presentation | Shadowing domain/session service specs and authenticated API contracts |
| `vocora.spec.ts` | Broad learner, library, review, word-edit, spelling, and layout coverage | Focused review, state, vocabulary API, library, settings, spelling, sound, and persistence tests; the critical review path remains as smoke |

No AI-agent browser scenario existed. Agent behavior continues to use the
skill-owned deterministic regression and evaluation tests rather than E2E.
