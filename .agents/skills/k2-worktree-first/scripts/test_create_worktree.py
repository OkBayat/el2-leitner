#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("create_worktree.py").resolve()


def run(command: list[str], cwd: Path, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if check and proc.returncode != 0:
        raise AssertionError(f"command failed: {command}\nstdout={proc.stdout}\nstderr={proc.stderr}")
    return proc


def git(cwd: Path, *args: str) -> str:
    return run(["git", *args], cwd).stdout.strip()


class CreateWorktreeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.remote = self.root / "remote.git"
        self.seed = self.root / "seed"
        self.primary = self.root / "primary"

        run(["git", "init", "--bare", str(self.remote)], self.root)
        git(self.remote, "symbolic-ref", "HEAD", "refs/heads/main")
        run(["git", "init", "-b", "main", str(self.seed)], self.root)
        self.configure(self.seed)
        (self.seed / "README.md").write_text("initial\n", encoding="utf-8")
        (self.seed / ".gitignore").write_text(".worktrees/\n", encoding="utf-8")
        git(self.seed, "add", "README.md", ".gitignore")
        git(self.seed, "commit", "-m", "initial")
        git(self.seed, "remote", "add", "origin", str(self.remote))
        git(self.seed, "push", "-u", "origin", "main")

        run(["git", "clone", str(self.remote), str(self.primary)], self.root)
        self.configure(self.primary)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def configure(self, repo: Path) -> None:
        git(repo, "config", "user.email", "tests@example.com")
        git(repo, "config", "user.name", "Vocora Tests")

    def advance_remote(self, label: str) -> str:
        target = self.seed / "remote.txt"
        target.write_text(target.read_text(encoding="utf-8") + label + "\n" if target.exists() else label + "\n", encoding="utf-8")
        git(self.seed, "add", "remote.txt")
        git(self.seed, "commit", "-m", f"remote {label}")
        git(self.seed, "push", "origin", "main")
        return git(self.seed, "rev-parse", "HEAD")

    def invoke(self, cwd: Path, name: str) -> tuple[subprocess.CompletedProcess[str], dict[str, object]]:
        proc = run([sys.executable, str(SCRIPT), "--name", name], cwd, check=False)
        payload = json.loads(proc.stdout if proc.returncode == 0 else proc.stderr)
        return proc, payload

    def assert_main_synced(self) -> None:
        self.assertEqual(git(self.primary, "rev-parse", "refs/heads/main"), git(self.primary, "rev-parse", "refs/remotes/origin/main"))

    def test_primary_main_fast_forwards_and_creates_named_worktree(self) -> None:
        remote_head = self.advance_remote("main-fast-forward")
        proc, payload = self.invoke(self.primary, "fix-worktree-routing")

        self.assertEqual(proc.returncode, 0)
        self.assertEqual(payload["status"], "created")
        self.assertEqual(git(self.primary, "branch", "--show-current"), "main")
        self.assert_main_synced()
        self.assertEqual(git(self.primary, "rev-parse", "main"), remote_head)
        target = self.primary / ".worktrees" / "fix-worktree-routing"
        self.assertEqual(Path(str(payload["worktree_path"])), target)
        self.assertEqual(payload["branch_name"], "codex/fix-worktree-routing")
        self.assertEqual(git(target, "rev-parse", "HEAD"), remote_head)
        ignored = run(
            ["git", "check-ignore", "--quiet", "--no-index", ".worktrees/ignore-probe"],
            self.primary,
            check=False,
        )
        self.assertEqual(ignored.returncode, 0)

    def test_primary_non_main_updates_main_without_switching(self) -> None:
        git(self.primary, "switch", "-c", "feature/local")
        remote_head = self.advance_remote("background-main")
        proc, _ = self.invoke(self.primary, "background-main-sync")

        self.assertEqual(proc.returncode, 0)
        self.assertEqual(git(self.primary, "branch", "--show-current"), "feature/local")
        self.assert_main_synced()
        self.assertEqual(git(self.primary, "rev-parse", "main"), remote_head)

    def test_linked_and_nested_invocations_create_flat_siblings(self) -> None:
        root = self.primary / ".worktrees"
        root.mkdir()
        caller = root / "caller"
        git(self.primary, "worktree", "add", "-b", "caller", str(caller), "main")

        proc, linked = self.invoke(caller, "linked-task")
        self.assertEqual(proc.returncode, 0)
        linked_target = root / "linked-task"
        self.assertEqual(Path(str(linked["worktree_path"])), linked_target)
        self.assertFalse((caller / ".worktrees" / "linked-task").exists())

        nested = caller / "nested" / "directory"
        nested.mkdir(parents=True)
        proc, nested_payload = self.invoke(nested, "nested-task")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(Path(str(nested_payload["worktree_path"])), root / "nested-task")
        self.assertFalse((caller / ".worktrees" / "nested-task").exists())

    def test_up_to_date_main_creates_worktree(self) -> None:
        proc, payload = self.invoke(self.primary, "already-current")
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(payload["status"], "created")
        self.assert_main_synced()

    def test_diverged_main_blocks_without_creating_worktree(self) -> None:
        (self.primary / "local.txt").write_text("local\n", encoding="utf-8")
        git(self.primary, "add", "local.txt")
        git(self.primary, "commit", "-m", "local main")
        git(self.primary, "switch", "-c", "feature/keep")
        self.advance_remote("diverged")

        proc, payload = self.invoke(self.primary, "must-block")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(payload["code"], "main_diverged")
        self.assertEqual(git(self.primary, "branch", "--show-current"), "feature/keep")
        self.assertFalse((self.primary / ".worktrees" / "must-block").exists())
        self.assertNotEqual(git(self.primary, "rev-parse", "main"), git(self.primary, "rev-parse", "origin/main"))

    def test_invalid_name_blocks_before_git_mutation(self) -> None:
        before = git(self.primary, "rev-parse", "origin/main")
        self.advance_remote("invalid-name")
        proc, payload = self.invoke(self.primary, "Bad Name")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(payload["code"], "invalid_name")
        self.assertEqual(git(self.primary, "rev-parse", "origin/main"), before)

    def test_missing_worktree_ignore_blocks_before_creation(self) -> None:
        (self.primary / ".gitignore").write_text("", encoding="utf-8")
        proc, payload = self.invoke(self.primary, "missing-ignore")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(payload["code"], "worktrees_not_ignored")
        self.assertFalse((self.primary / ".worktrees" / "missing-ignore").exists())

    def test_branch_name_conflict_blocks(self) -> None:
        git(self.primary, "branch", "codex/name-conflict", "main")
        proc, payload = self.invoke(self.primary, "name-conflict")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(payload["code"], "name_conflict")
        self.assertIn("branch", payload["conflicts"])
        self.assertFalse((self.primary / ".worktrees" / "name-conflict").exists())

    def test_worktree_path_conflict_blocks(self) -> None:
        target = self.primary / ".worktrees" / "path-conflict"
        target.mkdir(parents=True)
        proc, payload = self.invoke(self.primary, "path-conflict")
        self.assertEqual(proc.returncode, 2)
        self.assertEqual(payload["code"], "name_conflict")
        self.assertIn("path", payload["conflicts"])


if __name__ == "__main__":
    unittest.main()
