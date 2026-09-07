# Canonical Lesson-Plan Output Contract

Load this reference only after the lesson target inventory and prerequisite-aware exercise sequence have been decided.

The default response from `k2-lesson-exercise-design` is one JSON object following this contract. New agent-facing fields use `snake_case`.

## Root envelope

```json
{
  "schema_version": 1,
  "lesson": {},
  "design": {},
  "evidence_catalog": [],
  "exercises": [],
  "coverage": {},
  "validation": {}
}
```

## `lesson`

```json
{
  "id": "stable-lesson-id",
  "title": "Lesson title",
  "source": {
    "kind": "provided_content",
    "reference": "book/file/repository reference",
    "section": "optional section reference"
  },
  "learning_goals": [
    "Learner can ..."
  ],
  "content_inventory": {
    "targets": [
      {
        "id": "target-001",
        "kind": "vocabulary",
        "label": "example target",
        "source_ref": "page/task/line reference",
        "leitner_eligible": true
      }
    ],
    "assets": [
      {
        "id": "asset-001",
        "kind": "audio",
        "source_ref": "track/source reference",
        "available": false
      }
    ]
  },
  "content_gaps": []
}
```

Rules:

- target IDs are unique inside the lesson;
- `source_ref` is required for every source target;
- `leitner_eligible` is explicit for every target;
- do not create an asset URL when the source does not provide one;
- `content_gaps` records missing or contradictory source material.

## `design`

```json
{
  "sequence_strategy": "Short explanation of the prerequisite progression.",
  "research_principles": [
    "retrieval_practice",
    "multidimensional_vocabulary"
  ],
  "notes": []
}
```

`research_principles` is a lesson-level summary. Exercise-level evidence still lists the principles actually used by each exercise.

## `evidence_catalog`

Declare each research or design-synthesis identifier once, then reference it by ID.

```json
[
  {
    "id": "retrieval_practice",
    "kind": "research",
    "citation": "Roediger & Karpicke (2006), DOI 10.1111/j.1467-9280.2006.01693.x",
    "claim": "Retrieval can improve delayed retention compared with repeated restudy."
  },
  {
    "id": "vocora_prerequisite_synthesis",
    "kind": "design_synthesis",
    "citation": "Vocora learning-design synthesis",
    "claim": "The exact exercise order is derived from source dependencies plus the declared research principles; no cited paper validates the entire sequence as one package."
  }
]
```

Allowed `kind` values are:

- `research`
- `design_synthesis`
- `source_rule`

The research IDs documented in `learning-design-rules.md` should keep those exact names when used.

## `exercises`

Every exercise has one primary objective and one ordered slide array.

```json
{
  "id": "lesson-id-e03-meaning-context",
  "position": 30,
  "exercise_type": "meaning_in_context",
  "title": "Meaning in context",
  "objective": "Retrieve target meanings inside short contexts.",
  "required": true,
  "prerequisites": [
    {
      "exercise_id": "lesson-id-e02-spelling-dictation",
      "reason": "Learners should already have an initial exact-form representation before contextual recall."
    }
  ],
  "source_target_ids": ["target-001"],
  "extension_ids": [],
  "evidence": {
    "source_refs": ["Unit X, task Y"],
    "research_principle_ids": ["retrieval_practice"],
    "sequence_reason": "Moves from initial form/meaning exposure to contextual retrieval before integrated reading or listening."
  },
  "completion": {
    "evidence": "All required scored slides attempted and exercise completion recorded.",
    "mastery_gate": null
  },
  "slides": []
}
```

Rules:

- positions are unique and strictly increasing;
- exercise IDs are unique;
- every prerequisite references an earlier exercise ID;
- each prerequisite includes a concrete reason;
- every exercise contains at least one slide;
- `source_target_ids` reference lesson target IDs;
- `extension_ids` reference `coverage.vocora_extensions` IDs;
- every research principle ID must exist in `evidence_catalog`;
- `mastery_gate` may be `null` unless an explicit course/product contract defines one.

### Fixed exercise 1

The first exercise must use:

```json
{
  "exercise_type": "vocabulary_intake",
  "prerequisites": []
}
```

It must cover every target where `leitner_eligible` is `true`.

Its slides should provide supported vocabulary review. Under the current placeholder contract, include at least one `choice` slide for meaning/recognition unless the final runtime contract later defines a different canonical intake renderer.

The exercise completion/effect description must make clear that unseen vocabulary is activated into Leitner House 1.

### Fixed exercise 2

The second exercise must use:

```json
{
  "exercise_type": "spelling_dictation"
}
```

It must:

- depend on exercise 1;
- cover the same `leitner_eligible` target scope;
- include at least one `dictation` slide;
- require typed word or phrase production for the main scope, even if occasional spelling-choice scaffolding is also present.

## Provisional slide envelope

The current skill does **not** claim to own the final runtime `data` contract for each component. Until that contract is integrated, every slide uses this authoring envelope:

```json
{
  "id": "lesson-id-e03-s01",
  "type": "cloze",
  "purpose": "Retrieve the target in context with reduced support.",
  "target_ids": ["target-001"],
  "contract_status": "placeholder",
  "data": {
    "_placeholder": true,
    "instruction_intent": "Complete the sentence with the most natural target expression.",
    "prompt_or_stimulus": "Source-grounded or clearly labeled original prompt.",
    "expected_response": "Description of the expected response or answer key.",
    "feedback_intent": "Correct immediately and explain the relevant lexical distinction."
  }
}
```

The 16 provisional reusable `type` values are:

```text
teaching-card
choice
truth
matching
classification
ordering
cloze
structured-completion
short-answer
word-formation
error-correction
rewrite
pronunciation
dictation
speaking-response
writing-response
```

Rules:

- choose only a type whose cognitive interaction fits the exercise objective;
- do not use a type only to achieve visual variety;
- `target_ids` may reference source targets or declared Vocora extension IDs;
- `contract_status` is exactly `placeholder` in this version;
- `data._placeholder` is exactly `true` in this version;
- the four intent strings inside `data` are required and non-empty;
- do not invent production component fields outside this placeholder envelope;
- when final component schemas are integrated, replace this placeholder atomically rather than maintaining two accepted slide contracts.

## `coverage`

```json
{
  "source_target_ids": ["target-001"],
  "covered_target_ids": ["target-001"],
  "uncovered_target_ids": [],
  "vocora_extensions": [
    {
      "id": "extension-001",
      "reason": "Optional productive transfer task added by Vocora after source vocabulary is mastered."
    }
  ]
}
```

Rules:

- `source_target_ids` must exactly match the lesson target inventory IDs;
- covered and uncovered sets must be disjoint;
- their union must equal `source_target_ids`;
- extension IDs are unique and never masquerade as source targets.

## `validation`

```json
{
  "status": "ready",
  "warnings": [],
  "blockers": []
}
```

Allowed status values:

- `ready`
- `blocked`

`ready` requires:

- no blockers;
- no uncovered source targets;
- a structurally valid exercise graph;
- the fixed opening exercises;
- valid placeholder slide envelopes.

Use `blocked` when source or asset gaps prevent the intended learning path from being production-ready. Placeholder slide configuration by itself may be a warning when the caller asked only for design, but it is a blocker when the caller explicitly asks for final runtime-ready slide configuration.

## Minimal complete example

```json
{
  "schema_version": 1,
  "lesson": {
    "id": "sample-unit-01",
    "title": "Sample lesson",
    "source": {
      "kind": "provided_content",
      "reference": "sample source",
      "section": "Unit 1"
    },
    "learning_goals": ["Recognize and spell the lesson vocabulary."],
    "content_inventory": {
      "targets": [
        {
          "id": "target-001",
          "kind": "vocabulary",
          "label": "sample",
          "source_ref": "Unit 1 vocabulary list",
          "leitner_eligible": true
        }
      ],
      "assets": []
    },
    "content_gaps": []
  },
  "design": {
    "sequence_strategy": "Initial meaning recognition followed by exact-form production.",
    "research_principles": ["retrieval_practice", "multidimensional_vocabulary"],
    "notes": ["Per-slide data uses the provisional placeholder contract."]
  },
  "evidence_catalog": [
    {
      "id": "retrieval_practice",
      "kind": "research",
      "citation": "Roediger & Karpicke (2006), DOI 10.1111/j.1467-9280.2006.01693.x",
      "claim": "Retrieval can improve delayed retention compared with repeated restudy."
    },
    {
      "id": "multidimensional_vocabulary",
      "kind": "research",
      "citation": "Webb (2009), DOI 10.1177/0033688209343854",
      "claim": "Receptive and productive learning affect different dimensions of vocabulary knowledge."
    }
  ],
  "exercises": [
    {
      "id": "sample-unit-01-e01-intake",
      "position": 10,
      "exercise_type": "vocabulary_intake",
      "title": "Vocabulary intake",
      "objective": "Build an initial form-to-meaning representation and activate unseen lesson vocabulary in Leitner House 1.",
      "required": true,
      "prerequisites": [],
      "source_target_ids": ["target-001"],
      "extension_ids": [],
      "evidence": {
        "source_refs": ["Unit 1 vocabulary list"],
        "research_principle_ids": ["retrieval_practice"],
        "sequence_reason": "The learner needs an initial lexical representation before exact-form production."
      },
      "completion": {
        "evidence": "All unseen lesson vocabulary activated in Leitner House 1 and required intake slides attempted.",
        "mastery_gate": null
      },
      "slides": [
        {
          "id": "sample-unit-01-e01-s01",
          "type": "choice",
          "purpose": "Recognize the target meaning.",
          "target_ids": ["target-001"],
          "contract_status": "placeholder",
          "data": {
            "_placeholder": true,
            "instruction_intent": "Choose the correct meaning.",
            "prompt_or_stimulus": "sample",
            "expected_response": "The source-grounded definition of sample.",
            "feedback_intent": "Confirm the correct meaning and replay pronunciation when available."
          }
        }
      ]
    },
    {
      "id": "sample-unit-01-e02-spelling",
      "position": 20,
      "exercise_type": "spelling_dictation",
      "title": "Spelling and dictation",
      "objective": "Produce the exact written form from an aural cue.",
      "required": true,
      "prerequisites": [
        {
          "exercise_id": "sample-unit-01-e01-intake",
          "reason": "The learner should recognize the target before sound-to-form production."
        }
      ],
      "source_target_ids": ["target-001"],
      "extension_ids": [],
      "evidence": {
        "source_refs": ["Unit 1 vocabulary list"],
        "research_principle_ids": ["multidimensional_vocabulary"],
        "sequence_reason": "Exact-form production follows initial meaning recognition."
      },
      "completion": {
        "evidence": "All required dictation items attempted with exact-form feedback.",
        "mastery_gate": null
      },
      "slides": [
        {
          "id": "sample-unit-01-e02-s01",
          "type": "dictation",
          "purpose": "Produce the exact spelling from audio.",
          "target_ids": ["target-001"],
          "contract_status": "placeholder",
          "data": {
            "_placeholder": true,
            "instruction_intent": "Listen and type the word exactly.",
            "prompt_or_stimulus": "Pronunciation audio for sample.",
            "expected_response": "sample",
            "feedback_intent": "Show exact spelling after submission and allow learning-mode replay."
          }
        }
      ]
    }
  ],
  "coverage": {
    "source_target_ids": ["target-001"],
    "covered_target_ids": ["target-001"],
    "uncovered_target_ids": [],
    "vocora_extensions": []
  },
  "validation": {
    "status": "ready",
    "warnings": ["Per-slide runtime data is still using the provisional placeholder contract."],
    "blockers": []
  }
}
```
