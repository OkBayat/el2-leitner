#!/usr/bin/env python3
"""Focused tests for the lesson-plan validator."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).with_name("validate-lesson-plan.py")
SPEC = importlib.util.spec_from_file_location("validate_lesson_plan", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(MODULE)


def slide(slide_id: str, slide_type: str, target_id: str) -> dict:
    return {
        "id": slide_id,
        "type": slide_type,
        "purpose": "Practice the target with the intended cognitive action.",
        "target_ids": [target_id],
        "contract_status": "placeholder",
        "data": {
            "_placeholder": True,
            "instruction_intent": "Follow the source-grounded instruction.",
            "prompt_or_stimulus": "A source-grounded prompt or cue.",
            "expected_response": "The expected target response.",
            "feedback_intent": "Give corrective learning feedback after submission.",
        },
    }


def valid_plan() -> dict:
    return {
        "schema_version": 1,
        "lesson": {
            "id": "unit-01",
            "title": "Unit 1",
            "source": {
                "kind": "provided_content",
                "reference": "lesson source",
                "section": "Unit 1",
            },
            "learning_goals": ["Recognize and spell the target vocabulary."],
            "content_inventory": {
                "targets": [
                    {
                        "id": "target-001",
                        "kind": "vocabulary",
                        "label": "example",
                        "source_ref": "Unit 1 vocabulary list",
                        "leitner_eligible": True,
                    }
                ],
                "assets": [],
            },
            "content_gaps": [],
        },
        "design": {
            "sequence_strategy": "Recognition before exact-form production.",
            "research_principles": ["retrieval_practice", "multidimensional_vocabulary"],
            "notes": [],
        },
        "evidence_catalog": [
            {
                "id": "retrieval_practice",
                "kind": "research",
                "citation": "Roediger & Karpicke (2006)",
                "claim": "Retrieval can improve delayed retention.",
            },
            {
                "id": "multidimensional_vocabulary",
                "kind": "research",
                "citation": "Webb (2009)",
                "claim": "Vocabulary knowledge has multiple receptive and productive dimensions.",
            },
        ],
        "exercises": [
            {
                "id": "unit-01-e01-intake",
                "position": 10,
                "exercise_type": "vocabulary_intake",
                "title": "Vocabulary intake",
                "objective": "Recognize target meanings and activate unseen vocabulary in Leitner House 1.",
                "required": True,
                "prerequisites": [],
                "source_target_ids": ["target-001"],
                "extension_ids": [],
                "evidence": {
                    "source_refs": ["Unit 1 vocabulary list"],
                    "research_principle_ids": ["retrieval_practice"],
                    "sequence_reason": "Initial recognition comes before exact-form production.",
                },
                "completion": {
                    "evidence": "Unseen lesson vocabulary activated in Leitner House 1.",
                    "mastery_gate": None,
                },
                "slides": [slide("unit-01-e01-s01", "choice", "target-001")],
            },
            {
                "id": "unit-01-e02-spelling",
                "position": 20,
                "exercise_type": "spelling_dictation",
                "title": "Spelling and dictation",
                "objective": "Produce the exact written form from audio.",
                "required": True,
                "prerequisites": [
                    {
                        "exercise_id": "unit-01-e01-intake",
                        "reason": "The target should be recognized before exact-form production.",
                    }
                ],
                "source_target_ids": ["target-001"],
                "extension_ids": [],
                "evidence": {
                    "source_refs": ["Unit 1 vocabulary list"],
                    "research_principle_ids": ["multidimensional_vocabulary"],
                    "sequence_reason": "Exact form follows initial recognition.",
                },
                "completion": {
                    "evidence": "All required dictation items attempted.",
                    "mastery_gate": None,
                },
                "slides": [slide("unit-01-e02-s01", "dictation", "target-001")],
            },
        ],
        "coverage": {
            "source_target_ids": ["target-001"],
            "covered_target_ids": ["target-001"],
            "uncovered_target_ids": [],
            "vocora_extensions": [],
        },
        "validation": {
            "status": "ready",
            "warnings": ["Slide data uses the provisional placeholder contract."],
            "blockers": [],
        },
    }


class LessonPlanValidatorTests(unittest.TestCase):
    def test_allows_generic_selection_in_provisional_plans(self) -> None:
        self.assertIn("selection", MODULE.ALLOWED_SLIDE_TYPES)

    def test_accepts_minimal_valid_plan(self) -> None:
        self.assertEqual(MODULE.validate_plan(valid_plan()), [])

    def test_requires_fixed_opening_exercises(self) -> None:
        plan = valid_plan()
        plan["exercises"][0]["exercise_type"] = "meaning_in_context"
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("first exercise" in error for error in errors))

    def test_rejects_forward_prerequisite(self) -> None:
        plan = valid_plan()
        plan["exercises"][0]["prerequisites"] = [
            {"exercise_id": "unit-01-e02-spelling", "reason": "Invalid forward dependency."}
        ]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("earlier exercise" in error for error in errors))

    def test_requires_all_leitner_targets_in_spelling(self) -> None:
        plan = valid_plan()
        plan["exercises"][1]["source_target_ids"] = []
        plan["coverage"]["covered_target_ids"] = ["target-001"]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("spelling_dictation must cover all leitner_eligible" in error for error in errors))

    def test_rejects_unknown_slide_type(self) -> None:
        plan = valid_plan()
        plan["exercises"][1]["slides"][0]["type"] = "flashcard"
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("must be one of" in error and "flashcard" not in error for error in errors))

    def test_ready_plan_cannot_leave_source_target_uncovered(self) -> None:
        plan = valid_plan()
        plan["coverage"]["covered_target_ids"] = []
        plan["coverage"]["uncovered_target_ids"] = ["target-001"]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("ready requires no uncovered" in error for error in errors))

    def test_placeholder_contract_must_be_disclosed(self) -> None:
        plan = valid_plan()
        plan["validation"]["warnings"] = []
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("placeholder" in error for error in errors))

    def test_rejects_unknown_root_and_placeholder_data_fields(self) -> None:
        plan = valid_plan()
        plan["runtime_config"] = {}
        plan["exercises"][0]["slides"][0]["data"]["correct_option_ids"] = ["answer"]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("unexpected field: runtime_config" in error for error in errors))
        self.assertTrue(any("unexpected field: correct_option_ids" in error for error in errors))

    def test_requires_declared_exercise_targets_to_be_covered_by_its_slides(self) -> None:
        plan = valid_plan()
        second_target = {
            "id": "target-002",
            "kind": "vocabulary",
            "label": "second example",
            "source_ref": "Unit 1 vocabulary list",
            "leitner_eligible": True,
        }
        plan["lesson"]["content_inventory"]["targets"].append(second_target)
        plan["coverage"]["source_target_ids"].append("target-002")
        plan["coverage"]["covered_target_ids"].append("target-002")
        for exercise in plan["exercises"]:
            exercise["source_target_ids"].append("target-002")
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("slides do not cover declared targets: target-002" in error for error in errors))

    def test_rejects_slide_targets_outside_the_exercise_scope(self) -> None:
        plan = valid_plan()
        plan["coverage"]["vocora_extensions"] = [{
            "id": "extension-001",
            "reason": "A declared transfer target.",
        }]
        plan["exercises"][0]["slides"][0]["target_ids"].append("extension-001")
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("slides reference undeclared exercise targets: extension-001" in error for error in errors))

    def test_ready_plan_rejects_declared_content_gaps(self) -> None:
        plan = valid_plan()
        plan["lesson"]["content_gaps"] = ["The source audio is unavailable."]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("ready requires no content gaps" in error for error in errors))

    def test_requires_learning_goals_and_research_principles(self) -> None:
        plan = valid_plan()
        plan["lesson"]["learning_goals"] = []
        plan["design"]["research_principles"] = []
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("learning_goals must contain at least one goal" in error for error in errors))
        self.assertTrue(any("research_principles must contain at least one" in error for error in errors))

    def test_fixed_openings_reject_non_leitner_targets(self) -> None:
        plan = valid_plan()
        plan["lesson"]["content_inventory"]["targets"].append({
            "id": "target-002",
            "kind": "reading_comprehension",
            "label": "Passage detail",
            "source_ref": "Unit 1 reading",
            "leitner_eligible": False,
        })
        plan["coverage"]["source_target_ids"].append("target-002")
        plan["coverage"]["covered_target_ids"].append("target-002")
        for index, exercise in enumerate(plan["exercises"]):
            exercise["source_target_ids"].append("target-002")
            exercise["slides"].append(slide(
                f"unit-01-e0{index + 1}-s02",
                "choice" if index == 0 else "dictation",
                "target-002",
            ))
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("must target exactly the leitner_eligible scope" in error for error in errors))

    def test_source_targets_and_extensions_must_use_disjoint_ids(self) -> None:
        plan = valid_plan()
        plan["coverage"]["vocora_extensions"] = [{
            "id": "target-001",
            "reason": "Collides with a source target.",
        }]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("source target and extension IDs must be disjoint" in error for error in errors))

    def test_fixed_openings_reject_extension_targets(self) -> None:
        plan = valid_plan()
        plan["coverage"]["vocora_extensions"] = [{
            "id": "extension-001",
            "reason": "A declared transfer target.",
        }]
        for exercise in plan["exercises"]:
            exercise["extension_ids"] = ["extension-001"]
            exercise["slides"][0]["target_ids"].append("extension-001")
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("vocabulary_intake must not target Vocora extensions" in error for error in errors))
        self.assertTrue(any("spelling_dictation must not target Vocora extensions" in error for error in errors))

    def test_malformed_fixed_opening_targets_return_validation_errors(self) -> None:
        plan = valid_plan()
        plan["exercises"][0]["source_target_ids"] = [{"id": "target-001"}]
        errors = MODULE.validate_plan(plan)
        self.assertTrue(any("source_target_ids[0] must be a non-empty string" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
