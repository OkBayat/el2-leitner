#!/usr/bin/env python3
"""Validate the K2 design-system skill deterministically."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")

REQUIRED_FILES = (
    "SKILL.md",
    "agents/openai.yaml",
    "references/DESIGN.md",
    "references/tokens.json",
    "references/variables.scss",
    "references/material-theme.scss",
    "scripts/validate-design-system.py",
    "scripts/test_validate_design_system.py",
)

REQUIRED_THEME_GROUPS = (
    "surface",
    "text",
    "action",
    "state",
    "activity",
    "brand",
)

REQUIRED_SEMANTIC_KEYS = {
    "surface": {"page", "base", "raised", "subtle", "border"},
    "text": {"primary", "secondary", "disabled", "onPrimary", "onStrong"},
    "action": {
        "primary",
        "primaryHover",
        "secondary",
        "secondaryForeground",
        "focusRing",
    },
    "state": {
        "success",
        "information",
        "warning",
        "error",
        "mastered",
        "leitnerActive",
        "notStarted",
        "future",
        "disabled",
    },
    "activity": {
        "vocabulary",
        "listening",
        "shadowing",
        "reading",
        "writing",
        "grammar",
    },
    "brand": {"green", "greenStrong", "mint", "mintLight", "teal", "orange"},
}

REQUIRED_VARIABLES = {
    "--vocora-surface-page",
    "--vocora-surface-base",
    "--vocora-surface-raised",
    "--vocora-surface-subtle",
    "--vocora-border",
    "--vocora-text-primary",
    "--vocora-text-secondary",
    "--vocora-text-disabled",
    "--vocora-text-on-primary",
    "--vocora-action-primary",
    "--vocora-action-primary-hover",
    "--vocora-action-secondary",
    "--vocora-action-secondary-foreground",
    "--vocora-focus-ring",
    "--vocora-success",
    "--vocora-information",
    "--vocora-warning",
    "--vocora-error",
    "--vocora-mastered",
    "--vocora-leitner-active",
    "--vocora-not-started",
    "--vocora-future",
    "--vocora-disabled",
    "--vocora-activity-vocabulary",
    "--vocora-activity-listening",
    "--vocora-activity-shadowing",
    "--vocora-activity-reading",
    "--vocora-activity-writing",
    "--vocora-activity-grammar",
    "--vocora-brand-green",
    "--vocora-brand-green-strong",
    "--vocora-brand-mint",
    "--vocora-brand-mint-light",
    "--vocora-brand-teal",
    "--vocora-brand-orange",
}


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


def flatten_hex_values(value: Any, path: str = "") -> list[tuple[str, str]]:
    result: list[tuple[str, str]] = []
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}" if path else key
            result.extend(flatten_hex_values(child, child_path))
    elif isinstance(value, str):
        result.append((path, value))
    return result


def validate_required_files(root: Path, errors: list[str]) -> None:
    for relative in REQUIRED_FILES:
        if not (root / relative).is_file():
            errors.append(f"Missing required file: {relative}")


def validate_tokens(data: dict[str, Any], errors: list[str]) -> None:
    meta = data.get("meta")
    if not isinstance(meta, dict):
        errors.append("meta must be an object")
    else:
        if meta.get("defaultTheme") != "light":
            errors.append("meta.defaultTheme must be 'light'")
        declared = meta.get("themes")
        if declared != ["light", "dark"]:
            errors.append("meta.themes must be exactly ['light', 'dark']")

    themes = data.get("themes")
    if not isinstance(themes, dict):
        errors.append("themes must be an object")
        return

    light = themes.get("light")
    dark = themes.get("dark")
    if not isinstance(light, dict):
        errors.append("themes.light must be an object")
        return
    if not isinstance(dark, dict):
        errors.append("themes.dark must be an object")
        return

    light_groups = set(light.keys())
    dark_groups = set(dark.keys())
    if light_groups != dark_groups:
        errors.append("Light and dark theme groups must have exact parity")

    for group in REQUIRED_THEME_GROUPS:
        light_group = light.get(group)
        dark_group = dark.get(group)
        if not isinstance(light_group, dict):
            errors.append(f"themes.light.{group} must be an object")
            continue
        if not isinstance(dark_group, dict):
            errors.append(f"themes.dark.{group} must be an object")
            continue

        light_keys = set(light_group.keys())
        dark_keys = set(dark_group.keys())
        if light_keys != dark_keys:
            errors.append(f"Theme key parity failed for group '{group}'")

        missing = REQUIRED_SEMANTIC_KEYS[group] - light_keys
        if missing:
            errors.append(
                f"themes.{group} missing required keys: {', '.join(sorted(missing))}"
            )

    for theme_name in ("light", "dark"):
        theme = themes[theme_name]
        for token_path, value in flatten_hex_values(theme, f"themes.{theme_name}"):
            if not HEX_RE.fullmatch(value):
                errors.append(f"Invalid hex color at {token_path}: {value!r}")

    color = data.get("color")
    if not isinstance(color, dict):
        errors.append("color must be an object")
    else:
        for token_path, value in flatten_hex_values(color, "color"):
            if not HEX_RE.fullmatch(value):
                errors.append(f"Invalid hex color at {token_path}: {value!r}")

    for required_root in ("spacing", "radius", "motion", "typography", "interaction"):
        if not isinstance(data.get(required_root), dict):
            errors.append(f"{required_root} must be an object")


def extract_variables(block: str) -> set[str]:
    return set(re.findall(r"(--vocora-[a-z0-9-]+)\s*:", block))


def validate_variable_reference(root: Path, errors: list[str]) -> None:
    path = root / "references" / "variables.scss"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    if "html[data-theme='light']" not in text:
        errors.append("variables.scss must include an explicit light-theme selector")
    if "html[data-theme='dark']" not in text:
        errors.append("variables.scss must include an explicit dark-theme selector")

    variables = extract_variables(text)
    missing = REQUIRED_VARIABLES - variables
    if missing:
        errors.append(
            "variables.scss is missing required semantic variables: "
            + ", ".join(sorted(missing))
        )


def validate_skill_contract(root: Path, errors: list[str]) -> None:
    path = root / "SKILL.md"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    required_phrases = (
        "Light theme is the default theme.",
        "Every visual change must be designed for light and dark themes at the same time.",
        "### Script-owned",
        "### Codex-owned",
        "### No manual fallback",
        "## Stop conditions",
    )
    for phrase in required_phrases:
        if phrase not in text:
            errors.append(f"SKILL.md is missing required contract text: {phrase}")


def validate_material_reference(root: Path, errors: list[str]) -> None:
    path = root / "references" / "material-theme.scss"
    if not path.is_file():
        return

    text = path.read_text(encoding="utf-8")
    required_mappings = (
        "--mat-sys-surface",
        "--mat-sys-on-surface",
        "--mat-sys-primary",
        "--mat-sys-on-primary",
        "--mat-sys-error",
    )
    for mapping in required_mappings:
        if mapping not in text:
            errors.append(f"material-theme.scss missing mapping: {mapping}")


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
    validate_material_reference(root, errors)
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
