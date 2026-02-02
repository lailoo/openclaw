import { describe, expect, it } from "vitest";
import { stripMarkdownFromUrls } from "./strip-url-markdown.js";

describe("stripMarkdownFromUrls", () => {
  it("strips bold ** from URLs", () => {
    expect(stripMarkdownFromUrls("Check **https://example.com**")).toBe(
      "Check https://example.com",
    );
    expect(stripMarkdownFromUrls("Visit **https://foo.bar/path?q=1**")).toBe(
      "Visit https://foo.bar/path?q=1",
    );
  });

  it("strips bold __ from URLs", () => {
    expect(stripMarkdownFromUrls("Check __https://example.com__")).toBe(
      "Check https://example.com",
    );
  });

  it("strips italic * from URLs", () => {
    expect(stripMarkdownFromUrls("Check *https://example.com*")).toBe("Check https://example.com");
  });

  it("strips italic _ from URLs", () => {
    expect(stripMarkdownFromUrls("Check _https://example.com_")).toBe("Check https://example.com");
  });

  it("handles multiple URLs in text", () => {
    expect(stripMarkdownFromUrls("See **https://a.com** and *https://b.com*")).toBe(
      "See https://a.com and https://b.com",
    );
  });

  it("preserves non-URL bold/italic text", () => {
    expect(stripMarkdownFromUrls("This is **bold** text")).toBe("This is **bold** text");
    expect(stripMarkdownFromUrls("This is *italic* text")).toBe("This is *italic* text");
  });

  it("handles http URLs", () => {
    expect(stripMarkdownFromUrls("Check **http://example.com**")).toBe("Check http://example.com");
  });

  it("handles URLs with paths and query strings", () => {
    expect(stripMarkdownFromUrls("**https://example.com/path/to/page?foo=bar&baz=1**")).toBe(
      "https://example.com/path/to/page?foo=bar&baz=1",
    );
  });

  it("handles URLs with fragments", () => {
    expect(stripMarkdownFromUrls("**https://example.com/page#section**")).toBe(
      "https://example.com/page#section",
    );
  });

  it("leaves plain URLs unchanged", () => {
    expect(stripMarkdownFromUrls("Check https://example.com")).toBe("Check https://example.com");
  });

  it("handles mixed content", () => {
    const input = "Here is **important** info: **https://docs.example.com** for details";
    const expected = "Here is **important** info: https://docs.example.com for details";
    expect(stripMarkdownFromUrls(input)).toBe(expected);
  });
});
