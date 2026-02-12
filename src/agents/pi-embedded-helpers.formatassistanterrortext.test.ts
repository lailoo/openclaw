import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import {
  BILLING_ERROR_USER_MESSAGE,
  formatBillingErrorMessage,
  formatAssistantErrorText,
} from "./pi-embedded-helpers.js";

describe("formatAssistantErrorText", () => {
  const makeAssistantError = (errorMessage: string): AssistantMessage =>
    ({
      stopReason: "error",
      errorMessage,
    }) as AssistantMessage;

  it("returns a friendly message for context overflow", () => {
    const msg = makeAssistantError("request_too_large");
    expect(formatAssistantErrorText(msg)).toContain("Context overflow");
  });
  it("returns context overflow for Anthropic 'Request size exceeds model context window'", () => {
    // This is the new Anthropic error format that wasn't being detected.
    // Without the fix, this falls through to the invalidRequest regex and returns
    // "LLM request rejected: Request size exceeds model context window"
    // instead of the context overflow message, preventing auto-compaction.
    const msg = makeAssistantError(
      '{"type":"error","error":{"type":"invalid_request_error","message":"Request size exceeds model context window"}}',
    );
    expect(formatAssistantErrorText(msg)).toContain("Context overflow");
  });
  it("returns a friendly message for Anthropic role ordering", () => {
    const msg = makeAssistantError('messages: roles must alternate between "user" and "assistant"');
    expect(formatAssistantErrorText(msg)).toContain("Message ordering conflict");
  });
  it("returns a friendly message for Anthropic overload errors", () => {
    const msg = makeAssistantError(
      '{"type":"error","error":{"details":null,"type":"overloaded_error","message":"Overloaded"},"request_id":"req_123"}',
    );
    expect(formatAssistantErrorText(msg)).toBe(
      "The AI service is temporarily overloaded. Please try again in a moment.",
    );
  });
  it("returns a recovery hint when tool call input is missing", () => {
    const msg = makeAssistantError("tool_use.input: Field required");
    const result = formatAssistantErrorText(msg);
    expect(result).toContain("Session history looks corrupted");
    expect(result).toContain("/new");
  });
  it("handles JSON-wrapped role errors", () => {
    const msg = makeAssistantError('{"error":{"message":"400 Incorrect role information"}}');
    const result = formatAssistantErrorText(msg);
    expect(result).toContain("Message ordering conflict");
    expect(result).not.toContain("400");
  });
  it("suppresses raw error JSON payloads that are not otherwise classified", () => {
    const msg = makeAssistantError(
      '{"type":"error","error":{"message":"Something exploded","type":"server_error"}}',
    );
    expect(formatAssistantErrorText(msg)).toBe("LLM error server_error: Something exploded");
  });
  it("returns a billing message with provider hint for Anthropic credit errors", () => {
    const msg = makeAssistantError("Your credit balance is too low to access the Anthropic API.");
    const result = formatAssistantErrorText(msg);
    expect(result).toContain("Anthropic");
    expect(result).toContain("billing error");
  });
  it("returns a generic billing message for HTTP 402 errors without provider hint", () => {
    const msg = makeAssistantError("HTTP 402 Payment Required");
    const result = formatAssistantErrorText(msg);
    expect(result).toBe(BILLING_ERROR_USER_MESSAGE);
  });
  it("returns a generic billing message for insufficient credits without provider hint", () => {
    const msg = makeAssistantError("insufficient credits");
    const result = formatAssistantErrorText(msg);
    expect(result).toBe(BILLING_ERROR_USER_MESSAGE);
  });
});

describe("formatBillingErrorMessage", () => {
  it("includes provider name from raw error string", () => {
    const result = formatBillingErrorMessage(
      "Your credit balance is too low to access the Anthropic API.",
    );
    expect(result).toContain("Anthropic");
    expect(result).toContain("billing error");
  });
  it("includes explicit provider parameter over raw hint", () => {
    const result = formatBillingErrorMessage("some error from Anthropic", "OpenAI");
    expect(result).toContain("OpenAI");
    expect(result).not.toContain("Anthropic");
  });
  it("falls back to generic message when no provider hint", () => {
    const result = formatBillingErrorMessage("insufficient credits");
    expect(result).toBe(BILLING_ERROR_USER_MESSAGE);
  });
  it("detects OpenRouter in error string", () => {
    const result = formatBillingErrorMessage("OpenRouter: insufficient balance");
    expect(result).toContain("OpenRouter");
  });
  it("detects Google/Gemini in error string", () => {
    const result = formatBillingErrorMessage("Gemini API quota exceeded");
    expect(result).toContain("Google");
  });
});
