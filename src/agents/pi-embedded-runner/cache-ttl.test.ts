import { describe, expect, it } from "vitest";
import { isCacheTtlEligibleProvider } from "./cache-ttl.js";

describe("isCacheTtlEligibleProvider", () => {
  // Existing supported providers
  it("returns true for anthropic", () => {
    expect(isCacheTtlEligibleProvider("anthropic", "claude-sonnet-4-20250514")).toBe(true);
  });

  it("returns true for openrouter with anthropic model", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "anthropic/claude-sonnet-4-20250514")).toBe(
      true,
    );
  });

  it("returns false for openrouter with non-anthropic model", () => {
    expect(isCacheTtlEligibleProvider("openrouter", "openai/gpt-4o")).toBe(false);
  });

  // ZAI provider (GLM-5 native caching)
  it("returns true for zai provider", () => {
    expect(isCacheTtlEligibleProvider("zai", "glm-5")).toBe(true);
  });

  it("returns true for zai provider (case-insensitive)", () => {
    expect(isCacheTtlEligibleProvider("ZAI", "GLM-5")).toBe(true);
  });

  // Moonshot provider (Kimi K2 prompt caching)
  it("returns true for moonshot provider", () => {
    expect(isCacheTtlEligibleProvider("moonshot", "kimi-k2")).toBe(true);
  });

  it("returns true for moonshot provider (case-insensitive)", () => {
    expect(isCacheTtlEligibleProvider("Moonshot", "Kimi-K2")).toBe(true);
  });

  // Unsupported providers
  it("returns false for unsupported provider", () => {
    expect(isCacheTtlEligibleProvider("openai", "gpt-4o")).toBe(false);
  });
});
