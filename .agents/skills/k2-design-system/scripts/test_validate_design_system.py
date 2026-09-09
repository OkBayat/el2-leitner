#!/usr/bin/env python3
"""Focused tests for the K2 design-system validator."""

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
        self.assertIn('display_name: "K2 Design System"', interface)
        self.assertIn("$k2-design-system", interface)

    def test_canonical_palette_values_cannot_drift(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["color"]["spark-blue"]["$value"] = "#000000"
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("color.spark-blue must equal #1CB0F6", errors)

    def test_token_type_is_required(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        del tokens["color"]["eager-green"]["$type"]
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("color.eager-green must use type color", errors)

    def test_token_description_is_required(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["font"]["feather"]["$description"] = ""
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("font.feather must have a description", errors)

    def test_button_geometry_is_required(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["$extensions"]["com.vocora.design-system"]["buttonRadius"] = "8px"
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("The canonical button radius must be 12px", errors)

    def test_light_and_dark_theme_keys_require_parity(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        del tokens["themes"]["dark"]["action"]["error"]
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn("Theme key parity failed for group 'action'", errors)

    def test_css_variables_match_the_canonical_palette(self) -> None:
        variables = VALIDATOR.extract_css_variables(
            (self.root / "references" / "variables.scss").read_text(
                encoding="utf-8"
            )
        )
        for name, value in VALIDATOR.CANONICAL_COLORS.items():
            self.assertEqual(variables[f"--color-{name}"].lower(), value.lower())


if __name__ == "__main__":
    unittest.main()
