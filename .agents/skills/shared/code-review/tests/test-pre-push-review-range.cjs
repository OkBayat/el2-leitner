#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { validatePrePushReviewRange } = require("../scripts/pre-push-review-range.cjs");

const BASE = "a".repeat(40);
const HEAD = "b".repeat(40);
const RUNNER_SOURCE = "c".repeat(40);

function execFixture({
  ancestors = [[BASE, HEAD]],
  canonicalBase = BASE,
  failBaseResolution = false,
  resolvedBase = null,
} = {}) {
  return (command, args) => {
    assert.equal(command, "git");
    if (args[0] === "branch") return "codex/issue-701\n";
    if (args[0] === "rev-parse" && args[1] === "HEAD") return `${HEAD}\n`;
    if (args[0] === "rev-parse" && args[1].endsWith("^{commit}")) {
      return `${resolvedBase || args[1].slice(0, -9)}\n`;
    }
    if (args[0] === "merge-base" && args[1] === "--is-ancestor") {
      if (ancestors.some(([ancestor, descendant]) => args[2] === ancestor && args[3] === descendant)) return "";
      const error = new Error("not ancestor");
      error.status = 1;
      throw error;
    }
    if (args[0] === "merge-base") {
      if (failBaseResolution) throw new Error("unknown revision");
      return `${canonicalBase}\n`;
    }
    throw new Error(`unexpected git command: ${args.join(" ")}`);
  };
}

const accepted = validatePrePushReviewRange({
  baseRef: "main",
  baseSha: BASE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture(),
});
assert.equal(accepted.action, "ok");
assert.equal(accepted.review_range, `${BASE}..${HEAD}`);

for (const mutableBase of ["main", BASE.slice(0, 12), `${BASE}^`]) {
  const mutable = validatePrePushReviewRange({
    baseRef: "main",
    baseSha: mutableBase,
    branchName: "codex/issue-701",
    headSha: HEAD,
    execFileSync: execFixture(),
  });
  assert.equal(mutable.action, "blocked");
  assert.match(mutable.reason, /immutable full commit SHA/);
}

const resolvedMismatch = validatePrePushReviewRange({
  baseRef: "main",
  baseSha: BASE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture({ resolvedBase: RUNNER_SOURCE }),
});
assert.equal(resolvedMismatch.action, "blocked");
assert.match(resolvedMismatch.reason, /resolve to its exact full commit SHA/);
assert.equal(resolvedMismatch.review_base_sha, BASE);
assert.equal(resolvedMismatch.resolved_review_base_sha, RUNNER_SOURCE);

const advancedBase = validatePrePushReviewRange({
  baseRef: "main",
  baseSha: BASE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture({
    ancestors: [[BASE, RUNNER_SOURCE], [RUNNER_SOURCE, HEAD]],
    canonicalBase: RUNNER_SOURCE,
  }),
});
assert.equal(advancedBase.action, "ok");
assert.equal(advancedBase.review_base_sha, BASE);
assert.equal(advancedBase.canonical_review_base_sha, RUNNER_SOURCE);
assert.equal(advancedBase.review_range, `${RUNNER_SOURCE}..${HEAD}`);

const canonicalNotAncestor = validatePrePushReviewRange({
  baseRef: "main",
  baseSha: BASE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture({
    ancestors: [[BASE, RUNNER_SOURCE]],
    canonicalBase: RUNNER_SOURCE,
  }),
});
assert.equal(canonicalNotAncestor.action, "blocked");
assert.match(canonicalNotAncestor.reason, /base is not an ancestor of the reviewed head/);
assert.equal(canonicalNotAncestor.review_base_sha, BASE);
assert.equal(canonicalNotAncestor.canonical_review_base_sha, RUNNER_SOURCE);

const provenanceBase = validatePrePushReviewRange({
  baseRef: "main",
  baseSha: RUNNER_SOURCE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture(),
});
assert.equal(provenanceBase.action, "blocked");
assert.match(provenanceBase.reason, /base does not match the canonical task branch base/);
assert.equal(provenanceBase.canonical_review_base_sha, BASE);

const unresolvedBase = validatePrePushReviewRange({
  baseRef: "missing/base",
  baseSha: BASE,
  branchName: "codex/issue-701",
  headSha: HEAD,
  execFileSync: execFixture({ failBaseResolution: true }),
});
assert.equal(unresolvedBase.action, "blocked");
assert.match(unresolvedBase.reason, /identities could not be resolved by git/);

console.log("test-pre-push-review-range: ok");
