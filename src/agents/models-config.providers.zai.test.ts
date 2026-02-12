/**
 * Regression test for #14766: zai provider implicit model discovery
 *
 * Verifies that:
 * 1. resolveImplicitProviders includes zai when ZAI_API_KEY is set
 * 2. resolveZaiForwardCompatModel resolves glm-5 via forward-compat fallback
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveImplicitProviders } from "./models-config.providers.js";
import { resolveModel } from "./pi-embedded-runner/model.js";

describe("zai implicit provider (#14766)", () => {
  it("should include zai when ZAI_API_KEY is configured", async () => {
    const agentDir = mkdtempSync(join(tmpdir(), "openclaw-test-"));
    const previous = process.env.ZAI_API_KEY;
    process.env.ZAI_API_KEY = "test-key";

    try {
      const providers = await resolveImplicitProviders({ agentDir });
      expect(providers?.zai).toBeDefined();
      expect(providers?.zai?.apiKey).toBe("ZAI_API_KEY");
      const ids = providers?.zai?.models?.map((m) => m.id);
      expect(ids).toContain("glm-5");
      expect(ids).toContain("glm-4.7");
      expect(ids).toContain("glm-4.7-flash");
    } finally {
      if (previous === undefined) {
        delete process.env.ZAI_API_KEY;
      } else {
        process.env.ZAI_API_KEY = previous;
      }
    }
  });
});

describe("zai forward-compat fallback (#14766)", () => {
  it("resolveModel finds zai/glm-5 via forward-compat even without API key", () => {
    const result = resolveModel("zai", "glm-5");
    expect(result.model).toBeDefined();
    expect(result.model?.id).toBe("glm-5");
    expect(result.error).toBeUndefined();
  });
});
