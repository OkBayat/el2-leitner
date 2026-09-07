#!/usr/bin/env python3
"""Validate the local architecture contract for the BBC listening bundle skill."""
from __future__ import annotations

import json
from pathlib import Path
import sys

SCHEMA_VERSION = 1
SKILL_NAME = "k2-bbc-listening-bundles"
SCRIPT = Path(__file__).resolve()
SKILL_DIR = SCRIPT.parent.parent
REPO_ROOT = SKILL_DIR.parents[2]


def require_text(path: Path) -> str:
    if not path.is_file() or path.is_symlink():
        raise ValueError(f"Required regular file is missing: {path.relative_to(REPO_ROOT)}")
    text = path.read_text(encoding="utf-8")
    if not text.strip():
        raise ValueError(f"Required file is empty: {path.relative_to(REPO_ROOT)}")
    return text


def validate() -> dict:
    root_agents = require_text(REPO_ROOT / "AGENTS.md")
    router = require_text(REPO_ROOT / ".agents" / "AGENTS.md")
    skill = require_text(SKILL_DIR / "SKILL.md")
    interface = require_text(SKILL_DIR / "agents" / "openai.yaml")
    reference = require_text(SKILL_DIR / "references" / "authoring-workflow.md")
    planner = require_text(SKILL_DIR / "scripts" / "bundle-request.py")
    planner_tests = require_text(SKILL_DIR / "scripts" / "test-bundle-request.py")
    design = require_text(SKILL_DIR / "references" / "ielts-question-design.md")
    quality = require_text(REPO_ROOT / "back/src/infrastructure/content/validateListeningQuestionQuality.js")
    canonical_validator = require_text(REPO_ROOT / "back/scripts/validate-listening-lessons.js")
    review_owner = require_text(REPO_ROOT / "back/scripts/record-listening-question-review.js")
    for name in ("listening-question-quality.test.js", "listening-catalog-quality.test.js", "listening-review-command.test.js"):
        require_text(REPO_ROOT / "back/tests" / name)

    if not skill.startswith("---\n") or f"name: {SKILL_NAME}\n" not in skill.split("---", 2)[1]:
        raise ValueError("SKILL.md must have canonical frontmatter and skill name.")
    if "description:" not in skill.split("---", 2)[1]:
        raise ValueError("SKILL.md frontmatter must include a description.")

    required_skill_sections = (
        "## Determinism Boundary",
        "### Script-owned",
        "### Codex-owned",
        "### No manual fallback",
        "## Stop conditions",
    )
    for section in required_skill_sections:
        if section not in skill:
            raise ValueError(f"SKILL.md is missing required section: {section}")

    if "references/ielts-question-design.md" not in skill:
        raise ValueError("SKILL.md must route the mandatory question-design reference before authoring.")
    for token in ("exactly TEN", "TEN questions", "Audio chronology", "Difficulty rubric", "ielts.org", "britishcouncil.org"):
        if token not in design:
            raise ValueError(f"Question-design rules are missing required content: {token}")
    if "REQUIRED_LISTENING_QUESTIONS = 10" not in quality or "validateListeningQuestionQuality" not in canonical_validator:
        raise ValueError("The canonical episode validator must enforce the question-quality gate.")
    if "--confirm-reviewed" not in review_owner or "listeningReviewDigest" not in review_owner:
        raise ValueError("The review owner must require explicit confirmation and bind the review digest.")

    if "references/authoring-workflow.md" not in skill:
        raise ValueError("SKILL.md must lazy-route the authoring reference explicitly.")
    if "bundle-request.py plan" not in skill or "bundle-request.py verify-delivery" not in skill:
        raise ValueError("SKILL.md must route deterministic planning and delivery verification to the owner script.")
    if "back/scripts/manage-listening-episode.py" not in skill:
        raise ValueError("SKILL.md must route episode package operations to the application owner.")

    if "## Language rule" not in root_agents or "All engineering artifacts must be written in English" not in root_agents:
        raise ValueError("Root AGENTS.md must contain the repository English engineering-artifact rule.")
    if SKILL_NAME not in router:
        raise ValueError(".agents/AGENTS.md must route this skill.")

    required_interface_tokens = (
        "interface:",
        "display_name:",
        "short_description:",
        "default_prompt:",
        f"${SKILL_NAME}",
    )
    for token in required_interface_tokens:
        if token not in interface:
            raise ValueError(f"agents/openai.yaml is missing required token: {token}")

    if "Official source resolution" not in reference or "Test authoring sequence" not in reference:
        raise ValueError("The phase-lazy authoring reference is incomplete.")
    if "def verify_delivery(" not in planner or "def bind_discovery(" not in planner:
        raise ValueError("The planner must own discovery binding and final delivery verification.")
    if "unittest.main()" not in planner_tests:
        raise ValueError("The deterministic planner must have focused executable tests.")

    application_contracts = (
        REPO_ROOT / "back" / "data" / "listening" / "episodes" / "README.md",
        REPO_ROOT / "back" / "scripts" / "manage-listening-episode.py",
    )
    for path in application_contracts:
        if not path.is_file():
            raise ValueError(f"Required application contract is missing: {path.relative_to(REPO_ROOT)}")

    return {
        "schema_version": SCHEMA_VERSION,
        "status": "valid",
        "skill": SKILL_NAME,
        "files_checked": 16,
    }


def main() -> int:
    try:
        print(json.dumps(validate(), indent=2))
        return 0
    except (OSError, UnicodeError, ValueError) as error:
        print(json.dumps({
            "schema_version": SCHEMA_VERSION,
            "status": "invalid",
            "skill": SKILL_NAME,
            "error": str(error),
        }, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
