#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

const skill = readFileSync(path.join(__dirname, "..", "SKILL.md"), "utf8");
assert.match(skill, /review_base_sha/);
assert.match(skill, /base_ref/);
assert.match(skill, /shared\/code-review\/scripts\/pre-push-review-range\.cjs/);
assert.match(skill, /k2-requesting-code-review/);
assert.match(skill, /k2-receiving-code-review/);
assert.doesNotMatch(skill, /strategy-rescue|k2-pr-review-loop|task-runner|runner provenance/i);

process.stdout.write("test-pre-push-review-loop contract: ok\n");
