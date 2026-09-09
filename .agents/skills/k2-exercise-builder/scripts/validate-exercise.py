#!/usr/bin/env python3
"""Validate a runtime-ready Vocora slides.sequence exercise object."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCHEMA_VERSION = 1
SLIDE_TYPES = {
    "message", "summary", "teaching-card", "selection", "choice", "truth",
    "matching", "classification", "ordering", "cloze", "structured-completion",
    "short-answer", "word-formation", "error-correction", "rewrite",
    "pronunciation", "dictation", "speaking-response", "writing-response",
}


def record(value: Any, label: str) -> dict:
    if not isinstance(value, dict):
        raise ValueError(f"{label} must be an object.")
    return value


def text(source: dict, key: str, label: str) -> str:
    value = source.get(key)
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label} is required.")
    return value.strip()


def array(source: dict, key: str, label: str, minimum: int = 1) -> list:
    value = source.get(key)
    if not isinstance(value, list) or len(value) < minimum:
        raise ValueError(f"{label} must contain at least {minimum} item(s).")
    return value


def string_array(source: dict, key: str, label: str, minimum: int = 1) -> list[str]:
    values = array(source, key, label, minimum)
    if any(not isinstance(value, str) or not value.strip() for value in values):
        raise ValueError(f"{label} must contain non-empty strings.")
    normalized = [value.strip() for value in values]
    if len(set(normalized)) != len(normalized):
        raise ValueError(f"{label} must not contain duplicates.")
    return normalized


def validate_options(data: dict, minimum: int = 2) -> list[str]:
    options = array(data, "options", "options", minimum)
    ids = []
    for candidate in options:
        option = record(candidate, "option")
        ids.append(text(option, "id", "Option id"))
        text(option, "label", "Option label")
        if "description" in option and (not isinstance(option["description"], str) or not option["description"].strip()):
            raise ValueError("Option description must be a non-empty string when present.")
    if len(set(ids)) != len(ids):
        raise ValueError("Option ids must be unique.")
    return ids


def validate_answer_fields(data: dict, key: str) -> None:
    for candidate in array(data, key, key):
        field = record(candidate, "answer field")
        text(field, "id", "Answer field id")
        string_array(field, "answers", "Answer field answers")


def validate_slide_data(slide_type: str, data: dict) -> None:
    if slide_type in {"message", "summary"}:
        return
    if slide_type == "teaching-card":
        text(data, "title", "Teaching card title")
        for candidate in array(data, "blocks", "Teaching card blocks"):
            text(record(candidate, "teaching block"), "content", "Teaching block content")
        return
    if slide_type == "selection":
        mode = text(data, "mode", "Selection mode")
        if mode not in {"single", "multiple"}:
            raise ValueError("Selection mode must be single or multiple.")
        text(data, "question", "Selection question")
        validate_options(data)
        if "expansionId" in data:
            text(data, "expansionId", "Selection expansionId")
        if any(key in data for key in ("correctOptionId", "correctOptionIds", "answers")):
            raise ValueError("Selection slides must not define correctness fields.")
        return
    if slide_type == "choice":
        text(data, "question", "Choice question")
        option_ids = validate_options(data)
        correct_ids = string_array(data, "correctOptionIds", "Choice correctOptionIds")
        if any(value not in option_ids for value in correct_ids):
            raise ValueError("Choice correctOptionIds must reference configured options.")
        return
    if slide_type == "truth":
        text(data, "statement", "Truth statement")
        text(data, "correctOptionId", "Truth correctOptionId")
        return
    if slide_type == "matching":
        for candidate in array(data, "pairs", "Matching pairs"):
            pair = record(candidate, "matching pair")
            text(pair, "id", "Matching pair id")
            text(pair, "left", "Matching pair left value")
            text(pair, "right", "Matching pair right value")
        return
    if slide_type == "classification":
        validate_options({"options": array(data, "categories", "Classification categories", 2)})
        for candidate in array(data, "items", "Classification items"):
            item = record(candidate, "classification item")
            text(item, "id", "Classification item id")
            text(item, "label", "Classification item label")
            text(item, "correctCategoryId", "Classification correctCategoryId")
        return
    if slide_type == "ordering":
        option_ids = validate_options({"options": array(data, "items", "Ordering items", 2)})
        correct_ids = string_array(data, "correctOrderIds", "Ordering correctOrderIds", 2)
        if set(correct_ids) != set(option_ids):
            raise ValueError("Ordering correctOrderIds must list every configured item exactly once.")
        return
    if slide_type == "cloze":
        text(data, "content", "Cloze content")
        validate_answer_fields(data, "blanks")
        return
    if slide_type == "structured-completion":
        if text(data, "layout", "Structured completion layout") not in {"form", "table", "notes", "flowchart", "timeline"}:
            raise ValueError("Structured completion layout is unsupported.")
        validate_answer_fields(data, "fields")
        return
    if slide_type == "short-answer":
        text(data, "question", "Short answer question")
        string_array(data, "answers", "Short answer answers")
        return
    if slide_type == "word-formation":
        text(data, "baseWord", "Word formation baseWord")
        validate_answer_fields(data, "fields")
        return
    if slide_type == "error-correction":
        text(data, "original", "Error correction original")
        string_array(data, "answers", "Error correction answers")
        return
    if slide_type == "rewrite":
        text(data, "original", "Rewrite original")
        return
    if slide_type == "pronunciation":
        text(data, "mode", "Pronunciation mode")
        text(data, "question", "Pronunciation question")
        return
    if slide_type == "dictation":
        text(data, "answer", "Dictation answer")
        has_audio = isinstance(data.get("audio"), str) and bool(data["audio"].strip())
        has_speech = isinstance(data.get("speech"), dict) and isinstance(data["speech"].get("text"), str) and bool(data["speech"]["text"].strip())
        if has_audio == has_speech:
            raise ValueError("Dictation requires exactly one audio or speech source.")
        return
    if slide_type == "speaking-response":
        text(data, "mode", "Speaking response mode")
        text(data, "prompt", "Speaking response prompt")
        return
    if slide_type == "writing-response":
        text(data, "mode", "Writing response mode")
        text(data, "prompt", "Writing response prompt")


def validate_exercise(value: Any) -> dict:
    exercise = record(value, "Exercise")
    text(exercise, "id", "Exercise id")
    if exercise.get("type") != "slides.sequence":
        raise ValueError("Exercise type must be slides.sequence.")
    if exercise.get("schemaVersion") != 1:
        raise ValueError("Exercise schemaVersion must be 1.")
    if exercise.get("completionPolicy") != "slide-sequence":
        raise ValueError("Exercise completionPolicy must be slide-sequence.")
    config = record(exercise.get("config"), "Exercise config")
    slides = array(config, "slides", "slides.sequence slides", 2)
    ids = []
    types = []
    for candidate in slides:
        slide = record(candidate, "Slide")
        slide_id = text(slide, "id", "Slide id")
        slide_type = text(slide, "type", "Slide type")
        if slide_type not in SLIDE_TYPES:
            raise ValueError(f"Unsupported slide type: {slide_type}")
        data = record(slide.get("data", {}), f"{slide_type} data")
        validate_slide_data(slide_type, data)
        ids.append(slide_id)
        types.append(slide_type)
    if len(set(ids)) != len(ids):
        raise ValueError("Slide ids must be unique.")
    terminal = [index for index, slide in enumerate(slides) if slide.get("terminal") is True]
    if terminal != [len(slides) - 1]:
        raise ValueError("slides.sequence requires exactly one terminal final slide.")
    if types[-1] != "summary":
        raise ValueError("The terminal final slide must use summary.")
    return {"schema_version": SCHEMA_VERSION, "status": "valid", "exercise_id": exercise["id"], "slide_types": types}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, type=Path)
    args = parser.parse_args(argv)
    try:
        result = validate_exercise(json.loads(args.input.read_text(encoding="utf-8")))
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as error:
        print(json.dumps({"schema_version": SCHEMA_VERSION, "status": "invalid", "error": str(error)}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
