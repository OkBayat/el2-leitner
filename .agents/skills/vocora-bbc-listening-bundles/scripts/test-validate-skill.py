#!/usr/bin/env python3
"""Focused tests for the BBC bundle skill architecture validator."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("validate-skill.py")
SPEC = importlib.util.spec_from_file_location("vocora_bbc_skill_validator", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load validate-skill.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SkillValidatorTests(unittest.TestCase):
    def test_repository_skill_contract_is_valid(self) -> None:
        result = MODULE.validate()
        self.assertEqual(result["status"], "valid")
        self.assertEqual(result["skill"], "vocora-bbc-listening-bundles")
        self.assertGreaterEqual(result["files_checked"], 9)


if __name__ == "__main__":
    unittest.main()
