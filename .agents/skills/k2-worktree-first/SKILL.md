---
name: k2-worktree-first
description: Explicit-only Vocora worktree bootstrap. Use only when the user directly names `k2-worktree-first` or `$k2-worktree-first`; never select this skill from inferred worktree, isolation, branch, or task intent.
---

# Vocora Worktree First

Use this skill only after the user directly names `k2-worktree-first` or `$k2-worktree-first`.

1. Choose one short semantic task name matching `[a-z0-9]+(-[a-z0-9]+)*`.
2. Run the deterministic creator without reading its source during normal use:

```bash
rtk python3 .agents/skills/k2-worktree-first/scripts/create_worktree.py --name "<task-name>"
```

3. On `status: "created"`, report `worktree_path` and `branch_name`, then use that worktree as the `workdir` for all remaining task work.
4. On `status: "blocked"`, stop and report the returned blocker. For `code: "name_conflict"`, Codex may choose a different semantic name and rerun the same command; do not add automatic suffixes.

## Determinism Boundary

### Script-owned

- Resolve the repository and primary worktree, fetch `origin/main`, safely synchronize and verify local `main`, validate the name, detect conflicts, create the flat branch/worktree, verify the result, and emit machine-readable output.

### Codex-owned

- Understand the task, choose the semantic name, invoke the creator, and continue from the returned worktree.

### No manual fallback

- Do not replace creator behavior with manual Git commands, silently rewrite the supplied name, switch branches to update `main`, force/reset diverged `main`, or invent retry suffixes.
