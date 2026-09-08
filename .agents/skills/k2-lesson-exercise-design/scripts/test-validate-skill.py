#!/usr/bin/env python3
"""Focused tests for the skill-local wiring validator."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import shutil
import tempfile
import unittest

SCRIPT_DIR = Path(__file__).resolve().parent
SCRIPT = SCRIPT_DIR / "validate-skill.py"
SPEC = importlib.util.spec_from_file_location("validate_skill", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)
SOURCE_SKILL = SCRIPT_DIR.parent


class SkillValidatorTests(unittest.TestCase):
    def make_repo(self) -> tuple[tempfile.TemporaryDirectory, Path]:
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name)
        target_skill = root / ".agents" / "skills" / MODULE.SKILL_NAME
        target_skill.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(SOURCE_SKILL, target_skill)
        (root / "AGENTS.md").write_text(
            "# Agent guide\nAll engineering artifacts must be written in English unless explicitly requested otherwise.\n",
            encoding="utf-8",
        )
        (root / ".agents" / "AGENTS.md").write_text(
            f"# Skill routing\n- `{MODULE.SKILL_NAME}`: route lesson exercise design.\n",
            encoding="utf-8",
        )
        return temporary, root

    def test_accepts_complete_skill_wiring(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        result = MODULE.validate(root)
        self.assertEqual(result["status"], "valid")
        self.assertEqual(result["skill"], MODULE.SKILL_NAME)

    def test_requires_router_entry(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        (root / ".agents" / "AGENTS.md").write_text("# Skill routing\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "must route this skill"):
            MODULE.validate(root)

    def test_requires_placeholder_contract(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        contract = root / ".agents" / "skills" / MODULE.SKILL_NAME / "references" / "output-contract.md"
        contract.write_text(contract.read_text(encoding="utf-8").replace('"contract_status": "placeholder"', '"contract_status": "draft"'), encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "placeholder contract token"):
            MODULE.validate(root)

    def test_requires_spoken_word_recognition_evidence(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        reference = root / ".agents" / "skills" / MODULE.SKILL_NAME / "references" / "learning-design-rules.md"
        reference.write_text(
            reference.read_text(encoding="utf-8").replace("spoken_word_recognition", "removed_principle"),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(ValueError, "spoken_word_recognition"):
            MODULE.validate(root)


if __name__ == "__main__":
    unittest.main()
