import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("nextcloud-talk package.json", () => {
  it("declares zod as a runtime dependency (required for plugin install --omit=dev)", () => {
    const pkgPath = path.resolve(__dirname, "..", "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies.zod).toBeDefined();
  });
});
