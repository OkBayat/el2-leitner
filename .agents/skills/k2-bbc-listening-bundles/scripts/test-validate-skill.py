#!/usr/bin/env python3
"""Focused tests for the BBC bundle skill architecture validator."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).with_name("validate-skill.py")
SPEC = importlib.util.spec_from_file_location("k2_bbc_skill_validator", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load validate-skill.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SkillValidatorTests(unittest.TestCase):
    def test_repository_skill_contract_is_valid(self) -> None:
        result = MODULE.validate()
        self.assertEqual(result["status"], "valid")
        self.assertEqual(result["skill"], "k2-bbc-listening-bundles")
        self.assertGreaterEqual(result["files_checked"], 9)

    def reject_missing_text(self, target: str, token: str, message: str) -> None:
        original = MODULE.require_text
        def modified(path: Path) -> str:
            value = original(path)
            return value.replace(token, "removed-contract") if str(path).endswith(target) else value
        with patch.object(MODULE, "require_text", side_effect=modified):
            with self.assertRaisesRegex(ValueError, message):
                MODULE.validate()

    def test_design_reference_is_required_before_authoring(self) -> None:
        self.reject_missing_text("SKILL.md", "references/ielts-question-design.md", "design")

    def test_canonical_validator_must_call_quality_gate(self) -> None:
        self.reject_missing_text("validate-listening-lessons.js", "validateListeningQuestionQuality", "quality")

    def test_review_owner_requires_explicit_confirmation(self) -> None:
        self.reject_missing_text("record-listening-question-review.js", "--confirm-reviewed", "confirmation")


if __name__ == "__main__":
    unittest.main()
