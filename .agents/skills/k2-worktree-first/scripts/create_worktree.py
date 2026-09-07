#!/usr/bin/env python3
"""Create one named Vocora worktree from a verified local main branch."""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

REMOTE = "origin"
MAIN_BRANCH = "main"
NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


class Blocked(RuntimeError):
    def __init__(self, code: str, message: str, **details: object):
        self.code = code
        self.details = details
        super().__init__(message)


class GitError(RuntimeError):
    def __init__(self, args: list[str], proc: subprocess.CompletedProcess[str]):
        self.args_list = args
        self.returncode = proc.returncode
        self.stdout = proc.stdout.strip()
        self.stderr = proc.stderr.strip()
        super().__init__(self.stderr or self.stdout or f"git exited {proc.returncode}")


def git(repo: Path, args: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    command = ["git", "-C", str(repo), *args]
    proc = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if check and proc.returncode != 0:
        raise GitError(command, proc)
    return proc


def git_output(repo: Path, args: list[str]) -> str:
    return git(repo, args).stdout.strip()


def resolve_current_worktree(start: Path) -> Path:
    proc = git(start, ["rev-parse", "--show-toplevel"], check=False)
    if proc.returncode != 0:
        raise Blocked("not_git_repository", "current directory is not inside a git worktree")
    return Path(proc.stdout.strip()).resolve()


def resolve_primary_worktree(current: Path) -> Path:
    common_raw = git_output(current, ["rev-parse", "--git-common-dir"])
    common = Path(common_raw)
    if not common.is_absolute():
        common = current / common
    common = common.resolve()
    if common.name != ".git":
        raise Blocked("unsupported_repository", "git common directory is not a standard .git directory")
    primary = common.parent.resolve()
    if Path(git_output(primary, ["rev-parse", "--show-toplevel"])).resolve() != primary:
        raise Blocked("primary_worktree_unresolved", "could not verify the primary worktree")
    return primary


def worktree_entries(repo: Path) -> list[dict[str, str]]:
    output = git_output(repo, ["worktree", "list", "--porcelain"])
    entries: list[dict[str, str]] = []
    entry: dict[str, str] = {}
    for line in output.splitlines():
        if not line:
            if entry:
                entries.append(entry)
                entry = {}
            continue
        key, _, value = line.partition(" ")
        entry[key] = value
    if entry:
        entries.append(entry)
    return entries


def ref_oid(repo: Path, ref: str) -> str | None:
    proc = git(repo, ["rev-parse", "--verify", ref], check=False)
    return proc.stdout.strip() if proc.returncode == 0 else None


def is_ancestor(repo: Path, older: str, newer: str) -> bool:
    return git(repo, ["merge-base", "--is-ancestor", older, newer], check=False).returncode == 0


def checked_out_locations(repo: Path, branch_ref: str) -> list[Path]:
    return [
        Path(entry["worktree"]).resolve()
        for entry in worktree_entries(repo)
        if entry.get("branch") == branch_ref and entry.get("worktree")
    ]


def sync_main(primary: Path) -> str:
    main_ref = f"refs/heads/{MAIN_BRANCH}"
    remote_ref = f"refs/remotes/{REMOTE}/{MAIN_BRANCH}"
    git(primary, ["fetch", REMOTE, f"{MAIN_BRANCH}:{remote_ref}"])
    remote_oid = ref_oid(primary, remote_ref)
    if not remote_oid:
        raise Blocked("remote_main_unresolved", f"could not resolve {remote_ref} after fetch")

    local_oid = ref_oid(primary, main_ref)
    if not local_oid:
        git(primary, ["update-ref", main_ref, remote_oid])
    elif local_oid != remote_oid:
        if not is_ancestor(primary, local_oid, remote_oid):
            raise Blocked(
                "main_diverged",
                f"local {MAIN_BRANCH} cannot be fast-forwarded to {REMOTE}/{MAIN_BRANCH}",
                local_oid=local_oid,
                remote_oid=remote_oid,
            )
        locations = checked_out_locations(primary, main_ref)
        if locations:
            git(locations[0], ["merge", "--ff-only", remote_ref])
        else:
            git(primary, ["update-ref", main_ref, remote_oid, local_oid])

    verified_local = ref_oid(primary, main_ref)
    if verified_local != remote_oid:
        raise Blocked(
            "main_sync_failed",
            f"local {MAIN_BRANCH} does not match {REMOTE}/{MAIN_BRANCH} after synchronization",
            local_oid=verified_local,
            remote_oid=remote_oid,
        )
    return remote_oid


def validate_name(name: str) -> None:
    if not NAME_PATTERN.fullmatch(name):
        raise Blocked(
            "invalid_name",
            "name must match [a-z0-9]+(-[a-z0-9]+)*",
            name=name,
        )


def require_ignored_worktrees_root(primary: Path, worktrees_dir: Path) -> None:
    probe = (worktrees_dir / ".ignore-probe").relative_to(primary).as_posix()
    ignored = git(
        primary,
        ["check-ignore", "--quiet", "--no-index", "--", probe],
        check=False,
    )
    if ignored.returncode != 0:
        raise Blocked(
            "worktrees_not_ignored",
            "the primary .worktrees directory must be ignored before creating a linked worktree",
        )


def create_named_worktree(primary: Path, name: str, base_oid: str) -> tuple[Path, str]:
    worktrees_dir = (primary / ".worktrees").resolve()
    target = (worktrees_dir / name).resolve()
    if target.parent != worktrees_dir:
        raise Blocked("invalid_target", "worktree target must be a direct child of the primary .worktrees directory")
    require_ignored_worktrees_root(primary, worktrees_dir)

    branch_name = f"codex/{name}"
    conflicts: list[str] = []
    if ref_oid(primary, f"refs/heads/{branch_name}"):
        conflicts.append("branch")
    if os.path.lexists(target):
        conflicts.append("path")
    if any(Path(entry.get("worktree", "")).resolve() == target for entry in worktree_entries(primary) if entry.get("worktree")):
        conflicts.append("worktree")
    if conflicts:
        raise Blocked(
            "name_conflict",
            "the requested name already conflicts with an existing branch or worktree",
            name=name,
            conflicts=sorted(set(conflicts)),
        )

    worktrees_dir.mkdir(exist_ok=True)
    git(primary, ["worktree", "add", "-b", branch_name, str(target), f"refs/heads/{MAIN_BRANCH}"])
    if git_output(target, ["branch", "--show-current"]) != branch_name:
        raise Blocked("worktree_verification_failed", "created worktree is not on the expected branch")
    if git_output(target, ["rev-parse", "HEAD"]) != base_oid:
        raise Blocked("worktree_verification_failed", "created worktree HEAD does not match synchronized main")
    return target, branch_name


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a named Vocora worktree from synchronized local main.")
    parser.add_argument("--name", required=True, help="Canonical semantic task name, for example fix-worktree-routing.")
    return parser.parse_args()


def emit(payload: dict[str, object], *, stream: object = sys.stdout) -> None:
    print(json.dumps(payload, sort_keys=True), file=stream)


def main() -> int:
    args = parse_args()
    try:
        validate_name(args.name)
        current = resolve_current_worktree(Path.cwd())
        primary = resolve_primary_worktree(current)
        base_oid = sync_main(primary)
        worktree_path, branch_name = create_named_worktree(primary, args.name, base_oid)
        emit(
            {
                "schema_version": 1,
                "status": "created",
                "name": args.name,
                "primary_worktree": str(primary),
                "worktree_path": str(worktree_path),
                "branch_name": branch_name,
                "base_ref": f"refs/heads/{MAIN_BRANCH}",
                "base_oid": base_oid,
            }
        )
        return 0
    except Blocked as exc:
        emit(
            {
                "schema_version": 1,
                "status": "blocked",
                "code": exc.code,
                "message": str(exc),
                **exc.details,
            },
            stream=sys.stderr,
        )
        return 2
    except GitError as exc:
        emit(
            {
                "schema_version": 1,
                "status": "blocked",
                "code": "git_error",
                "message": str(exc),
                "command": exc.args_list,
                "returncode": exc.returncode,
                "stdout": exc.stdout,
                "stderr": exc.stderr,
            },
            stream=sys.stderr,
        )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
