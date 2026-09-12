import { writingFeedbackProfileKey } from "./writingFeedbackIdentity.js";
import { WritingFeedbackError } from "../../domain/writing-feedback/WritingFeedbackError.js";

const SAFE_FAILURE_CODES = new Set([
  "WRITING_FEEDBACK_DISABLED", "WRITING_FEEDBACK_UNAVAILABLE", "WRITING_FEEDBACK_TIMEOUT",
  "WRITING_FEEDBACK_CANCELLED", "WRITING_FEEDBACK_PROFILE_CHANGED",
]);

async function settledWithin(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise.then(() => true, () => true),
      new Promise((resolve) => { timer = setTimeout(() => resolve(false), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export class WritingFeedbackWorker {
  constructor({ repository, provider, enabled = false, clock = () => new Date(), idFactory, timeoutMs = 120_000, cleanupTimeoutMs = 5000, pollIntervalMs = 1000, logger = console }) {
    Object.assign(this, { repository, provider, enabled, clock, idFactory, timeoutMs, cleanupTimeoutMs, pollIntervalMs, logger });
    this.workerId = idFactory();
    this.active = null;
    this.running = null;
    this.timer = null;
    this.started = false;
    this.stopping = false;
  }

  runOnce() {
    if (this.stopping) return Promise.resolve();
    if (this.running) return this.running;
    // A provider violating its abort contract must not receive another request.
    if (this.active) return Promise.resolve();
    this.running = this.processNext().finally(() => { this.running = null; });
    return this.running;
  }

  async processNext() {
    const now = this.clock().toISOString();
    await this.repository.purgeExpired(now, 100);
    const leaseToken = this.idFactory();
    const evaluationProfile = this.enabled ? this.provider?.getIdentity?.() ?? null : null;
    const record = await this.repository.claim({ workerId: this.workerId, leaseToken, now, leaseUntil: new Date(Date.parse(now) + this.timeoutMs + this.cleanupTimeoutMs + 10_000).toISOString(), maxAttempts: 3, evaluationProfile });
    if (!record) return;
    const controller = new AbortController();
    const active = { id: record.id, controller };
    this.active = active;
    let timeout;
    let evaluation;
    let result = null;
    let identity = null;
    let metrics = null;
    let errorCode = null;
    try {
      if (this.stopping) throw Object.assign(new Error(), { code: "WRITING_FEEDBACK_CANCELLED" });
      if (!this.enabled) throw Object.assign(new Error(), { code: "WRITING_FEEDBACK_DISABLED" });
      if (record.evaluationProfile && writingFeedbackProfileKey(record.evaluationProfile) !== writingFeedbackProfileKey(evaluationProfile)) {
        throw Object.assign(new Error(), { code: "WRITING_FEEDBACK_PROFILE_CHANGED" });
      }
      const interruption = new Promise((_resolve, reject) => {
        controller.signal.addEventListener("abort", () => reject(Object.assign(new Error(), { code: controller.signal.reason ?? "WRITING_FEEDBACK_CANCELLED" })), { once: true });
        timeout = setTimeout(() => controller.abort("WRITING_FEEDBACK_TIMEOUT"), this.timeoutMs);
      });
      evaluation = Promise.resolve().then(() => this.provider.evaluate({ draftText: record.draftText, draftVersion: record.id, taskContext: record.taskContext, contentVersion: record.contentVersion, locale: "en", signal: controller.signal }));
      ({ result, identity, metrics } = await Promise.race([evaluation, interruption]));
    } catch (error) {
      errorCode = error instanceof WritingFeedbackError || SAFE_FAILURE_CODES.has(error?.code) ? error.code : "WRITING_FEEDBACK_UNAVAILABLE";
    } finally { clearTimeout(timeout); }

    const finish = async () => {
      try {
        await this.repository.finish({ id: record.id, leaseToken, now: this.clock().toISOString(), status: errorCode ? "unavailable" : "completed", result, identity, metrics, errorCode });
      } finally { if (this.active === active) this.active = null; }
    };
    if (evaluation && !await settledWithin(evaluation, this.cleanupTimeoutMs)) {
      // Keep the persisted lease while cleanup is unresolved. The next process
      // can reconcile expiry; this process remains closed to further inference.
      active.cleanup = evaluation.then(finish, finish).catch(() => {
        this.logger.warn?.("Writing feedback cleanup could not update its queue.");
      });
      return;
    }
    await finish();
  }

  cancel(id) {
    if (this.active?.id === id) this.active.controller.abort("WRITING_FEEDBACK_CANCELLED");
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.stopping = false;
    const tick = async () => {
      try { await this.runOnce(); } catch { this.logger.warn?.("Writing feedback worker could not access its queue."); }
      if (this.started) {
        this.timer = setTimeout(tick, this.pollIntervalMs);
        this.timer.unref?.();
      }
    };
    void tick();
  }

  async stop() {
    this.started = false;
    this.stopping = true;
    clearTimeout(this.timer);
    this.active?.controller.abort("WRITING_FEEDBACK_CANCELLED");
    await this.running?.catch(() => {});
  }
}
