/**
 * Strip markdown bold/italic markers that immediately surround URLs.
 *
 * When the LLM wraps a URL in markdown formatting like `**https://example.com**`,
 * WhatsApp includes the `**` characters in the tappable URL, breaking the link.
 *
 * This function removes bold/italic markers (`**`, `*`, `__`, `_`) that
 * immediately surround a URL pattern (http:// or https://).
 *
 * @example
 * stripMarkdownFromUrls("Check **https://example.com**") // "Check https://example.com"
 * stripMarkdownFromUrls("Visit *https://foo.bar/path*") // "Visit https://foo.bar/path"
 */
export function stripMarkdownFromUrls(text: string): string {
  // Match markdown markers immediately surrounding a URL
  // Patterns: **url**, *url*, __url__, _url_

  // Bold: **url**
  let result = text.replace(/\*\*(https?:\/\/[^\s*_)]+)\*\*/g, "$1");

  // Bold: __url__
  result = result.replace(/__(https?:\/\/[^\s*_)]+)__/g, "$1");

  // Italic: *url* (but not **)
  result = result.replace(/(?<!\*)\*(https?:\/\/[^\s*_)]+)\*(?!\*)/g, "$1");

  // Italic: _url_ (but not __)
  result = result.replace(/(?<!_)_(https?:\/\/[^\s*_)]+)_(?!_)/g, "$1");

  return result;
}
