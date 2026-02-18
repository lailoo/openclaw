/**
 * Regression test for #19988: normalizeLogger destroys tslog this-binding
 *
 * Ensures that logger methods passed to plugins preserve their `this` binding,
 * which is required by loggers like tslog that access internal state via `this`.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Logger } from "tslog";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { loadOpenClawPlugins } from "./loader.js";
import type { PluginLogger } from "./types.js";

const fixtureRoot = path.join(os.tmpdir(), `openclaw-logger-test-${randomUUID()}`);
let tempDirIndex = 0;
const prevBundledDir = process.env.OPENCLAW_BUNDLED_PLUGINS_DIR;
const EMPTY_PLUGIN_SCHEMA = { type: "object", additionalProperties: false, properties: {} };

function makeTempDir() {
  const dir = path.join(fixtureRoot, `case-${tempDirIndex++}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function writePlugin(params: { id: string; body: string; dir?: string; filename?: string }) {
  const dir = params.dir ?? makeTempDir();
  const filename = params.filename ?? `${params.id}.js`;
  const file = path.join(dir, filename);
  fs.writeFileSync(file, params.body, "utf-8");
  fs.writeFileSync(
    path.join(dir, "openclaw.plugin.json"),
    JSON.stringify({ id: params.id, configSchema: EMPTY_PLUGIN_SCHEMA }, null, 2),
    "utf-8",
  );
  return { dir, file, id: params.id };
}

afterEach(() => {
  if (prevBundledDir === undefined) {
    delete process.env.OPENCLAW_BUNDLED_PLUGINS_DIR;
  } else {
    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = prevBundledDir;
  }
});

afterAll(() => {
  try {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  } catch {
    // ignore cleanup failures
  }
});

describe("normalizeLogger this-binding (#19988)", () => {
  it("preserves this-binding when logger methods are called via api.logger", () => {
    // Create a logger class that relies on `this` (like tslog)
    class ThisDependentLogger implements PluginLogger {
      private prefix = "[test-plugin]";
      public callCount = 0;

      info(_message: string): void {
        // tslog and similar loggers access internal state via `this`
        if (this === undefined || this.prefix === undefined) {
          throw new Error("BUG CONFIRMED: `this` is undefined - binding lost");
        }
        this.callCount++;
      }

      warn(_message: string): void {
        if (this === undefined || this.prefix === undefined) {
          throw new Error("BUG CONFIRMED: `this` is undefined - binding lost");
        }
        this.callCount++;
      }

      error(_message: string): void {
        if (this === undefined || this.prefix === undefined) {
          throw new Error("BUG CONFIRMED: `this` is undefined - binding lost");
        }
        this.callCount++;
      }

      debug(_message: string): void {
        if (this === undefined || this.prefix === undefined) {
          throw new Error("BUG CONFIRMED: `this` is undefined - binding lost");
        }
        this.callCount++;
      }
    }

    const thisDependentLogger = new ThisDependentLogger();

    // This plugin will call api.logger methods
    const plugin = writePlugin({
      id: "test-logger-binding",
      body: `
        globalThis.__loggerBindingTestResult = { passed: true, error: null };

        export default {
          id: "test-logger-binding",
          register(api) {
            try {
              api.logger.info("test info");
              api.logger.warn("test warn");
              api.logger.error("test error");
              if (api.logger.debug) {
                api.logger.debug("test debug");
              }
            } catch (err) {
              globalThis.__loggerBindingTestResult = {
                passed: false,
                error: err.message
              };
            }
          }
        };
      `,
    });

    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = plugin.dir;

    // Pass our this-dependent logger to loadOpenClawPlugins
    const registry = loadOpenClawPlugins({
      cache: false,
      logger: thisDependentLogger,
      config: {
        plugins: {
          allow: ["test-logger-binding"],
          entries: {
            "test-logger-binding": { enabled: true },
          },
        },
      },
    });

    const loaded = registry.plugins.find((entry) => entry.id === "test-logger-binding");
    expect(loaded?.status).toBe("loaded");

    // Check if the logger calls succeeded
    const result = (globalThis as Record<string, unknown>).__loggerBindingTestResult as {
      passed: boolean;
      error: string | null;
    };

    expect(result.passed).toBe(true);
  });

  it("preserves this-binding with real tslog logger", () => {
    // Create a real tslog logger instance - this is what users actually use
    // tslog methods rely on `this` to access internal state
    const tslogLogger = new Logger({ type: "hidden" });

    const plugin = writePlugin({
      id: "test-tslog-binding",
      body: `
        globalThis.__tslogBindingTestResult = { passed: true, error: null };

        export default {
          id: "test-tslog-binding",
          register(api) {
            try {
              api.logger.info("test info from tslog");
              api.logger.warn("test warn from tslog");
              api.logger.error("test error from tslog");
              if (api.logger.debug) {
                api.logger.debug("test debug from tslog");
              }
            } catch (err) {
              globalThis.__tslogBindingTestResult = {
                passed: false,
                error: err.message
              };
            }
          }
        };
      `,
    });

    process.env.OPENCLAW_BUNDLED_PLUGINS_DIR = plugin.dir;

    // Pass the tslog logger directly - normalizeLogger should preserve the binding
    const registry = loadOpenClawPlugins({
      cache: false,
      logger: tslogLogger,
      config: {
        plugins: {
          allow: ["test-tslog-binding"],
          entries: {
            "test-tslog-binding": { enabled: true },
          },
        },
      },
    });

    const loaded = registry.plugins.find((entry) => entry.id === "test-tslog-binding");
    expect(loaded?.status).toBe("loaded");

    const result = (globalThis as Record<string, unknown>).__tslogBindingTestResult as {
      passed: boolean;
      error: string | null;
    };

    expect(result.passed).toBe(true);
  });
});
