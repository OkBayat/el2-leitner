#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name('validate_okf.py')


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding='utf-8')


class ValidateOkfTests(unittest.TestCase):
    def run_validator(self, root: Path):
        completed = subprocess.run(
            [sys.executable, str(SCRIPT), '--root', str(root)],
            text=True,
            capture_output=True,
            check=False,
        )
        payload = json.loads(completed.stdout)
        return completed.returncode, payload

    def make_valid_bundle(self, root: Path) -> None:
        write(root / 'okf/index.md', '---\nokf_version: "0.1"\n---\n\n# Knowledge\n')
        write(root / 'okf/log.md', '# Update Log\n')
        write(root / 'okf/project/index.md', '# Project\n')
        write(
            root / 'okf/project/example.md',
            '---\ntype: Concept\ntitle: Example\n---\n\nExample knowledge.\n',
        )

    def test_accepts_valid_bundle(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_valid_bundle(root)
            code, payload = self.run_validator(root)
            self.assertEqual(0, code)
            self.assertTrue(payload['ok'])
            self.assertEqual('0.1', payload['okf_version'])
            self.assertEqual(1, payload['checked_concepts'])
            self.assertEqual([], payload['problems'])

    def test_rejects_concept_without_type(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_valid_bundle(root)
            write(root / 'okf/project/example.md', '---\ntitle: Example\n---\n\nMissing type.\n')
            code, payload = self.run_validator(root)
            self.assertEqual(1, code)
            self.assertFalse(payload['ok'])
            self.assertIn('missing_type', {problem['code'] for problem in payload['problems']})

    def test_rejects_missing_reserved_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'okf').mkdir(parents=True)
            code, payload = self.run_validator(root)
            self.assertEqual(1, code)
            self.assertFalse(payload['ok'])
            codes = {problem['code'] for problem in payload['problems']}
            self.assertIn('missing_index', codes)
            self.assertIn('missing_log', codes)

    def test_rejects_unsupported_version(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.make_valid_bundle(root)
            write(root / 'okf/index.md', '---\nokf_version: "9.9"\n---\n\n# Knowledge\n')
            code, payload = self.run_validator(root)
            self.assertEqual(1, code)
            self.assertFalse(payload['ok'])
            self.assertIn('unsupported_okf_version', {problem['code'] for problem in payload['problems']})


if __name__ == '__main__':
    unittest.main()
