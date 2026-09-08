#!/usr/bin/env python3
"""Focused tests for the K2 design-system skill validator."""

from __future__ import annotations

import copy
import importlib.util
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name("validate-design-system.py")
SPEC = importlib.util.spec_from_file_location("k2_design_system_validator", SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load validator from {SCRIPT_PATH}")
VALIDATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(VALIDATOR)


class K2DesignSystemValidatorTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.root = SCRIPT_PATH.resolve().parents[1]
        cls.tokens = VALIDATOR.load_tokens(cls.root)

    def test_current_skill_is_valid(self) -> None:
        self.assertEqual(VALIDATOR.validate(self.root), [])

    def test_current_skill_uses_k2_identity(self) -> None:
        skill = (self.root / "SKILL.md").read_text(encoding="utf-8")
        interface = (self.root / "agents" / "openai.yaml").read_text(encoding="utf-8")
        self.assertIn("name: k2-design-system", skill)
        self.assertIn("display_name: \"K2 Design System\"", interface)
        self.assertIn("$k2-design-system", interface)

    def test_light_is_required_as_default_theme(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["meta"]["defaultTheme"] = "dark"
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("meta.defaultTheme must be 'light'", errors)

    def test_light_and_dark_theme_groups_require_parity(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        del tokens["themes"]["dark"]["activity"]
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertTrue(
            any("exact parity" in error for error in errors),
            errors,
        )

    def test_semantic_keys_require_light_dark_parity(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        del tokens["themes"]["dark"]["state"]["future"]
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertTrue(
            any("Theme key parity failed for group 'state'" in error for error in errors),
            errors,
        )

    def test_invalid_hex_color_is_rejected(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["themes"]["light"]["state"]["success"] = "green"
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertTrue(
            any("Invalid hex color" in error for error in errors),
            errors,
        )

    def test_required_semantic_variables_are_present(self) -> None:
        text = (self.root / "references" / "variables.scss").read_text(encoding="utf-8")
        variables = VALIDATOR.extract_variables(text)
        self.assertTrue(VALIDATOR.REQUIRED_VARIABLES.issubset(variables))


if __name__ == "__main__":
    unittest.main()
