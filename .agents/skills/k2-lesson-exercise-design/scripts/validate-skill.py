#!/usr/bin/env python3
"""Validate local wiring for the k2-lesson-exercise-design skill."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCHEMA_VERSION = 1
SKILL_NAME = "k2-lesson-exercise-design"
SCRIPT = Path(__file__).resolve()
DEFAULT_REPO_ROOT = SCRIPT.parent.parent.parents[2]


def require_text(path: Path, repo_root: Path) -> str:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"Required regular file is missing: {path.relative_to(repo_root)}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"Required file is empty: {path.relative_to(repo_root)}")
    return text


def validate(repo_root: Path) -> dict:
    repo_root = repo_root.resolve()
    skill_dir = repo_root / ".agents" / "skills" / SKILL_NAME
    root_agents = require_text(repo_root / "AGENTS.md", repo_root)
    router = require_text(repo_root / ".agents" / "AGENTS.md", repo_root)
    skill = require_text(skill_dir / "SKILL.md", repo_root)
    interface = require_text(skill_dir / "agents" / "openai.yaml", repo_root)
    learning_rules = require_text(skill_dir / "references" / "learning-design-rules.md", repo_root)
    output_contract = require_text(skill_dir / "references" / "output-contract.md", repo_root)
    plan_validator = require_text(skill_dir / "scripts" / "validate-lesson-plan.py", repo_root)
    plan_tests = require_text(skill_dir / "scripts" / "test-validate-lesson-plan.py", repo_root)
    skill_tests = require_text(skill_dir / "scripts" / "test-validate-skill.py", repo_root)

    frontmatter = skill.split("---", 2)
    if len(frontmatter) < 3 or f"name: {SKILL_NAME}\n" not in frontmatter[1]:
        raise ValueError("SKILL.md must have canonical frontmatter and skill name.")
    if "description:" not in frontmatter[1]:
        raise ValueError("SKILL.md frontmatter must include a description.")

    required_sections = (
        "## Workflow classification",
        "## Global invariants",
        "## Authoring workflow",
        "## Stop conditions",
        "## Determinism Boundary",
        "### Script-owned",
        "### Agent-owned",
        "### Codex-owned",
        "### No manual fallback",
    )
    for section in required_sections:
        if section not in skill:
            raise ValueError(f"SKILL.md is missing required section: {section}")

    for reference in (
        "references/learning-design-rules.md",
        "references/output-contract.md",
    ):
        if reference not in skill:
            raise ValueError(f"SKILL.md must lazy-route {reference}.")

    if "All engineering artifacts must be written in English" not in root_agents:
        raise ValueError("Root AGENTS.md must retain the English engineering-artifact rule.")
    if SKILL_NAME not in router:
        raise ValueError(".agents/AGENTS.md must route this skill.")

    for token in (
        "interface:",
        "display_name:",
        "short_description:",
        "default_prompt:",
        f"${SKILL_NAME}",
    ):
        if token not in interface:
            raise ValueError(f"agents/openai.yaml is missing required token: {token}")

    for principle in (
        "retrieval_practice",
        "distributed_practice",
        "multidimensional_vocabulary",
        "collocation_learning",
        "lexical_listening_support",
        "spoken_word_recognition",
        "pre_listening_support_limits",
        "productive_involvement",
    ):
        if principle not in learning_rules:
            raise ValueError(f"Learning-design reference is missing research principle: {principle}")

    for token in (
        '"exercise_type": "vocabulary_intake"',
        '"exercise_type": "spelling_dictation"',
        '"contract_status": "placeholder"',
        "teaching-card",
        "writing-response",
    ):
        if token not in output_contract:
            raise ValueError(f"Output contract is missing required placeholder contract token: {token}")

    if "ALLOWED_SLIDE_TYPES" not in plan_validator or "validate_plan(" not in plan_validator:
        raise ValueError("The lesson-plan validator must own the deterministic output contract checks.")
    if "unittest.main()" not in plan_tests or "unittest.main()" not in skill_tests:
        raise ValueError("Skill validators must have focused executable unittest coverage.")

    return {
        "schema_version": SCHEMA_VERSION,
        "status": "valid",
        "skill": SKILL_NAME,
        "files_checked": 9,
    }


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=DEFAULT_REPO_ROOT, help="Repository root.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        result = validate(args.root)
    except (OSError, UnicodeError, ValueError) as error:
        print(json.dumps({
            "schema_version": SCHEMA_VERSION,
            "status": "invalid",
            "skill": SKILL_NAME,
            "error": str(error),
        }, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
