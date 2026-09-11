#!/usr/bin/env python3
"""Focused tests for the K2 design-system validator."""

from __future__ import annotations

import copy
import importlib.util
import json
import tempfile
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

    def test_action_roles_cannot_drift(self) -> None:
        tokens = copy.deepcopy(self.tokens)
        tokens["themes"]["light"]["action"]["primary"] = "#58CC02"
        tokens["themes"]["light"]["action"]["secondaryForeground"] = "#1CB0F6"
        tokens["themes"]["light"]["action"]["disabledBackground"] = "#AFAFAF"
        tokens["themes"]["dark"]["action"]["success"] = "#49C0F8"
        tokens["themes"]["dark"]["action"]["secondaryForeground"] = "#F0F7F2"
        errors: list[str] = []
        VALIDATOR.validate_tokens(tokens, errors)
        self.assertIn(
            "themes.light.action.primary must equal #1CB0F6",
            errors,
        )
        self.assertIn(
            "themes.light.action.secondaryForeground must equal #4B4B4B",
            errors,
        )
        self.assertIn(
            "themes.light.action.disabledBackground must equal #D9D9D9",
            errors,
        )
        self.assertIn(
            "themes.dark.action.success must equal #72D72B",
            errors,
        )
        self.assertIn(
            "themes.dark.action.secondaryForeground must equal #4B4B4B",
            errors,
        )

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
        self.assertIn("The canonical button radius must be 13px", errors)

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

    def test_frontend_contract_defines_the_complete_decision_hierarchy(self) -> None:
        design = (self.root / "references" / "DESIGN.md").read_text(
            encoding="utf-8"
        )
        hierarchy = (
            "Existing Vocora shared primitive?",
            "Standard interactive primitive in Angular Material?",
            "Required behavior available in Angular CDK?",
            "Layout, spacing, display, or semantic utility in Bootstrap?",
            "Existing shared style or semantic token?",
            "Otherwise",
        )
        positions = [design.index(item) for item in hierarchy]
        self.assertEqual(positions, sorted(positions))
        self.assertIn("## Touch-to-refactor", design)
        self.assertIn("## Custom CSS last", design)
        self.assertIn("## Specificity and `!important`", design)

    def test_frontend_architecture_rejects_non_owner_theme_definitions(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self._write_baseline(repo)
            feature = repo / "ui/src/app/features/example/example.component.scss"
            feature.parent.mkdir(parents=True)
            feature.write_text(
                ":host { --bs-primary: red; --mat-sys-primary: blue; "
                "--color-spark-blue: green; }",
                encoding="utf-8",
            )
            errors: list[str] = []

            VALIDATOR.validate_frontend_architecture(repo, errors)

            self.assertIn(
                "Bootstrap semantic variables must be defined only in "
                "ui/src/styles/_bootstrap-theme.scss: "
                "ui/src/app/features/example/example.component.scss defines --bs-primary",
                errors,
            )
            self.assertIn(
                "Material system variables must be defined only in "
                "ui/src/styles/_angular-material-theme.scss: "
                "ui/src/app/features/example/example.component.scss defines --mat-sys-primary",
                errors,
            )
            self.assertIn(
                "Vocora foundation colors must be defined only in "
                "ui/src/styles/_vocora-design-system.scss: "
                "ui/src/app/features/example/example.component.scss defines --color-spark-blue",
                errors,
            )

    def test_frontend_architecture_rejects_unbaselined_specificity_debt(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory)
            self._write_baseline(repo)
            feature = repo / "ui/src/app/features/example/example.component.scss"
            feature.parent.mkdir(parents=True)
            feature.write_text(
                ".mat-mdc-example { color: red !important; }",
                encoding="utf-8",
            )
            errors: list[str] = []

            VALIDATOR.validate_frontend_architecture(repo, errors)

            self.assertIn(
                "Untracked !important debt in "
                "ui/src/app/features/example/example.component.scss: expected 0, found 1",
                errors,
            )
            self.assertIn(
                "Untracked feature Material-internal selector debt in "
                "ui/src/app/features/example/example.component.scss: expected 0, found 1",
                errors,
            )

    @staticmethod
    def _write_baseline(repo: Path) -> None:
        baseline = (
            repo
            / ".agents/skills/k2-design-system/references/legacy-style-baseline.json"
        )
        baseline.parent.mkdir(parents=True)
        baseline.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "important_declaration_counts": {},
                    "feature_material_internal_selector_counts": {},
                }
            ),
            encoding="utf-8",
        )


if __name__ == "__main__":
    unittest.main()
