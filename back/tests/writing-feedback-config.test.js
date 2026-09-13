import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadConfig } from "../src/config/loadConfig.js";

const enabled = {
  NODE_ENV: "test", WRITING_FEEDBACK_ENABLED: "true",
  OPENAI_API_KEY: 'test-key',
};
describe("Writing feedback configuration", () => {
  it("defaults off without requiring provider assets or changing existing service readiness", () => {
    const config = loadConfig({ NODE_ENV: "test" }).writingFeedback;
    assert.equal(config.enabled, false);
    assert.equal(config.retentionDays, 30);
    assert.equal(config.timeoutMs, 30000);
    assert.equal(config.model, 'gpt-5-nano');
  });
  it('accepts server-only OpenAI configuration', () => {
    const config = loadConfig(enabled).writingFeedback;
    assert.equal(config.enabled, true);
    assert.equal(config.apiKey, 'test-key');
    assert.equal(config.model, 'gpt-5-nano');
  });
  it('rejects a missing key and unbounded controls', () => {
    for (const values of [
      { ...enabled, OPENAI_API_KEY: '' },
      { ...enabled, OPENAI_MODEL: 'bad model' },
      { ...enabled, OPENAI_TIMEOUT_MS: '999999' },
      { ...enabled, WRITING_FEEDBACK_RETENTION_DAYS: "0" },
      { ...enabled, WRITING_FEEDBACK_ENABLED: "yes" },
    ]) assert.throws(() => loadConfig(values), { code: "INVALID_CONFIGURATION" });
  });
});
