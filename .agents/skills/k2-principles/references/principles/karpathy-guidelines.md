# Karpathy Guidelines

Use these as baseline reminders for every mutation task.

## Think before coding

- Surface assumptions and material ambiguity before acting.
- Inspect the relevant source and contracts instead of guessing.
- Prefer the simpler valid interpretation when it satisfies the accepted task.
- Explain a meaningful tradeoff before choosing it.

## Simplicity first

- Implement only requested behavior.
- Do not add speculative flexibility, configurability, or abstraction.
- Prefer the smallest coherent solution.
- If the implementation is materially larger than the problem, simplify it.

## Surgical changes

- Touch only files and lines traceable to the accepted task.
- Do not refactor, reformat, rename, or clean adjacent code.
- Match the existing local style.
- Remove only unused code created by the current change.
- Report unrelated problems separately.

## Goal-driven execution

- Translate the request into concrete, observable success criteria.
- Use the smallest verification that proves each changed behavior.
- For multi-step work, keep a short plan with an explicit verification result.
- Do not claim completion from confidence or appearance.

These reminders are adapted from Andrej Karpathy's published observations about
common LLM coding mistakes. More specific Vocora repository, domain, workflow,
and safety contracts take precedence.
