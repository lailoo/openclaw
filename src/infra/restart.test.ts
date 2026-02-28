import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const spawnSyncMock = vi.hoisted(() => vi.fn());
const resolveLsofCommandSyncMock = vi.hoisted(() => vi.fn());
const resolveGatewayPortMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
  spawnSync: (...args: unknown[]) => spawnSyncMock(...args),
}));

vi.mock("./ports-lsof.js", () => ({
  resolveLsofCommandSync: (...args: unknown[]) => resolveLsofCommandSyncMock(...args),
}));

vi.mock("../config/paths.js", () => ({
  resolveGatewayPort: (...args: unknown[]) => resolveGatewayPortMock(...args),
}));

import { captureFullEnv } from "../test-utils/env.js";
import {
  __testing,
  cleanStaleGatewayProcessesSync,
  findGatewayPidsOnPortSync,
} from "./restart-stale-pids.js";
import { triggerOpenClawRestart } from "./restart.js";

const envSnapshot = captureFullEnv();
const originalPlatformDescriptor = Object.getOwnPropertyDescriptor(process, "platform");

function setPlatform(platform: string) {
  if (!originalPlatformDescriptor) {
    return;
  }
  Object.defineProperty(process, "platform", {
    ...originalPlatformDescriptor,
    value: platform,
  });
}

beforeEach(() => {
  spawnSyncMock.mockReset();
  resolveLsofCommandSyncMock.mockReset();
  resolveGatewayPortMock.mockReset();

  resolveLsofCommandSyncMock.mockReturnValue("/usr/sbin/lsof");
  resolveGatewayPortMock.mockReturnValue(18789);
  __testing.setSleepSyncOverride(() => {});
});

afterEach(() => {
  __testing.setSleepSyncOverride(null);
  envSnapshot.restore();
  if (originalPlatformDescriptor) {
    Object.defineProperty(process, "platform", originalPlatformDescriptor);
  }
  vi.restoreAllMocks();
});

describe.runIf(process.platform !== "win32")("findGatewayPidsOnPortSync", () => {
  it("parses lsof output and filters non-openclaw/current processes", () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: [
        `p${process.pid}`,
        "copenclaw",
        "p4100",
        "copenclaw-gateway",
        "p4200",
        "cnode",
        "p4300",
        "cOpenClaw",
      ].join("\n"),
    });

    const pids = findGatewayPidsOnPortSync(18789);

    expect(pids).toEqual([4100, 4300]);
    expect(spawnSyncMock).toHaveBeenCalledWith(
      "/usr/sbin/lsof",
      ["-nP", "-iTCP:18789", "-sTCP:LISTEN", "-Fpc"],
      expect.objectContaining({ encoding: "utf8", timeout: 2000 }),
    );
  });

  it("returns empty when lsof fails", () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 1,
      stdout: "",
      stderr: "lsof failed",
    });

    expect(findGatewayPidsOnPortSync(18789)).toEqual([]);
  });
});

describe.runIf(process.platform !== "win32")("cleanStaleGatewayProcessesSync", () => {
  it("kills stale gateway pids discovered on the gateway port", () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: ["p6001", "copenclaw", "p6002", "copenclaw-gateway"].join("\n"),
    });
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const killed = cleanStaleGatewayProcessesSync();

    expect(killed).toEqual([6001, 6002]);
    expect(resolveGatewayPortMock).toHaveBeenCalledWith(undefined, process.env);
    expect(killSpy).toHaveBeenCalledWith(6001, "SIGTERM");
    expect(killSpy).toHaveBeenCalledWith(6002, "SIGTERM");
    expect(killSpy).toHaveBeenCalledWith(6001, "SIGKILL");
    expect(killSpy).toHaveBeenCalledWith(6002, "SIGKILL");
  });

  it("returns empty when no stale listeners are found", () => {
    spawnSyncMock.mockReturnValue({
      error: undefined,
      status: 0,
      stdout: "",
    });
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

    const killed = cleanStaleGatewayProcessesSync();

    expect(killed).toEqual([]);
    expect(killSpy).not.toHaveBeenCalled();
  });
});

describe("triggerOpenClawRestart on win32", () => {
  beforeEach(() => {
    // Bypass the test-mode early return so we exercise the real platform branches.
    delete process.env.VITEST;
    delete process.env.NODE_ENV;
    setPlatform("win32");
  });

  it("calls schtasks /End then /Run and returns ok on success", () => {
    // On win32, cleanStaleGatewayProcessesSync skips lsof (returns [] immediately),
    // so the first spawnSync call is schtasks /End, second is schtasks /Run.
    spawnSyncMock
      .mockReturnValueOnce({ error: undefined, status: 0, stdout: "", stderr: "" }) // /End
      .mockReturnValueOnce({ error: undefined, status: 0, stdout: "SUCCESS", stderr: "" }); // /Run

    const result = triggerOpenClawRestart();

    expect(result.ok).toBe(true);
    expect(result.method).toBe("schtasks");
    expect(result.tried).toEqual(
      expect.arrayContaining([
        expect.stringContaining("schtasks /End"),
        expect.stringContaining("schtasks /Run"),
      ]),
    );
  });

  it("returns failure when schtasks /Run fails", () => {
    spawnSyncMock
      .mockReturnValueOnce({ error: undefined, status: 0, stdout: "", stderr: "" }) // /End
      .mockReturnValueOnce({ error: undefined, status: 1, stdout: "", stderr: "access denied" }); // /Run

    const result = triggerOpenClawRestart();

    expect(result.ok).toBe(false);
    expect(result.method).toBe("schtasks");
    expect(result.detail).toContain("access denied");
  });

  it("uses OPENCLAW_WINDOWS_TASK_NAME env override", () => {
    process.env.OPENCLAW_WINDOWS_TASK_NAME = "MyCustomTask";
    spawnSyncMock
      .mockReturnValueOnce({ error: undefined, status: 0, stdout: "", stderr: "" }) // /End
      .mockReturnValueOnce({ error: undefined, status: 0, stdout: "SUCCESS", stderr: "" }); // /Run

    const result = triggerOpenClawRestart();

    expect(result.ok).toBe(true);
    expect(result.tried).toEqual(expect.arrayContaining([expect.stringContaining("MyCustomTask")]));
  });
});
