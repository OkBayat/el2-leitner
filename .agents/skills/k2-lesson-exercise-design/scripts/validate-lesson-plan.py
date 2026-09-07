#!/usr/bin/env python3
"""Validate the canonical k2-lesson-exercise-design lesson-plan envelope."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCHEMA_VERSION = 1
ALLOWED_SLIDE_TYPES = {
    "teaching-card", "choice", "truth", "matching", "classification", "ordering",
    "cloze", "structured-completion", "short-answer", "word-formation",
    "error-correction", "rewrite", "pronunciation", "dictation",
    "speaking-response", "writing-response",
}
EVIDENCE_KINDS = {"research", "design_synthesis", "source_rule"}
VALIDATION_STATUSES = {"ready", "blocked"}


def obj(value: Any, path: str, errors: list[str]) -> dict[str, Any]:
    if not isinstance(value, dict):
        errors.append(f"{path} must be an object")
        return {}
    return value


def arr(value: Any, path: str, errors: list[str]) -> list[Any]:
    if not isinstance(value, list):
        errors.append(f"{path} must be an array")
        return []
    return value


def text(value: Any, path: str, errors: list[str]) -> str:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{path} must be a non-empty string")
        return ""
    return value.strip()


def strings(value: Any, path: str, errors: list[str]) -> list[str]:
    return [text(item, f"{path}[{i}]", errors) for i, item in enumerate(arr(value, path, errors))]


def duplicate_check(values: list[str], path: str, errors: list[str]) -> None:
    duplicates = sorted({value for value in values if values.count(value) > 1})
    if duplicates:
        errors.append(f"{path} contains duplicate values: {', '.join(duplicates)}")


def validate_plan(plan: Any) -> list[str]:
    errors: list[str] = []
    root = obj(plan, "$", errors)
    if root.get("schema_version") != SCHEMA_VERSION:
        errors.append(f"schema_version must equal {SCHEMA_VERSION}")

    lesson = obj(root.get("lesson"), "lesson", errors)
    text(lesson.get("id"), "lesson.id", errors)
    text(lesson.get("title"), "lesson.title", errors)
    source = obj(lesson.get("source"), "lesson.source", errors)
    text(source.get("kind"), "lesson.source.kind", errors)
    text(source.get("reference"), "lesson.source.reference", errors)
    if source.get("section") is not None and not isinstance(source.get("section"), str):
        errors.append("lesson.source.section must be a string or null")
    strings(lesson.get("learning_goals"), "lesson.learning_goals", errors)
    strings(lesson.get("content_gaps"), "lesson.content_gaps", errors)

    inventory = obj(lesson.get("content_inventory"), "lesson.content_inventory", errors)
    targets = arr(inventory.get("targets"), "lesson.content_inventory.targets", errors)
    assets = arr(inventory.get("assets"), "lesson.content_inventory.assets", errors)
    if not targets:
        errors.append("lesson.content_inventory.targets must contain at least one source target")

    target_ids: list[str] = []
    leitner_ids: set[str] = set()
    for i, raw in enumerate(targets):
        path = f"lesson.content_inventory.targets[{i}]"
        target = obj(raw, path, errors)
        target_id = text(target.get("id"), f"{path}.id", errors)
        text(target.get("kind"), f"{path}.kind", errors)
        text(target.get("label"), f"{path}.label", errors)
        text(target.get("source_ref"), f"{path}.source_ref", errors)
        eligible = target.get("leitner_eligible")
        if not isinstance(eligible, bool):
            errors.append(f"{path}.leitner_eligible must be a boolean")
        if target_id:
            target_ids.append(target_id)
            if eligible is True:
                leitner_ids.add(target_id)
    duplicate_check(target_ids, "lesson.content_inventory.targets[].id", errors)
    if not leitner_ids:
        errors.append("lesson must contain at least one leitner_eligible target for the fixed opening exercises")

    asset_ids: list[str] = []
    for i, raw in enumerate(assets):
        path = f"lesson.content_inventory.assets[{i}]"
        asset = obj(raw, path, errors)
        asset_id = text(asset.get("id"), f"{path}.id", errors)
        text(asset.get("kind"), f"{path}.kind", errors)
        text(asset.get("source_ref"), f"{path}.source_ref", errors)
        if not isinstance(asset.get("available"), bool):
            errors.append(f"{path}.available must be a boolean")
        if asset_id:
            asset_ids.append(asset_id)
    duplicate_check(asset_ids, "lesson.content_inventory.assets[].id", errors)

    design = obj(root.get("design"), "design", errors)
    text(design.get("sequence_strategy"), "design.sequence_strategy", errors)
    design_principles = strings(design.get("research_principles"), "design.research_principles", errors)
    strings(design.get("notes"), "design.notes", errors)

    catalog = arr(root.get("evidence_catalog"), "evidence_catalog", errors)
    evidence_ids: list[str] = []
    evidence_kinds: dict[str, str] = {}
    for i, raw in enumerate(catalog):
        path = f"evidence_catalog[{i}]"
        evidence = obj(raw, path, errors)
        evidence_id = text(evidence.get("id"), f"{path}.id", errors)
        kind = text(evidence.get("kind"), f"{path}.kind", errors)
        if kind and kind not in EVIDENCE_KINDS:
            errors.append(f"{path}.kind must be one of: {', '.join(sorted(EVIDENCE_KINDS))}")
        text(evidence.get("citation"), f"{path}.citation", errors)
        text(evidence.get("claim"), f"{path}.claim", errors)
        if evidence_id:
            evidence_ids.append(evidence_id)
            evidence_kinds[evidence_id] = kind
    duplicate_check(evidence_ids, "evidence_catalog[].id", errors)
    evidence_set = set(evidence_ids)
    for principle in design_principles:
        if principle not in evidence_set:
            errors.append(f"design.research_principles references unknown evidence id: {principle}")
        elif evidence_kinds.get(principle) != "research":
            errors.append(f"design.research_principles must reference research evidence: {principle}")

    coverage = obj(root.get("coverage"), "coverage", errors)
    coverage_source = strings(coverage.get("source_target_ids"), "coverage.source_target_ids", errors)
    covered = strings(coverage.get("covered_target_ids"), "coverage.covered_target_ids", errors)
    uncovered = strings(coverage.get("uncovered_target_ids"), "coverage.uncovered_target_ids", errors)
    for values, path in ((coverage_source, "coverage.source_target_ids"), (covered, "coverage.covered_target_ids"), (uncovered, "coverage.uncovered_target_ids")):
        duplicate_check(values, path, errors)
    if set(coverage_source) != set(target_ids):
        errors.append("coverage.source_target_ids must exactly match lesson target IDs")
    if set(covered) & set(uncovered):
        errors.append("coverage.covered_target_ids and uncovered_target_ids must be disjoint")
    if set(covered) | set(uncovered) != set(target_ids):
        errors.append("covered and uncovered target IDs must partition all lesson target IDs")

    extensions = arr(coverage.get("vocora_extensions"), "coverage.vocora_extensions", errors)
    extension_ids: list[str] = []
    for i, raw in enumerate(extensions):
        path = f"coverage.vocora_extensions[{i}]"
        extension = obj(raw, path, errors)
        extension_id = text(extension.get("id"), f"{path}.id", errors)
        text(extension.get("reason"), f"{path}.reason", errors)
        if extension_id:
            extension_ids.append(extension_id)
    duplicate_check(extension_ids, "coverage.vocora_extensions[].id", errors)
    known_targets = set(target_ids) | set(extension_ids)

    exercises = arr(root.get("exercises"), "exercises", errors)
    if len(exercises) < 2:
        errors.append("exercises must contain at least the two fixed opening exercises")
    normalized: list[dict[str, Any]] = []
    exercise_ids: list[str] = []
    positions: list[int] = []
    slide_ids: list[str] = []
    exercise_source_union: set[str] = set()
    placeholder_seen = False

    for i, raw in enumerate(exercises):
        path = f"exercises[{i}]"
        exercise = obj(raw, path, errors)
        normalized.append(exercise)
        exercise_id = text(exercise.get("id"), f"{path}.id", errors)
        if exercise_id:
            exercise_ids.append(exercise_id)
        position = exercise.get("position")
        if not isinstance(position, int) or isinstance(position, bool):
            errors.append(f"{path}.position must be an integer")
        else:
            positions.append(position)
        text(exercise.get("exercise_type"), f"{path}.exercise_type", errors)
        text(exercise.get("title"), f"{path}.title", errors)
        text(exercise.get("objective"), f"{path}.objective", errors)
        if not isinstance(exercise.get("required"), bool):
            errors.append(f"{path}.required must be a boolean")

        source_ids = strings(exercise.get("source_target_ids"), f"{path}.source_target_ids", errors)
        ext_ids = strings(exercise.get("extension_ids"), f"{path}.extension_ids", errors)
        for target_id in source_ids:
            if target_id not in target_ids:
                errors.append(f"{path}.source_target_ids references unknown source target: {target_id}")
            else:
                exercise_source_union.add(target_id)
        for extension_id in ext_ids:
            if extension_id not in extension_ids:
                errors.append(f"{path}.extension_ids references unknown extension: {extension_id}")
        if not source_ids and not ext_ids:
            errors.append(f"{path} must target source content or a declared Vocora extension")

        evidence = obj(exercise.get("evidence"), f"{path}.evidence", errors)
        source_refs = strings(evidence.get("source_refs"), f"{path}.evidence.source_refs", errors)
        if not source_refs:
            errors.append(f"{path}.evidence.source_refs must contain at least one source reference")
        research_ids = strings(evidence.get("research_principle_ids"), f"{path}.evidence.research_principle_ids", errors)
        for research_id in research_ids:
            if research_id not in evidence_set:
                errors.append(f"{path}.evidence references unknown evidence id: {research_id}")
            elif evidence_kinds.get(research_id) != "research":
                errors.append(f"{path}.evidence.research_principle_ids must reference research evidence: {research_id}")
        text(evidence.get("sequence_reason"), f"{path}.evidence.sequence_reason", errors)

        completion = obj(exercise.get("completion"), f"{path}.completion", errors)
        text(completion.get("evidence"), f"{path}.completion.evidence", errors)
        gate = completion.get("mastery_gate")
        if gate is not None and (not isinstance(gate, str) or not gate.strip()):
            errors.append(f"{path}.completion.mastery_gate must be a non-empty string or null")

        prereqs = arr(exercise.get("prerequisites"), f"{path}.prerequisites", errors)
        for j, raw_prereq in enumerate(prereqs):
            prereq_path = f"{path}.prerequisites[{j}]"
            prereq = obj(raw_prereq, prereq_path, errors)
            text(prereq.get("exercise_id"), f"{prereq_path}.exercise_id", errors)
            text(prereq.get("reason"), f"{prereq_path}.reason", errors)

        slides = arr(exercise.get("slides"), f"{path}.slides", errors)
        if not slides:
            errors.append(f"{path}.slides must contain at least one slide")
        for j, raw_slide in enumerate(slides):
            slide_path = f"{path}.slides[{j}]"
            slide = obj(raw_slide, slide_path, errors)
            slide_id = text(slide.get("id"), f"{slide_path}.id", errors)
            if slide_id:
                slide_ids.append(slide_id)
            slide_type = text(slide.get("type"), f"{slide_path}.type", errors)
            if slide_type and slide_type not in ALLOWED_SLIDE_TYPES:
                errors.append(f"{slide_path}.type must be one of: {', '.join(sorted(ALLOWED_SLIDE_TYPES))}")
            text(slide.get("purpose"), f"{slide_path}.purpose", errors)
            slide_targets = strings(slide.get("target_ids"), f"{slide_path}.target_ids", errors)
            if not slide_targets:
                errors.append(f"{slide_path}.target_ids must contain at least one target")
            for target_id in slide_targets:
                if target_id not in known_targets:
                    errors.append(f"{slide_path}.target_ids references unknown target: {target_id}")
            if slide.get("contract_status") != "placeholder":
                errors.append(f"{slide_path}.contract_status must equal placeholder")
            else:
                placeholder_seen = True
            data = obj(slide.get("data"), f"{slide_path}.data", errors)
            if data.get("_placeholder") is not True:
                errors.append(f"{slide_path}.data._placeholder must equal true")
            for field in ("instruction_intent", "prompt_or_stimulus", "expected_response", "feedback_intent"):
                text(data.get(field), f"{slide_path}.data.{field}", errors)

    duplicate_check(exercise_ids, "exercises[].id", errors)
    duplicate_check(slide_ids, "exercises[].slides[].id", errors)
    if len(positions) == len(exercises):
        if len(set(positions)) != len(positions):
            errors.append("exercise positions must be unique")
        if any(left >= right for left, right in zip(positions, positions[1:])):
            errors.append("exercise positions must be strictly increasing in array order")

    index_by_id = {exercise_id: i for i, exercise_id in enumerate(exercise_ids)}
    for i, exercise in enumerate(normalized):
        for prereq in exercise.get("prerequisites", []) if isinstance(exercise.get("prerequisites"), list) else []:
            if not isinstance(prereq, dict) or not isinstance(prereq.get("exercise_id"), str):
                continue
            prereq_id = prereq["exercise_id"].strip()
            if not prereq_id:
                continue
            if prereq_id not in index_by_id:
                errors.append(f"exercises[{i}].prerequisites references unknown exercise: {prereq_id}")
            elif index_by_id[prereq_id] >= i:
                errors.append(f"exercises[{i}].prerequisites must reference an earlier exercise: {prereq_id}")

    if normalized:
        first = normalized[0]
        if first.get("exercise_type") != "vocabulary_intake":
            errors.append("the first exercise must have exercise_type vocabulary_intake")
        if first.get("prerequisites"):
            errors.append("the vocabulary_intake exercise must not have prerequisites")
        first_targets = set(first.get("source_target_ids", [])) if isinstance(first.get("source_target_ids"), list) else set()
        if not leitner_ids.issubset(first_targets):
            errors.append(f"vocabulary_intake must cover all leitner_eligible targets; missing: {', '.join(sorted(leitner_ids - first_targets))}")
        if first.get("slides") and not any(isinstance(slide, dict) and slide.get("type") == "choice" for slide in first["slides"]):
            errors.append("vocabulary_intake must include at least one choice slide under the placeholder contract")

    if len(normalized) >= 2:
        first, second = normalized[0], normalized[1]
        if second.get("exercise_type") != "spelling_dictation":
            errors.append("the second exercise must have exercise_type spelling_dictation")
        second_targets = set(second.get("source_target_ids", [])) if isinstance(second.get("source_target_ids"), list) else set()
        if not leitner_ids.issubset(second_targets):
            errors.append(f"spelling_dictation must cover all leitner_eligible targets; missing: {', '.join(sorted(leitner_ids - second_targets))}")
        prereqs = second.get("prerequisites", []) if isinstance(second.get("prerequisites"), list) else []
        if first.get("id") and not any(isinstance(item, dict) and item.get("exercise_id") == first.get("id") for item in prereqs):
            errors.append("spelling_dictation must depend on the vocabulary_intake exercise")
        if second.get("slides") and not any(isinstance(slide, dict) and slide.get("type") == "dictation" for slide in second["slides"]):
            errors.append("spelling_dictation must include at least one dictation slide")

    if set(covered) != exercise_source_union:
        errors.append("coverage.covered_target_ids must exactly match source targets referenced by exercises")

    validation = obj(root.get("validation"), "validation", errors)
    status = text(validation.get("status"), "validation.status", errors)
    if status and status not in VALIDATION_STATUSES:
        errors.append(f"validation.status must be one of: {', '.join(sorted(VALIDATION_STATUSES))}")
    warnings = strings(validation.get("warnings"), "validation.warnings", errors)
    blockers = strings(validation.get("blockers"), "validation.blockers", errors)
    if status == "ready" and uncovered:
        errors.append("validation.status ready requires no uncovered source targets")
    if status == "ready" and blockers:
        errors.append("validation.status ready requires no blockers")
    if status == "blocked" and not blockers:
        errors.append("validation.status blocked requires at least one blocker")
    if placeholder_seen and not any("placeholder" in warning.lower() for warning in warnings):
        errors.append("validation.warnings must disclose the provisional placeholder slide contract")

    return sorted(set(errors))


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        errors = validate_plan(load_json(args.input))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        errors = [str(error)]
    result = {"schema_version": SCHEMA_VERSION, "status": "valid" if not errors else "invalid", "errors": errors}
    print(json.dumps(result, indent=2, ensure_ascii=False), file=sys.stdout if not errors else sys.stderr)
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
