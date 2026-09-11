#!/usr/bin/env python3
"""Validate the canonical K2 design-system skill."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any


REQUIRED_FILES = (
    "SKILL.md",
    "agents/openai.yaml",
    "references/DESIGN.md",
    "references/tokens.json",
    "references/variables.scss",
    "references/theme.css",
    "references/material-theme.scss",
    "scripts/validate-design-system.py",
    "scripts/test-validate-design-system.mjs",
)

CANONICAL_COLORS = {
    "eager-green": "#58CC02",
    "storybook-green": "#D7FFB8",
    "spark-blue": "#1CB0F6",
    "fresh-leaf": "#A5ED6E",
    "night-ink": "#000437",
    "paper-white": "#FFFFFF",
    "charcoal": "#4B4B4B",
    "pencil-gray": "#777777",
    "faded-gray": "#AFAFAF",
    "button-disabled-gray": "#D9D9D9",
    "button-border-gray": "#E5E5E5",
    "attention-yellow": "#FFC800",
    "answer-red": "#FF4B4B",
}

CANONICAL_FONTS = {
    "feather": "feather",
    "duolingo-sans": "duolingo-sans",
}

CANONICAL_ACTION_ROLES = {
    "light": {
        "primary": "#1CB0F6",
        "primaryHover": "#1CB0F6",
        "success": "#58CC02",
        "successHover": "#58CC02",
        "secondaryForeground": "#4B4B4B",
        "secondaryBorder": "#E5E5E5",
        "secondaryDisabledForeground": "#D9D9D9",
        "secondaryDisabledBorder": "#E5E5E5",
        "disabledBackground": "#D9D9D9",
        "disabledForeground": "#777777",
    },
    "dark": {
        "primary": "#49C0F8",
        "primaryHover": "#5CC8FA",
        "success": "#72D72B",
        "successHover": "#83E640",
        "secondaryForeground": "#4B4B4B",
    },
}

BUTTON_INTENTS = ("primary", "success", "error", "warning", "secondary")
THEME_GROUPS = ("surface", "text", "action")
HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
def skill_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_tokens(root: Path) -> dict[str, Any]:
    path = root / "references" / "tokens.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Missing token file: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc

    if not isinstance(data, dict):
        raise ValueError("tokens.json root must be an object")
    return data


def validate_required_files(root: Path, errors: list[str]) -> None:
    for relative in REQUIRED_FILES:
        if not (root / relative).is_file():
            errors.append(f"Missing required file: {relative}")


def validate_dtcg_group(
    group: object,
    expected: dict[str, str],
    token_type: str,
    path: str,
    errors: list[str],
) -> None:
    if not isinstance(group, dict):
        errors.append(f"{path} must be an object")
        return

    for name, value in expected.items():
        token = group.get(name)
        if not isinstance(token, dict):
            errors.append(f"{path}.{name} must be a token object")
            continue
        if token.get("$value") != value:
            errors.append(f"{path}.{name} must equal {value}")
        if token.get("$type") != token_type:
            errors.append(f"{path}.{name} must use type {token_type}")
        if not isinstance(token.get("$description"), str) or not token["$description"].strip():
            errors.append(f"{path}.{name} must have a description")


def validate_tokens(data: dict[str, Any], errors: list[str]) -> None:
    validate_dtcg_group(
        data.get("color"),
        CANONICAL_COLORS,
        "color",
        "color",
        errors,
    )
    validate_dtcg_group(
        data.get("font"),
        CANONICAL_FONTS,
        "fontFamily",
        "font",
        errors,
    )

    themes = data.get("themes")
    if not isinstance(themes, dict):
        errors.append("themes must be an object")
    else:
        light = themes.get("light")
        dark = themes.get("dark")
        if not isinstance(light, dict) or not isinstance(dark, dict):
            errors.append("themes must define light and dark objects")
        else:
            for group_name in THEME_GROUPS:
                light_group = light.get(group_name)
                dark_group = dark.get(group_name)
                if not isinstance(light_group, dict) or not isinstance(
                    dark_group, dict
                ):
                    errors.append(
                        f"themes light and dark must define {group_name} objects"
                    )
                    continue
                if set(light_group) != set(dark_group):
                    errors.append(
                        f"Theme key parity failed for group '{group_name}'"
                    )
                for theme_name, group in (
                    ("light", light_group),
                    ("dark", dark_group),
                ):
                    for name, value in group.items():
                        if not isinstance(value, str) or not HEX_COLOR.fullmatch(value):
                            errors.append(
                                f"Invalid color at themes.{theme_name}.{group_name}.{name}"
                            )

            for theme_name, expected_roles in CANONICAL_ACTION_ROLES.items():
                action = themes[theme_name].get("action")
                if not isinstance(action, dict):
                    continue
                for name, expected in expected_roles.items():
                    if action.get(name) != expected:
                        errors.append(
                            f"themes.{theme_name}.action.{name} must equal {expected}"
                        )

    extensions = data.get("$extensions")
    if not isinstance(extensions, dict):
        errors.append("$extensions must be an object")
        return
    vocora = extensions.get("com.vocora.design-system")
    if not isinstance(vocora, dict):
        errors.append("$extensions.com.vocora.design-system must be an object")
        return
    if vocora.get("defaultTheme") != "light":
        errors.append("The default design-system theme must be light")
    if vocora.get("themes") != ["light", "dark"]:
        errors.append("The design system must declare light and dark themes")
    if vocora.get("buttonRadius") != "13px":
        errors.append("The canonical button radius must be 13px")
    if vocora.get("minimumTouchTarget") != "44px":
        errors.append("The minimum touch target must be 44px")


def extract_css_variables(text: str) -> dict[str, str]:
    return {
        name: value.strip()
        for name, value in re.findall(
            r"(--[a-z0-9-]+)\s*:\s*([^;]+);",
            text,
            flags=re.IGNORECASE,
        )
    }


def validate_variable_reference(root: Path, errors: list[str]) -> None:
    for relative in ("references/variables.scss", "references/theme.css"):
        path = root / relative
        if not path.is_file():
            continue
        variables = extract_css_variables(path.read_text(encoding="utf-8"))
        for name, value in CANONICAL_COLORS.items():
            variable = f"--color-{name}"
            if variables.get(variable, "").lower() != value.lower():
                errors.append(f"{relative} must map {variable} to {value}")
        for name in CANONICAL_FONTS:
            if f"--font-{name}" not in variables:
                errors.append(f"{relative} is missing --font-{name}")
        if relative == "references/variables.scss":
            text = path.read_text(encoding="utf-8")
            if "html[data-theme='light']" not in text:
                errors.append("variables.scss must define the light theme")
            if "html[data-theme='dark']" not in text:
                errors.append("variables.scss must define the dark theme")


def validate_skill_contract(root: Path, errors: list[str]) -> None:
    path = root / "SKILL.md"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    required_phrases = (
        "Light is the default theme; light and dark are both mandatory.",
        "canonical 4px lower edge",
        "### Script-owned",
        "### Codex-owned",
        "### No manual fallback",
        "## Stop conditions",
        "existing Vocora shared primitive",
        "Angular CDK",
        "Bootstrap is the utility layer",
        "Custom CSS is last",
        "ui/tests/test-design-system-architecture.mjs",
    )
    for phrase in required_phrases:
        if phrase not in text:
            errors.append(f"SKILL.md is missing required contract text: {phrase}")


def validate_button_contract(root: Path, errors: list[str]) -> None:
    path = root / "references" / "DESIGN.md"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    for intent in BUTTON_INTENTS:
        css_class = f"vocora-button--{intent}"
        if css_class not in text:
            errors.append(f"DESIGN.md is missing button class: {css_class}")
    if "native `disabled` attribute" not in text:
        errors.append("DESIGN.md must require the native disabled attribute")


def validate_material_reference(root: Path, errors: list[str]) -> None:
    path = root / "references" / "material-theme.scss"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    required_mappings = {
        "--mat-sys-surface": "--vocora-surface-base",
        "--mat-sys-on-surface": "--vocora-text-primary",
        "--mat-sys-primary": "--vocora-action-primary",
        "--mat-sys-on-primary": "--vocora-action-primary-foreground",
        "--mat-sys-secondary": "--vocora-action-secondary-foreground",
        "--mat-sys-error": "--vocora-action-error",
    }
    for material, foundation in required_mappings.items():
        pattern = rf"{re.escape(material)}:\s*var\({re.escape(foundation)}\);"
        if not re.search(pattern, text):
            errors.append(
                f"material-theme.scss must map {material} to {foundation}"
            )


def validate_frontend_guidance(root: Path, errors: list[str]) -> None:
    path = root / "references" / "DESIGN.md"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    hierarchy = (
        "Existing Vocora shared primitive?",
        "Standard interactive primitive in Angular Material?",
        "Required behavior available in Angular CDK?",
        "Reusable product-specific primitive?",
        "Layout, spacing, display, or semantic utility in Bootstrap?",
        "Existing shared style or semantic token?",
        "Otherwise",
    )
    positions: list[int] = []
    for step in hierarchy:
        position = text.find(step)
        if position < 0:
            errors.append(f"DESIGN.md is missing decision-tree step: {step}")
        positions.append(position)
    if all(position >= 0 for position in positions) and positions != sorted(positions):
        errors.append("DESIGN.md must keep the UI decision tree in canonical order")

    for heading in (
        "## Touch-to-refactor",
        "## Custom CSS last",
        "## Theme and color ownership",
        "## Specificity and `!important`",
        "## Angular Material internals",
    ):
        if heading not in text:
            errors.append(f"DESIGN.md is missing required architecture section: {heading}")


def validate(root: Path) -> list[str]:
    errors: list[str] = []
    validate_required_files(root, errors)

    try:
        tokens = load_tokens(root)
    except ValueError as exc:
        errors.append(str(exc))
    else:
        validate_tokens(tokens, errors)

    validate_variable_reference(root, errors)
    validate_skill_contract(root, errors)
    validate_button_contract(root, errors)
    validate_material_reference(root, errors)
    validate_frontend_guidance(root, errors)
    return errors


def main() -> int:
    root = skill_root()
    errors = validate(root)
    if errors:
        print("K2 design-system skill validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("K2 design-system skill validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
