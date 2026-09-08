---
type: Playbook
title: OKF Maintenance
description: Update K2 OKF through small evidence-backed changes.
tags: [okf, maintenance, review]
timestamp: 2026-09-08T04:00:00Z
---

K2 OKF updates should be small, durable, and evidence-backed.

# Rules

* Keep OKF as Markdown concepts with YAML frontmatter plus reserved `index.md`
  and `log.md` files.
* Do not add generated machine indexes or unrelated formats unless the adopted
  OKF specification requires them.
* Do not duplicate facts across concepts. Put each fact in one authoritative
  concept and link to it from related concepts.
* Do not record uncertain project knowledge as fact.
* Do not copy project-specific knowledge from another repository merely because
  its OKF structure was used as a template.
* Update the relevant indexes and `okf/log.md` whenever durable knowledge is
  added, corrected, or removed.

# Citations

[1] [Open Knowledge Format specification](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md)
[2] [Vocora agent guide](../../AGENTS.md)
