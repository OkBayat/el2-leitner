#!/usr/bin/env node
"use strict";

const { execFileSync: defaultExecFileSync } = require("child_process");

function validatePrePushReviewRange({
  baseRef,
  baseSha,
  branchName,
  headSha,
  execFileSync = defaultExecFileSync,
}) {
  const normalizedBaseRef = String(baseRef || "").trim();
  const normalizedBaseSha = String(baseSha || "").trim();
  const normalizedBranch = String(branchName || "").trim();
  const normalizedHeadSha = String(headSha || "").trim();
  if (!normalizedBaseRef || !normalizedBaseSha || !normalizedBranch || !normalizedHeadSha) {
    return { action: "blocked", reason: "pre-push review range requires base_ref, review_base_sha, branch_name, and review_head_sha" };
  }
  if (!/^[0-9a-f]{40}$/.test(normalizedBaseSha)) {
    return {
      action: "blocked",
      reason: "pre-push review base must be an immutable full commit SHA",
      review_base_sha: normalizedBaseSha,
    };
  }

  let currentBranch;
  let currentHead;
  let canonicalBase;
  let resolvedReviewBase;
  try {
    currentBranch = gitText(execFileSync, ["branch", "--show-current"]);
    currentHead = gitText(execFileSync, ["rev-parse", "HEAD"]);
    resolvedReviewBase = gitText(execFileSync, ["rev-parse", `${normalizedBaseSha}^{commit}`]);
    canonicalBase = gitText(execFileSync, ["merge-base", normalizedBaseRef, normalizedBranch]);
  } catch (error) {
    return {
      action: "blocked",
      reason: "pre-push review range identities could not be resolved by git",
      error: String(error?.message || error),
    };
  }

  if (resolvedReviewBase !== normalizedBaseSha) {
    return {
      action: "blocked",
      reason: "pre-push review base must resolve to its exact full commit SHA",
      review_base_sha: normalizedBaseSha,
      resolved_review_base_sha: resolvedReviewBase,
    };
  }

  if (currentBranch !== normalizedBranch) {
    return {
      action: "blocked",
      reason: "pre-push review branch does not match current branch",
      branch_name: normalizedBranch,
      current_branch: currentBranch,
    };
  }

  if (currentHead !== normalizedHeadSha) {
    return {
      action: "blocked",
      reason: "pre-push review head does not match current HEAD",
      review_head_sha: normalizedHeadSha,
      current_head: currentHead,
    };
  }

  if (
    canonicalBase !== normalizedBaseSha
    && !isGitAncestor(execFileSync, normalizedBaseSha, canonicalBase)
  ) {
    return {
      action: "blocked",
      reason: "pre-push review base does not match the canonical task branch base",
      base_ref: normalizedBaseRef,
      review_base_sha: normalizedBaseSha,
      canonical_review_base_sha: canonicalBase,
    };
  }

  if (!isGitAncestor(execFileSync, canonicalBase, normalizedHeadSha)) {
    return {
      action: "blocked",
      reason: "pre-push review base is not an ancestor of the reviewed head",
      review_base_sha: normalizedBaseSha,
      canonical_review_base_sha: canonicalBase,
      review_head_sha: normalizedHeadSha,
    };
  }

  return {
    action: "ok",
    base_ref: normalizedBaseRef,
    branch_name: normalizedBranch,
    review_base_sha: normalizedBaseSha,
    review_head_sha: normalizedHeadSha,
    ...(canonicalBase !== normalizedBaseSha ? { canonical_review_base_sha: canonicalBase } : {}),
    review_range: `${canonicalBase}..${normalizedHeadSha}`,
  };
}

function isGitAncestor(execFileSync, ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    return true;
  } catch (_) {
    return false;
  }
}

function gitText(execFileSync, args) {
  return String(execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }) || "").trim();
}

function parseArgs(argv) {
  const args = { baseRef: "", baseSha: "", branchName: "", headSha: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--base-ref") args.baseRef = requiredValue(argv, ++index, flag);
    else if (flag === "--base-sha") args.baseSha = requiredValue(argv, ++index, flag);
    else if (flag === "--branch") args.branchName = requiredValue(argv, ++index, flag);
    else if (flag === "--head-sha") args.headSha = requiredValue(argv, ++index, flag);
    else throw new Error(`Unknown argument: ${flag}`);
  }
  return args;
}

function requiredValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function main() {
  const result = validatePrePushReviewRange(parseArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.action !== "ok") process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { parseArgs, validatePrePushReviewRange };
