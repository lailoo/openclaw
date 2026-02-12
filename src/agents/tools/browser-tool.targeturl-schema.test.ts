/**
 * Regression test for #14700: Browser tool targetUrl schema/runtime mismatch
 *
 * Uses the same mock pattern as browser-tool.test.ts to isolate external deps,
 * but calls the REAL createBrowserTool().execute() to walk the actual code path.
 */
import { describe, expect, it, vi } from "vitest";

// Same mocks as browser-tool.test.ts — isolate external deps only
vi.mock("../../browser/client.js", () => ({
  browserCloseTab: vi.fn(async () => ({})),
  browserFocusTab: vi.fn(async () => ({})),
  browserOpenTab: vi.fn(async () => ({})),
  browserProfiles: vi.fn(async () => []),
  browserSnapshot: vi.fn(async () => ({ ok: true })),
  browserStart: vi.fn(async () => ({})),
  browserStatus: vi.fn(async () => ({
    ok: true,
    running: true,
    pid: 1,
    cdpPort: 18792,
    cdpUrl: "http://127.0.0.1:18792",
  })),
  browserStop: vi.fn(async () => ({})),
  browserTabs: vi.fn(async () => []),
}));
vi.mock("../../browser/config.js", () => ({
  resolveBrowserConfig: vi.fn(() => ({ enabled: true, controlPort: 18791 })),
}));
vi.mock("./nodes-utils.js", async () => {
  const actual = await vi.importActual<typeof import("./nodes-utils.js")>("./nodes-utils.js");
  return { ...actual, listNodes: vi.fn(async () => []) };
});
vi.mock("./gateway.js", () => ({
  callGatewayTool: vi.fn(async () => ({ ok: true, payload: { result: { ok: true } } })),
}));
vi.mock("../../config/config.js", () => ({
  loadConfig: vi.fn(() => ({ browser: {} })),
}));
vi.mock("./common.js", async () => {
  const actual = await vi.importActual<typeof import("./common.js")>("./common.js");
  return { ...actual, imageResultFromFile: vi.fn() };
});

import { createBrowserTool } from "./browser-tool.js";
import { BrowserToolSchema } from "./browser-tool.schema.js";

describe("BrowserToolSchema targetUrl consistency (#14700)", () => {
  it("schema targetUrl has description guiding the model", () => {
    const props = (BrowserToolSchema as Record<string, unknown>).properties as Record<
      string,
      Record<string, unknown>
    >;
    const targetUrlProp = props.targetUrl;
    const innerSchemas = (targetUrlProp.anyOf as Record<string, unknown>[]) ?? [targetUrlProp];
    const descriptions = innerSchemas
      .map((s) => s.description as string | undefined)
      .filter(Boolean);
    expect(descriptions.length).toBeGreaterThan(0);
    expect(descriptions[0]).toMatch(/required.*open|open.*required/i);
  });

  it("execute(action:'open') error mentions the action name", async () => {
    const tool = createBrowserTool();
    await expect(tool.execute?.("call-1", { action: "open" })).rejects.toThrow(/open action/);
  });

  it("execute(action:'navigate') error mentions the action name", async () => {
    const tool = createBrowserTool();
    await expect(tool.execute?.("call-2", { action: "navigate" })).rejects.toThrow(
      /navigate action/,
    );
  });
});
