/**
 * Reproduce #14583: before_agent_start hook systemPrompt is collected but never applied.
 *
 * The hook runner correctly merges systemPrompt from plugin handlers,
 * but attempt.ts only reads prependContext and ignores systemPrompt.
 */
import { describe, expect, it } from "vitest";
import type { PluginRegistry } from "./registry.js";
import { createHookRunner } from "./hooks.js";

function createMockRegistry(hookResult: {
  systemPrompt?: string;
  prependContext?: string;
}): PluginRegistry {
  return {
    plugins: [],
    hooks: [
      {
        pluginId: "test-plugin",
        hookName: "before_agent_start",
        handler: async () => hookResult,
      },
    ],
    typedHooks: [
      {
        pluginId: "test-plugin",
        hookName: "before_agent_start" as const,
        handler: async () => hookResult,
      },
    ],
    tools: [],
    commands: [],
    channelPlugins: [],
    skillPlugins: [],
    memoryPlugins: [],
  } as unknown as PluginRegistry;
}

describe("Issue #14583: before_agent_start hook systemPrompt", () => {
  it("hook runner collects systemPrompt from plugin", async () => {
    const registry = createMockRegistry({
      systemPrompt: "Custom system prompt from plugin",
      prependContext: "Some prepended context",
    });
    const runner = createHookRunner(registry, { catchErrors: true });
    const result = await runner.runBeforeAgentStart({ prompt: "Hello" }, { agentId: "main" });

    // Hook runner correctly returns both fields
    expect(result?.systemPrompt).toBe("Custom system prompt from plugin");
    expect(result?.prependContext).toBe("Some prepended context");
  });

  it("hook runner collects systemPrompt even without prependContext", async () => {
    const registry = createMockRegistry({
      systemPrompt: "Only system prompt, no prepend",
    });
    const runner = createHookRunner(registry, { catchErrors: true });
    const result = await runner.runBeforeAgentStart({ prompt: "Hello" }, { agentId: "main" });

    expect(result?.systemPrompt).toBe("Only system prompt, no prepend");
    expect(result?.prependContext).toBeUndefined();
  });

  it("last plugin systemPrompt wins (merge behavior)", async () => {
    const registry = {
      plugins: [],
      hooks: [
        {
          pluginId: "plugin-a",
          hookName: "before_agent_start",
          handler: async () => ({ systemPrompt: "Prompt A" }),
        },
        {
          pluginId: "plugin-b",
          hookName: "before_agent_start",
          handler: async () => ({ systemPrompt: "Prompt B" }),
        },
      ],
      typedHooks: [
        {
          pluginId: "plugin-a",
          hookName: "before_agent_start" as const,
          handler: async () => ({ systemPrompt: "Prompt A" }),
        },
        {
          pluginId: "plugin-b",
          hookName: "before_agent_start" as const,
          handler: async () => ({ systemPrompt: "Prompt B" }),
        },
      ],
      tools: [],
      commands: [],
      channelPlugins: [],
      skillPlugins: [],
      memoryPlugins: [],
    } as unknown as PluginRegistry;

    const runner = createHookRunner(registry, { catchErrors: true });
    const result = await runner.runBeforeAgentStart({ prompt: "Hello" }, { agentId: "main" });

    // Last plugin wins for systemPrompt (per merge logic in hooks.ts)
    expect(result?.systemPrompt).toBe("Prompt B");
  });
});
