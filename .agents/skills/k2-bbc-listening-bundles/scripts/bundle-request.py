#!/usr/bin/env python3
"""Plan and verify K2 BBC listening bundle requests for Vocora."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import date
import json
from pathlib import Path
import subprocess
import sys
import zipfile

SCHEMA_VERSION = 1
DIFFICULTIES = ("very_easy", "easy", "medium", "hard", "very_hard")
SKILL_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = SKILL_DIR.parents[2]
APPLICATION_TOOL = REPO_ROOT / "back" / "scripts" / "manage-listening-episode.py"


def parse_iso_date(value: str) -> str:
    try:
        parsed = date.fromisoformat(value)
    except ValueError as error:
        raise ValueError(f"Invalid ISO date: {value}") from error
    if parsed.isoformat() != value:
        raise ValueError(f"Date must use YYYY-MM-DD: {value}")
    return value


def parse_distribution(value: str | None, test_count: int) -> dict[str, int]:
    if test_count < 1:
        raise ValueError("Test count must be at least 1.")
    if value is None:
        return {"medium": test_count}

    result: dict[str, int] = {}
    for token in value.split(","):
        if "=" not in token:
            raise ValueError("Difficulty distribution must use difficulty=count pairs.")
        difficulty, raw_count = (part.strip() for part in token.split("=", 1))
        if difficulty not in DIFFICULTIES:
            raise ValueError(f"Unsupported difficulty: {difficulty}")
        if difficulty in result:
            raise ValueError(f"Duplicate difficulty: {difficulty}")
        try:
            count = int(raw_count)
        except ValueError as error:
            raise ValueError(f"Invalid difficulty count: {raw_count}") from error
        if count < 1:
            raise ValueError("Difficulty counts must be positive integers; omit zero-count values.")
        result[difficulty] = count

    if sum(result.values()) != test_count:
        raise ValueError("Difficulty counts must sum exactly to the requested test count.")
    return result


def ordered_distribution(distribution: dict[str, int]) -> dict[str, int]:
    return {difficulty: distribution[difficulty] for difficulty in DIFFICULTIES if difficulty in distribution}


def build_plan(*, exact_date: str | None, from_date: str | None, to_date: str | None,
               test_count: int, distribution_text: str | None) -> dict:
    has_exact = exact_date is not None
    has_range = from_date is not None or to_date is not None
    if has_exact == has_range:
        raise ValueError("Specify either --date or both --from-date and --to-date.")

    distribution = ordered_distribution(parse_distribution(distribution_text, test_count))
    if has_exact:
        selected_date = parse_iso_date(exact_date or "")
        scope = {"type": "exact_date", "date": selected_date}
    else:
        if from_date is None or to_date is None:
            raise ValueError("Both --from-date and --to-date are required for a range.")
        start = parse_iso_date(from_date)
        end = parse_iso_date(to_date)
        if start > end:
            raise ValueError("--from-date must be on or before --to-date.")
        scope = {"type": "inclusive_range", "from_date": start, "to_date": end}

    return {
        "schema_version": SCHEMA_VERSION,
        "scope": scope,
        "tests_per_episode": test_count,
        "difficulty_distribution": distribution,
        "delivery": "one_zip_per_episode",
        "discovery_bound": False,
        "resolved_episodes": [],
    }


def validate_plan(plan: dict, *, require_bound: bool = False) -> dict:
    if not isinstance(plan, dict) or plan.get("schema_version") != SCHEMA_VERSION:
        raise ValueError("Unsupported or invalid request plan.")
    scope = plan.get("scope")
    if not isinstance(scope, dict) or scope.get("type") not in {"exact_date", "inclusive_range"}:
        raise ValueError("Invalid request plan scope.")
    if scope["type"] == "exact_date":
        parse_iso_date(scope.get("date", ""))
    else:
        start = parse_iso_date(scope.get("from_date", ""))
        end = parse_iso_date(scope.get("to_date", ""))
        if start > end:
            raise ValueError("Invalid request plan date range.")

    test_count = plan.get("tests_per_episode")
    if type(test_count) is not int or test_count < 1:
        raise ValueError("Invalid tests_per_episode value.")
    distribution = plan.get("difficulty_distribution")
    if not isinstance(distribution, dict):
        raise ValueError("Invalid difficulty_distribution value.")
    canonical = ordered_distribution(parse_distribution(
        ",".join(f"{key}={value}" for key, value in distribution.items()), test_count
    ))
    if canonical != distribution:
        raise ValueError("Difficulty distribution is not canonical.")
    if plan.get("delivery") != "one_zip_per_episode":
        raise ValueError("Invalid delivery contract.")

    bound = plan.get("discovery_bound")
    episodes = plan.get("resolved_episodes")
    if type(bound) is not bool or not isinstance(episodes, list):
        raise ValueError("Invalid discovery binding fields.")
    if require_bound and (not bound or not episodes):
        raise ValueError("Discovery must be bound to at least one official episode before delivery verification.")
    return plan


def date_in_scope(plan: dict, episode_date: str) -> bool:
    scope = plan["scope"]
    if scope["type"] == "exact_date":
        return episode_date == scope["date"]
    return scope["from_date"] <= episode_date <= scope["to_date"]


def parse_episode_binding(value: str) -> dict[str, str]:
    if "=" not in value:
        raise ValueError("Episode bindings must use YYYY-MM-DD=public-id.")
    episode_date, public_id = (part.strip() for part in value.split("=", 1))
    parse_iso_date(episode_date)
    if not public_id or any(char not in "abcdefghijklmnopqrstuvwxyz0123456789-" for char in public_id):
        raise ValueError(f"Invalid episode public ID: {public_id}")
    return {"episode_date": episode_date, "public_id": public_id}


def bind_discovery(plan: dict, bindings: list[str]) -> dict:
    validate_plan(plan)
    if not bindings:
        raise ValueError("At least one verified official episode is required to bind discovery.")
    episodes = [parse_episode_binding(value) for value in bindings]
    identities = [episode["public_id"] for episode in episodes]
    if len(identities) != len(set(identities)):
        raise ValueError("Duplicate episode public IDs are not allowed.")
    pairs = [(episode["episode_date"], episode["public_id"]) for episode in episodes]
    if len(pairs) != len(set(pairs)):
        raise ValueError("Duplicate episode bindings are not allowed.")
    for episode in episodes:
        if not date_in_scope(plan, episode["episode_date"]):
            raise ValueError(f"Resolved episode is outside the requested date scope: {episode['public_id']}")
    episodes.sort(key=lambda item: (item["episode_date"], item["public_id"]))
    return {**plan, "discovery_bound": True, "resolved_episodes": episodes}


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not read JSON file: {path}") from error
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def write_json(value: dict, output: Path | None) -> None:
    text = json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    if output is None:
        print(text, end="")
        return
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(text, encoding="utf-8")
    print(str(output))


def verify_with_application(bundle: Path) -> None:
    if not APPLICATION_TOOL.is_file():
        raise ValueError(f"Application episode tool not found: {APPLICATION_TOOL}")
    result = subprocess.run(
        [sys.executable, str(APPLICATION_TOOL), "verify", str(bundle)],
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout).strip()
        raise ValueError(f"Application bundle verification failed for {bundle}: {detail}")


def read_delivery_bundle(bundle: Path) -> dict:
    if bundle.is_symlink() or not bundle.is_file() or bundle.suffix.lower() != ".zip":
        raise ValueError(f"Expected a regular ZIP file: {bundle}")
    verify_with_application(bundle)
    try:
        with zipfile.ZipFile(bundle) as archive:
            names = archive.namelist()
            episode_names = [name for name in names if name.count("/") == 1 and name.endswith("/episode.json")]
            listening_names = [name for name in names if name.count("/") == 1 and name.endswith("/listening.json")]
            bundle_names = [name for name in names if name.count("/") == 1 and name.endswith("/BUNDLE.json")]
            if len(episode_names) != 1 or len(listening_names) != 1 or len(bundle_names) != 1:
                raise ValueError(f"Could not locate canonical bundle metadata in {bundle}")
            episode = json.loads(archive.read(episode_names[0]))
            listening = json.loads(archive.read(listening_names[0]))
            manifest = json.loads(archive.read(bundle_names[0]))
    except (zipfile.BadZipFile, KeyError, json.JSONDecodeError) as error:
        raise ValueError(f"Could not inspect verified bundle: {bundle}") from error
    if not isinstance(episode, dict) or not isinstance(listening, dict) or not isinstance(manifest, dict):
        raise ValueError(f"Invalid bundle JSON objects: {bundle}")
    return {"episode": episode, "listening": listening, "manifest": manifest}


def verify_delivery(plan: dict, bundles: list[Path]) -> dict:
    validate_plan(plan, require_bound=True)
    if not bundles:
        raise ValueError("At least one ZIP file is required for delivery verification.")

    expected = {(item["episode_date"], item["public_id"]) for item in plan["resolved_episodes"]}
    actual: set[tuple[str, str]] = set()
    reports = []
    expected_distribution = plan["difficulty_distribution"]
    expected_test_count = plan["tests_per_episode"]

    for bundle in bundles:
        data = read_delivery_bundle(bundle.absolute())
        episode = data["episode"]
        tests = data["listening"].get("tests")
        episode_date = parse_iso_date(episode.get("episodeDate", ""))
        public_id = episode.get("publicId")
        if not isinstance(public_id, str) or not public_id:
            raise ValueError(f"Bundle has no valid publicId: {bundle}")
        identity = (episode_date, public_id)
        if identity in actual:
            raise ValueError(f"Duplicate delivered episode: {public_id}")
        actual.add(identity)
        if identity not in expected:
            raise ValueError(f"Delivered episode was not bound during discovery: {public_id}")
        if not isinstance(tests, list) or len(tests) != expected_test_count:
            raise ValueError(f"Wrong test count for {public_id}; expected {expected_test_count}.")
        if any(not isinstance(test, dict) or test.get("format") != "ielts" for test in tests):
            raise ValueError(f"Every test must use format=ielts: {public_id}")
        counts = Counter(test.get("difficulty") for test in tests)
        actual_distribution = {difficulty: counts[difficulty] for difficulty in DIFFICULTIES if counts[difficulty]}
        if actual_distribution != expected_distribution:
            raise ValueError(
                f"Wrong difficulty distribution for {public_id}; expected {expected_distribution}, got {actual_distribution}."
            )
        reports.append({
            "episode_date": episode_date,
            "public_id": public_id,
            "title": episode.get("title"),
            "level": episode.get("level"),
            "test_count": len(tests),
            "difficulty_distribution": actual_distribution,
            "transcript_status": data["manifest"].get("transcriptStatus"),
            "zip": str(bundle.absolute()),
        })

    missing = expected - actual
    if missing:
        missing_text = ", ".join(f"{episode_date}={public_id}" for episode_date, public_id in sorted(missing))
        raise ValueError(f"Missing expected episode ZIPs: {missing_text}")
    if actual != expected:
        raise ValueError("Delivered episode set does not exactly match the discovery binding.")

    reports.sort(key=lambda item: (item["episode_date"], item["public_id"]))
    return {
        "schema_version": SCHEMA_VERSION,
        "status": "valid",
        "episode_count": len(reports),
        "episodes": reports,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)

    plan = commands.add_parser("plan", help="Create a canonical date/test request plan.")
    scope = plan.add_mutually_exclusive_group(required=True)
    scope.add_argument("--date")
    scope.add_argument("--from-date")
    plan.add_argument("--to-date")
    plan.add_argument("--tests", type=int, required=True)
    plan.add_argument("--difficulty-distribution")
    plan.add_argument("--output", type=Path)

    bind = commands.add_parser("bind-discovery", help="Bind the plan to verified official episode identities.")
    bind.add_argument("--plan", type=Path, required=True)
    bind.add_argument("--episode", action="append", default=[])
    bind.add_argument("--output", type=Path, required=True)

    verify = commands.add_parser("verify-delivery", help="Verify delivered ZIPs against a bound request plan.")
    verify.add_argument("--plan", type=Path, required=True)
    verify.add_argument("bundles", nargs="+")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        if args.command == "plan":
            if args.from_date is not None and args.to_date is None:
                raise ValueError("--to-date is required with --from-date.")
            if args.from_date is None and args.to_date is not None:
                raise ValueError("--to-date may only be used with --from-date.")
            value = build_plan(
                exact_date=args.date,
                from_date=args.from_date,
                to_date=args.to_date,
                test_count=args.tests,
                distribution_text=args.difficulty_distribution,
            )
            write_json(value, args.output)
        elif args.command == "bind-discovery":
            value = bind_discovery(load_json(args.plan), args.episode)
            write_json(value, args.output)
        else:
            value = verify_delivery(load_json(args.plan), [Path(item) for item in args.bundles])
            write_json(value, None)
        return 0
    except ValueError as error:
        print(f"BBC bundle request failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
