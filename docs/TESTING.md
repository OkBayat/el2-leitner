# Testing Strategy

Vocora gets its confidence from deterministic tests close to the behavior they
own. Browser E2E is currently unavailable because it can persist fingerprints
and test state in a non-dedicated database.

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

## E2E disabled

Never create, develop, invoke, or run E2E or Playwright tests, locally or in
CI. The npm E2E scripts and the default Playwright configuration fail closed
before a browser can start. The retained specs are dormant reference material,
not an executable test surface.

This restriction can be reconsidered only after Vocora has a dedicated,
isolated test database and the root agent policy, npm guard, Playwright guard,
and this document are deliberately revised together. Until then, use unit,
behavior, contract, regression, or agent-evaluation coverage. The fast
`check:test-strategy` regression test enforces the execution guards and scans
GitHub workflows for forbidden Playwright execution.

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
| `vocora.spec.ts` | Broad onboarding, learner, library, review, word-edit, spelling, and layout coverage | Registration and welcome component regressions plus focused review, state, vocabulary API, library, settings, spelling, sound, and persistence tests |

No AI-agent browser scenario existed. Agent behavior continues to use the
skill-owned deterministic regression and evaluation tests rather than E2E.
