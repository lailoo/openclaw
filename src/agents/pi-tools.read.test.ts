import { describe, expect, it } from "vitest";
import {
  assertRequiredParams,
  CLAUDE_PARAM_GROUPS,
  normalizeToolParams,
} from "./pi-tools.read.js";

describe("assertRequiredParams", () => {
  describe("edit param groups", () => {
    const groups = CLAUDE_PARAM_GROUPS.edit;

    it("accepts a complete edit with non-empty newText", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", oldText: "foo", newText: "bar" },
          groups,
          "edit",
        );
      }).not.toThrow();
    });

    it("accepts empty string newText for line deletion (#19085)", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", oldText: "import foo\n", newText: "" },
          groups,
          "edit",
        );
      }).not.toThrow();
    });

    it("accepts whitespace-only newText (#19085)", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", oldText: "import foo\n", newText: "\n" },
          groups,
          "edit",
        );
      }).not.toThrow();
    });

    it("accepts Claude-style aliases (file_path, old_string, new_string)", () => {
      expect(() => {
        assertRequiredParams(
          { file_path: "a.ts", old_string: "foo", new_string: "" },
          groups,
          "edit",
        );
      }).not.toThrow();
    });

    it("rejects missing newText entirely", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", oldText: "foo" },
          groups,
          "edit",
        );
      }).toThrow(/Missing required parameter/);
    });

    it("rejects missing path", () => {
      expect(() => {
        assertRequiredParams(
          { oldText: "foo", newText: "bar" },
          groups,
          "edit",
        );
      }).toThrow(/Missing required parameter/);
    });

    it("rejects missing oldText", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", newText: "bar" },
          groups,
          "edit",
        );
      }).toThrow(/Missing required parameter/);
    });

    it("rejects empty oldText (not allowEmpty)", () => {
      expect(() => {
        assertRequiredParams(
          { path: "a.ts", oldText: "", newText: "bar" },
          groups,
          "edit",
        );
      }).toThrow(/Missing required parameter/);
    });
  });

  describe("read param groups", () => {
    const groups = CLAUDE_PARAM_GROUPS.read;

    it("accepts path", () => {
      expect(() => {
        assertRequiredParams({ path: "a.ts" }, groups, "read");
      }).not.toThrow();
    });

    it("accepts file_path alias", () => {
      expect(() => {
        assertRequiredParams({ file_path: "a.ts" }, groups, "read");
      }).not.toThrow();
    });

    it("rejects missing path", () => {
      expect(() => {
        assertRequiredParams({}, groups, "read");
      }).toThrow(/Missing required parameter/);
    });
  });

  describe("write param groups", () => {
    const groups = CLAUDE_PARAM_GROUPS.write;

    it("accepts path + content", () => {
      expect(() => {
        assertRequiredParams({ path: "a.ts", content: "hello" }, groups, "write");
      }).not.toThrow();
    });

    it("rejects empty content", () => {
      expect(() => {
        assertRequiredParams({ path: "a.ts", content: "" }, groups, "write");
      }).toThrow(/Missing required parameter/);
    });
  });
});

describe("normalizeToolParams", () => {
  it("maps file_path to path", () => {
    const result = normalizeToolParams({ file_path: "a.ts" });
    expect(result?.path).toBe("a.ts");
    expect(result?.file_path).toBeUndefined();
  });

  it("maps old_string/new_string to oldText/newText", () => {
    const result = normalizeToolParams({
      file_path: "a.ts",
      old_string: "foo",
      new_string: "",
    });
    expect(result?.oldText).toBe("foo");
    expect(result?.newText).toBe("");
    expect(result?.old_string).toBeUndefined();
    expect(result?.new_string).toBeUndefined();
  });

  it("preserves original keys when aliases absent", () => {
    const result = normalizeToolParams({ path: "a.ts", oldText: "x", newText: "y" });
    expect(result?.path).toBe("a.ts");
    expect(result?.oldText).toBe("x");
    expect(result?.newText).toBe("y");
  });
});
