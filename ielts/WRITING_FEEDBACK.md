# Writing assistance and educational feedback

Vocora separates immediate mechanical help from contextual evaluation:

```text
typing -> browser Harper worker -> learner-controlled suggestions
submit -> saved original draft -> backend trusted exercise context
-> OpenAI Responses API -> strict educational feedback -> revision
```

## Browser assistance

`WritingAssistantService` lazy-loads the official `harper.js` package and its
bundled WebAssembly only when a Writing slide is opened. `WorkerLinter` keeps
lint work off Angular's main thread. Text changes are debounced, stale results
are ignored, and a bounded set of issues is mapped into Vocora-owned UI models.

Harper covers supported spelling, grammar, capitalization, punctuation,
repetition, usage, and style hints. It does not grade the exercise or estimate
IELTS performance. The learner sees English issue text and explicitly chooses
Apply or Ignore. If initialization or linting fails, the editor and Submit flow
remain available.

## Submitted evaluation

The authenticated backend resolves the current exercise and attempt from the
managed JSON source. The browser sends the original learner response and stable
request identity; it cannot choose criteria or send an API key.

`WritingFeedbackService` is the product capability. Its OpenAI adapter calls the
Responses API with:

- `gpt-5-nano` by default;
- minimal reasoning and low verbosity;
- `store:false` and zero automatic retries;
- no tools;
- strict JSON Schema output and a bounded token budget.

The prompt sends only the exercise prompt/instruction, level, target skill,
relevant objectives and constraints, target vocabulary, optional trusted source
text, and final response. Learner text is strongly delimited JSON data and
cannot replace the fixed evaluator instruction.

Feedback contains task relevance, a concise teaching comment, up to three
high-value issues, corrected examples where anchored in the response, and one
or two next revision actions. Sentence and paragraph exercises always leave the
IELTS band unassessed. Full Task 1, Task 2, or General Training letter modes may
return a cautious half-band estimate using the relevant IELTS dimensions.

## Persistence and recovery

The draft is saved before asynchronous evaluation. Content-version binding,
idempotency, per-owner/global queue admission, daily limits, maximum input size,
provider timeout, and at most three explicit attempts bound cost. Timeout, rate
limit, malformed output, or provider unavailability keeps the exact draft and
offers retry; it never records an incorrect or completed learning result.

Logs contain capability, exercise identity, provider/model, duration, queue
latency, and token counts when returned. They do not contain full responses,
transcripts, credentials, or authorization headers.

## Configuration

```dotenv
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-nano
OPENAI_TIMEOUT_MS=30000
WRITING_FEEDBACK_ENABLED=false
WRITING_FEEDBACK_RETENTION_DAYS=30
```

The key is backend-only. CI uses injected OpenAI doubles and needs no key.
