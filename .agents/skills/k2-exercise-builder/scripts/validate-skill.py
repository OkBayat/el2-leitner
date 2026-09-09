#!/usr/bin/env python3
"""Validate local wiring for the k2-exercise-builder skill."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCHEMA_VERSION = 1
SKILL_NAME = "k2-exercise-builder"
SCRIPT = Path(__file__).resolve()
DEFAULT_REPO_ROOT = SCRIPT.parent.parent.parents[2]


def require(path: Path, root: Path) -> str:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"Required file is missing: {path.relative_to(root)}")
    value = path.read_text(encoding="utf-8")
    if not value.strip():
        raise ValueError(f"Required file is empty: {path.relative_to(root)}")
    return value


def validate(root: Path) -> dict:
    root = root.resolve()
    skill_dir = root / ".agents" / "skills" / SKILL_NAME
    skill = require(skill_dir / "SKILL.md", root)
    interface = require(skill_dir / "agents" / "openai.yaml", root)
    exercise_contract = require(skill_dir / "references" / "exercise-contract.md", root)
    catalog = require(skill_dir / "references" / "slide-catalog.md", root)
    validator = require(skill_dir / "scripts" / "validate-exercise.py", root)
    validator_tests = require(skill_dir / "scripts" / "test-validate-exercise.py", root)
    skill_tests = require(skill_dir / "scripts" / "test-validate-skill.py", root)
    root_agents = require(root / "AGENTS.md", root)
    router = require(root / ".agents" / "AGENTS.md", root)

    if f"name: {SKILL_NAME}\n" not in skill or "description:" not in skill:
        raise ValueError("SKILL.md must have canonical frontmatter.")
    for heading in ("## Workflow classification", "## Workflow", "## Stop conditions", "## Determinism Boundary", "### Script-owned", "### Agent-owned", "### Codex-owned", "### No manual fallback"):
        if heading not in skill:
            raise ValueError(f"SKILL.md is missing {heading}.")
    for reference in ("references/exercise-contract.md", "references/slide-catalog.md"):
        if reference not in skill:
            raise ValueError(f"SKILL.md must route {reference}.")
    if SKILL_NAME not in router:
        raise ValueError(f".agents/AGENTS.md must route {SKILL_NAME}.")
    if "Reusable slide constraint" not in root_agents:
        raise ValueError("Root AGENTS.md must retain the reusable slide constraint.")
    for token in ("interface:", "display_name:", "short_description:", "default_prompt:", f"${SKILL_NAME}"):
        if token not in interface:
            raise ValueError(f"agents/openai.yaml is missing {token}.")
    for slide_type in ("selection", "choice", "dictation", "speaking-response", "writing-response"):
        if f"`{slide_type}`" not in catalog:
            raise ValueError(f"Slide catalog is missing {slide_type}.")
    if '"type": "slides.sequence"' not in exercise_contract or '"terminal": true' not in exercise_contract:
        raise ValueError("Exercise contract is missing the canonical sequence envelope.")
    if "SLIDE_TYPES" not in validator or "validate_exercise(" not in validator:
        raise ValueError("Exercise validator must own the runtime contract checks.")
    if "unittest.main()" not in validator_tests or "unittest.main()" not in skill_tests:
        raise ValueError("Skill scripts require focused unittest coverage.")
    return {"schema_version": SCHEMA_VERSION, "status": "valid", "skill": SKILL_NAME, "files_checked": 9}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_REPO_ROOT)
    args = parser.parse_args(argv)
    try:
        result = validate(args.root)
    except (OSError, UnicodeError, ValueError) as error:
        print(json.dumps({"schema_version": SCHEMA_VERSION, "status": "invalid", "skill": SKILL_NAME, "error": str(error)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
