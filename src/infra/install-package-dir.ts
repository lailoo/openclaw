import fs from "node:fs/promises";
import path from "node:path";
import { runCommandWithTimeout } from "../process/exec.js";
import { fileExists } from "./archive.js";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

// Strip workspace: protocol entries from all dependency fields so npm install
// never encounters the pnpm-only protocol (see #24578).
const SANITIZED_DEP_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

async function sanitizeManifestForNpmInstall(targetDir: string): Promise<void> {
  const manifestPath = path.join(targetDir, "package.json");
  let manifestRaw = "";
  try {
    manifestRaw = await fs.readFile(manifestPath, "utf-8");
  } catch {
    return;
  }

  let manifest: Record<string, unknown>;
  try {
    const parsed = JSON.parse(manifestRaw) as unknown;
    if (!isObjectRecord(parsed)) {
      return;
    }
    manifest = parsed;
  } catch {
    return;
  }

  let changed = false;
  for (const field of SANITIZED_DEP_FIELDS) {
    const deps = manifest[field];
    if (!isObjectRecord(deps)) {
      continue;
    }

    const filteredEntries = Object.entries(deps).filter(([, rawSpec]) => {
      const spec = typeof rawSpec === "string" ? rawSpec.trim() : "";
      return !spec.startsWith("workspace:");
    });
    if (filteredEntries.length === Object.keys(deps).length) {
      continue;
    }

    changed = true;
    if (filteredEntries.length === 0) {
      delete manifest[field];
    } else {
      manifest[field] = Object.fromEntries(filteredEntries);
    }
  }

  if (changed) {
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
  }
}

export async function installPackageDir(params: {
  sourceDir: string;
  targetDir: string;
  mode: "install" | "update";
  timeoutMs: number;
  logger?: { info?: (message: string) => void };
  copyErrorPrefix: string;
  hasDeps: boolean;
  depsLogMessage: string;
  afterCopy?: () => void | Promise<void>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  params.logger?.info?.(`Installing to ${params.targetDir}…`);
  let backupDir: string | null = null;
  if (params.mode === "update" && (await fileExists(params.targetDir))) {
    const backupRoot = path.join(path.dirname(params.targetDir), ".openclaw-install-backups");
    backupDir = path.join(backupRoot, `${path.basename(params.targetDir)}-${Date.now()}`);
    await fs.mkdir(backupRoot, { recursive: true });
    await fs.rename(params.targetDir, backupDir);
  }

  const rollback = async () => {
    if (!backupDir) {
      return;
    }
    await fs.rm(params.targetDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.rename(backupDir, params.targetDir).catch(() => undefined);
  };

  try {
    await fs.cp(params.sourceDir, params.targetDir, { recursive: true });
  } catch (err) {
    await rollback();
    return { ok: false, error: `${params.copyErrorPrefix}: ${String(err)}` };
  }

  try {
    await params.afterCopy?.();
  } catch (err) {
    await rollback();
    return { ok: false, error: `post-copy validation failed: ${String(err)}` };
  }

  if (params.hasDeps) {
    await sanitizeManifestForNpmInstall(params.targetDir);
    params.logger?.info?.(params.depsLogMessage);
    const npmRes = await runCommandWithTimeout(
      ["npm", "install", "--omit=dev", "--silent", "--ignore-scripts"],
      {
        timeoutMs: Math.max(params.timeoutMs, 300_000),
        cwd: params.targetDir,
      },
    );
    if (npmRes.code !== 0) {
      await rollback();
      return {
        ok: false,
        error: `npm install failed: ${npmRes.stderr.trim() || npmRes.stdout.trim()}`,
      };
    }
  }

  if (backupDir) {
    await fs.rm(backupDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return { ok: true };
}
