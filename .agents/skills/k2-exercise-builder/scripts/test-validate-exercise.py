#!/usr/bin/env python3
"""Focused tests for the runtime exercise validator."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("validate-exercise.py")
SPEC = importlib.util.spec_from_file_location("validate_exercise", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def valid_exercise() -> dict:
    return {
        "id": "choose-mode",
        "type": "slides.sequence",
        "schemaVersion": 1,
        "completionPolicy": "slide-sequence",
        "config": {
            "slides": [
                {
                    "id": "mode",
                    "type": "selection",
                    "data": {
                        "mode": "single",
                        "question": "Choose a practice mode.",
                        "options": [
                            {"id": "dictation", "label": "Vocabulary Dictation"},
                            {"id": "shadowing", "label": "Sentence Shadowing"},
                        ],
                    },
                },
                {"id": "finish", "type": "summary", "terminal": True, "data": {}},
            ]
        },
    }


class ExerciseValidatorTests(unittest.TestCase):
    def test_accepts_runtime_ready_selection_sequence(self) -> None:
        result = MODULE.validate_exercise(valid_exercise())
        self.assertEqual(result["status"], "valid")
        self.assertEqual(result["slide_types"], ["selection", "summary"])

    def test_rejects_unknown_slide_type(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0]["type"] = "custom-picker"
        with self.assertRaisesRegex(ValueError, "Unsupported slide type"):
            MODULE.validate_exercise(exercise)

    def test_rejects_non_terminal_final_slide(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][1].pop("terminal")
        with self.assertRaisesRegex(ValueError, "terminal final slide"):
            MODULE.validate_exercise(exercise)

    def test_rejects_selection_correctness_fields(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0]["data"]["correctOptionIds"] = ["dictation"]
        with self.assertRaisesRegex(ValueError, "must not define correctness"):
            MODULE.validate_exercise(exercise)

    def test_rejects_choice_without_answer_key(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0] = {
            "id": "answer",
            "type": "choice",
            "data": {
                "question": "Choose the answer.",
                "options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}],
            },
        }
        with self.assertRaisesRegex(ValueError, "correctOptionIds"):
            MODULE.validate_exercise(exercise)

    def test_allows_ordering_answer_key_to_reorder_configured_items(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0] = {
            "id": "order",
            "type": "ordering",
            "data": {
                "items": [{"id": "later", "label": "Later"}, {"id": "first", "label": "First"}],
                "correctOrderIds": ["first", "later"],
            },
        }
        self.assertEqual(MODULE.validate_exercise(exercise)["status"], "valid")


if __name__ == "__main__":
    unittest.main()
