#!/usr/bin/env python3
"""Focused tests for the BBC bundle request planner and delivery verifier."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).with_name("bundle-request.py")
SPEC = importlib.util.spec_from_file_location("k2_bbc_bundle_request", SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Could not load bundle-request.py")
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class BundleRequestTests(unittest.TestCase):
    def test_exact_date_defaults_all_tests_to_medium(self) -> None:
        plan = MODULE.build_plan(
            exact_date="2026-06-18",
            from_date=None,
            to_date=None,
            test_count=3,
            distribution_text=None,
        )
        self.assertEqual(plan["scope"], {"type": "exact_date", "date": "2026-06-18"})
        self.assertEqual(plan["difficulty_distribution"], {"medium": 3})
        self.assertFalse(plan["discovery_bound"])

    def test_range_and_distribution_are_canonical(self) -> None:
        plan = MODULE.build_plan(
            exact_date=None,
            from_date="2026-06-01",
            to_date="2026-06-30",
            test_count=5,
            distribution_text="hard=2,easy=1,medium=2",
        )
        self.assertEqual(
            plan["difficulty_distribution"],
            {"easy": 1, "medium": 2, "hard": 2},
        )
        self.assertEqual(plan["scope"]["type"], "inclusive_range")

    def test_rejects_reversed_range_and_mismatched_distribution(self) -> None:
        with self.assertRaisesRegex(ValueError, "on or before"):
            MODULE.build_plan(
                exact_date=None,
                from_date="2026-06-30",
                to_date="2026-06-01",
                test_count=5,
                distribution_text="easy=1,medium=2,hard=2",
            )
        with self.assertRaisesRegex(ValueError, "sum exactly"):
            MODULE.build_plan(
                exact_date="2026-06-18",
                from_date=None,
                to_date=None,
                test_count=5,
                distribution_text="easy=1,medium=1,hard=1",
            )

    def test_discovery_binding_rejects_out_of_scope_and_duplicates(self) -> None:
        plan = MODULE.build_plan(
            exact_date=None,
            from_date="2026-06-01",
            to_date="2026-06-30",
            test_count=1,
            distribution_text=None,
        )
        with self.assertRaisesRegex(ValueError, "outside"):
            MODULE.bind_discovery(plan, ["2026-07-02=bbc-6-minute-english-260702"])
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            MODULE.bind_discovery(plan, [
                "2026-06-18=bbc-6-minute-english-260618",
                "2026-06-25=bbc-6-minute-english-260618",
            ])

    def test_delivery_must_match_bound_episode_set_and_difficulty_mix(self) -> None:
        plan = MODULE.build_plan(
            exact_date=None,
            from_date="2026-06-01",
            to_date="2026-06-30",
            test_count=5,
            distribution_text="easy=1,medium=2,hard=2",
        )
        plan = MODULE.bind_discovery(plan, [
            "2026-06-18=bbc-6-minute-english-260618",
            "2026-06-25=bbc-6-minute-english-260625",
        ])

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            first = self._write_bundle(
                root,
                public_id="bbc-6-minute-english-260618",
                episode_date="2026-06-18",
                difficulties=["easy", "medium", "medium", "hard", "hard"],
            )
            second = self._write_bundle(
                root,
                public_id="bbc-6-minute-english-260625",
                episode_date="2026-06-25",
                difficulties=["easy", "medium", "medium", "hard", "hard"],
            )
            with patch.object(MODULE, "verify_with_application"):
                report = MODULE.verify_delivery(plan, [first, second])
            self.assertEqual(report["status"], "valid")
            self.assertEqual(report["episode_count"], 2)
            self.assertEqual(
                [item["episode_date"] for item in report["episodes"]],
                ["2026-06-18", "2026-06-25"],
            )

            with patch.object(MODULE, "verify_with_application"):
                with self.assertRaisesRegex(ValueError, "Missing expected"):
                    MODULE.verify_delivery(plan, [first])

    def test_delivery_rejects_wrong_difficulty_distribution(self) -> None:
        plan = MODULE.build_plan(
            exact_date="2026-06-18",
            from_date=None,
            to_date=None,
            test_count=3,
            distribution_text="easy=1,medium=1,hard=1",
        )
        plan = MODULE.bind_discovery(plan, ["2026-06-18=bbc-6-minute-english-260618"])
        with tempfile.TemporaryDirectory() as temporary:
            bundle = self._write_bundle(
                Path(temporary),
                public_id="bbc-6-minute-english-260618",
                episode_date="2026-06-18",
                difficulties=["medium", "medium", "medium"],
            )
            with patch.object(MODULE, "verify_with_application"):
                with self.assertRaisesRegex(ValueError, "Wrong difficulty distribution"):
                    MODULE.verify_delivery(plan, [bundle])

    @staticmethod
    def _write_bundle(root: Path, *, public_id: str, episode_date: str,
                      difficulties: list[str]) -> Path:
        folder = f"{episode_date}-test-episode"
        destination = root / f"{public_id}.zip"
        episode = {
            "publicId": public_id,
            "episodeDate": episode_date,
            "title": f"Test episode {episode_date}",
            "level": "intermediate",
        }
        tests = [
            {"id": f"test-{index}", "format": "ielts", "difficulty": difficulty}
            for index, difficulty in enumerate(difficulties, start=1)
        ]
        manifest = {"transcriptStatus": "source_reference_only"}
        with zipfile.ZipFile(destination, "w") as archive:
            archive.writestr(f"{folder}/episode.json", json.dumps(episode))
            archive.writestr(f"{folder}/listening.json", json.dumps({"tests": tests}))
            archive.writestr(f"{folder}/BUNDLE.json", json.dumps(manifest))
        return destination


if __name__ == "__main__":
    unittest.main()
