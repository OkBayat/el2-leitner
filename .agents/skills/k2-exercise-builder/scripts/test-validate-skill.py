#!/usr/bin/env python3
"""Focused tests for the skill wiring validator."""
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
        target = root / ".agents" / "skills" / MODULE.SKILL_NAME
        target.parent.mkdir(parents=True)
        shutil.copytree(SOURCE_SKILL, target)
        (root / "AGENTS.md").write_text("# Guide\n## Reusable slide constraint\n", encoding="utf-8")
        (root / ".agents" / "AGENTS.md").write_text(
            f"# Skill routing\n- `{MODULE.SKILL_NAME}`: build exercises.\n",
            encoding="utf-8",
        )
        return temporary, root

    def test_accepts_complete_skill(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        self.assertEqual(MODULE.validate(root)["status"], "valid")

    def test_requires_router_entry(self) -> None:
        temporary, root = self.make_repo()
        self.addCleanup(temporary.cleanup)
        (root / ".agents" / "AGENTS.md").write_text("# Skill routing\n", encoding="utf-8")
        with self.assertRaisesRegex(ValueError, "must route"):
            MODULE.validate(root)


if __name__ == "__main__":
    unittest.main()
