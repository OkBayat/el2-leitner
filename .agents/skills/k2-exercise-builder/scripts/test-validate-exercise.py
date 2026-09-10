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
                        "expansionId": "house-one-practice",
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

    def test_rejects_an_empty_selection_expansion_id(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0]["data"]["expansionId"] = "   "
        with self.assertRaisesRegex(ValueError, "Selection expansionId"):
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

    def test_accepts_target_grammar_rewrite_mode(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0] = {
            "id": "habit-rewrite",
            "type": "rewrite",
            "data": {
                "mode": "target-grammar",
                "original": "Tom play football every Saturday.",
                "instruction": "Correct one word.",
                "modelAnswer": "Tom plays football every Saturday.",
                "acceptedAnswers": ["Tom plays football every Saturday."],
            },
        }

        self.assertEqual(MODULE.validate_exercise(exercise)["status"], "valid")

    def test_rejects_rewrite_answers_that_need_more_than_two_word_edits(self) -> None:
        with self.assertRaisesRegex(ValueError, "one or two word edits"):
            MODULE.validate_slide_data(
                "rewrite",
                {
                    "mode": "target-grammar",
                    "original": "Tom's normal Saturday activity is football.",
                    "modelAnswer": "Tom plays football every Saturday.",
                    "acceptedAnswers": ["Tom plays football every Saturday."],
                },
            )

    def test_rejects_fragment_scoring_for_rewrite_slides(self) -> None:
        with self.assertRaisesRegex(ValueError, "exact acceptedAnswers"):
            MODULE.validate_slide_data(
                "rewrite",
                {
                    "original": "Tom play football every Saturday.",
                    "modelAnswer": "Tom plays football every Saturday.",
                    "acceptedAnswers": ["Tom plays football every Saturday."],
                    "requiredFragments": ["plays"],
                },
            )

    def test_rejects_every_unsupported_runtime_enum_value(self) -> None:
        for slide_type, fields in MODULE.ENUM_FIELDS.items():
            for field in fields:
                data = {
                    required_field: sorted(allowed)[0]
                    for required_field, (allowed, required) in fields.items()
                    if required
                }
                data[field] = "not-a-runtime-value"
                with self.subTest(slide_type=slide_type, field=field):
                    with self.assertRaisesRegex(ValueError, "unsupported"):
                        MODULE.validate_enum_fields(slide_type, data)

    def test_rejects_an_unsupported_teaching_block_kind(self) -> None:
        with self.assertRaisesRegex(ValueError, "Teaching block kind is unsupported"):
            MODULE.validate_slide_data(
                "teaching-card",
                {
                    "mode": "rule",
                    "title": "Rule",
                    "blocks": [{"kind": "unknown", "content": "Read."}],
                },
            )

    def test_accepts_markdown_only_teaching_cards(self) -> None:
        MODULE.validate_slide_data(
            "teaching-card",
            {
                "mode": "rule",
                "title": "Present simple",
                "markdown": "### Form\n- Use **does** with he, she and it.",
            },
        )

    def test_accepts_teaching_card_with_progress_removed_from_header(self) -> None:
        exercise = valid_exercise()
        exercise["config"]["slides"][0] = {
            "id": "rule",
            "type": "teaching-card",
            "data": {
                "mode": "rule",
                "title": "Present simple",
                "markdown": "### Form\n- Use **does** with he, she and it.",
            },
            "chrome": {"header": {"progress": None}},
        }

        self.assertEqual(MODULE.validate_exercise(exercise)["status"], "valid")

    def test_rejects_teaching_card_without_explicitly_hidden_progress(self) -> None:
        for chrome in (None, {}, {"header": {}}, {"header": {"progress": True}}):
            exercise = valid_exercise()
            slide = {
                "id": "rule",
                "type": "teaching-card",
                "data": {
                    "mode": "rule",
                    "title": "Present simple",
                    "markdown": "### Form\nUse the base verb.",
                },
            }
            if chrome is not None:
                slide["chrome"] = chrome
            exercise["config"]["slides"][0] = slide
            with self.subTest(chrome=chrome):
                with self.assertRaisesRegex(ValueError, "chrome.header.progress must be null"):
                    MODULE.validate_exercise(exercise)

    def test_requires_exactly_one_teaching_card_content_format(self) -> None:
        for data in (
            {"mode": "rule", "title": "Missing content"},
            {
                "mode": "rule",
                "title": "Duplicate content",
                "markdown": "### Rule\nUse the base verb.",
                "blocks": [{"kind": "note", "content": "Use the base verb."}],
            },
        ):
            with self.subTest(title=data["title"]):
                with self.assertRaisesRegex(ValueError, "exactly one"):
                    MODULE.validate_slide_data("teaching-card", data)

    def test_rejects_empty_teaching_card_content(self) -> None:
        for field, value, error in (
            ("markdown", "   ", "Teaching card markdown"),
            ("blocks", [], "Teaching card blocks"),
        ):
            with self.subTest(field=field):
                with self.assertRaisesRegex(ValueError, error):
                    MODULE.validate_slide_data(
                        "teaching-card",
                        {"mode": "rule", "title": "Empty content", field: value},
                    )


if __name__ == "__main__":
    unittest.main()
