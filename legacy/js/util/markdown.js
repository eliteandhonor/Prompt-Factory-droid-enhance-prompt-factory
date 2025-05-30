/**
 * @file markdown.js
 * Production-grade ES6 module for Markdown-to-HTML rendering with strict XSS prevention,
 * accessibility (ARIA, role) helpers, and hooks for dev/test simulation.
 * No global state. All exports are pure named functions, fully documented.
 */

/**
 * Escape HTML special characters in a string to prevent HTML injection/XSS.
 * @param {string} unsafe - The string to escape.
 * @returns {string} The escaped string.
 */
/**
 * Robustly escape HTML special chars for preventing XSS.
 * Converts &, <, >, ", ' to safe entities for use in HTML contexts.
 * @param {string} unsafe
 * @returns {string}
 */
export function escapeHTML(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Strictly sanitize HTML by removing disallowed tags/attributes and enforcing ARIA/role attributes for accessibility.
 * Only whitelisted tags and attributes are allowed (edit allowedTags/allowedAttrs below for extension).
 * NOTE: If expanding allowedAttrs, review for XSS and accessibility.
 * @param {string} html - The HTML string to sanitize.
 * @returns {string} The sanitized HTML string with a11y helpers added.
 */
export function sanitizeHTML(html) {
  // Allowed tags (uppercase for compare)
  const allowedTagsSet = new Set([
    "B", "STRONG", "I", "EM", "U", "STRIKE", "S", "MARK", "CODE", "PRE", "KBD", "BLOCKQUOTE", "A", "P",
    "UL", "OL", "LI", "BR", "HR", "H1", "H2", "H3", "H4", "H5", "H6", "TABLE", "THEAD", "TBODY", "TR", "TD", "TH",
    "SPAN"
  ]);

  // Allowed attributes per tag (all lowercase)
  const allowedAttrs = {
    "a": ["href", "title", "rel", "target", "aria-label", "role"],
    "span": ["class", "style", "aria-label", "role"],
    "code": ["class", "aria-label", "role"],
    "pre": ["class", "aria-label", "role"]
  };

  const doc = new window.DOMParser().parseFromString(html, "text/html");

  (function clean(node) {
    if (!node) return;
    if (node.nodeType === 1) {
      const tag = node.tagName.toUpperCase();
      // Remove disallowed tags but retain child content
      if (!allowedTagsSet.has(tag)) {
        const parent = node.parentNode;
        if (parent) {
          while (node.firstChild) parent.insertBefore(node.firstChild, node);
          parent.removeChild(node);
        } else {
          node.remove();
        }
        return;
      }
      // Remove all disallowed and dangerous attributes.
      const tagLower = tag.toLowerCase();
      const allowedAttributeSet = new Set(allowedAttrs[tagLower] || []);
      Array.from(node.attributes).forEach(attr => {
        const name = attr.name;
        // Remove any attribute not in the allowed set or any on* event handler.
        if (!allowedAttributeSet.has(name) || /^on/i.test(name)) {
          node.removeAttribute(name);
        }
      });
      addAriaHelpers(node);
    }
    // Clean child nodes recursively
    Array.from(node.childNodes || []).forEach(clean);
  })(doc.body);

  return doc.body ? doc.body.innerHTML : "";
}

/**
 * Add essential ARIA roles/attributes for semantic HTML and accessibility, in-place.
 * Only called from sanitizeHTML.
 * - `code`, `pre` → role="region" aria-label="Code block"
 * - headings → role="heading" and correct aria-level (H1=1...H6=6)
 * If you add more tags, document their mapping here.
 * @param {Element} node - DOM element
 */
export function addAriaHelpers(node) {
  if (typeof node !== "object" || !node.tagName) return;
  const tag = node.tagName.toLowerCase();
  switch (tag) {
    case "pre":
    case "code":
      node.setAttribute("role", "region");
      if (!node.hasAttribute("aria-label")) node.setAttribute("aria-label", "Code block");
      break;
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      node.setAttribute("role", "heading");
      let level = tag[1];
      node.setAttribute("aria-level", level);
      break;
    // To extend: add new semantic block mappings here.
  }
}

/**
 * Pure Markdown-to-HTML conversion with built-in fallback parser (no global/window access),
 * strictly XSS-protected and a11y-aware. Optionally allows user to inject their own parser for extensibility.
 * @param {string} mdText - Raw markdown text.
 * @param {object} [options]
 * @param {boolean} [options.allowRawHtml=false] - If true, disables sanitizer (unsafe!).
 * @param {function} [options.markdownParser] - Optional pure parser function to override default.
 * @param {boolean} [options.simulateFailure] - If true, simulates parsing error.
 * @param {boolean} [options.rawOutput] - If true, disables parsing/sanitization and outputs escaped raw markdown.
 * @returns {string} Rendered HTML output suitable for innerHTML assignment.
 */
export function renderMarkdownToHTML(mdText, options = {}) {
  if (options.simulateFailure) {
    throw new Error("Simulated markdown parse failure for dev/test purposes.");
  }
  if (typeof mdText !== "string" || mdText.length === 0) return "";
  if (options.rawOutput) {
    return `<pre class="raw-markdown">${escapeHTML(mdText)}</pre>`;
  }

  let parser = options.markdownParser || minimalMarkdownParse;
  let rawHtml;
  try {
    rawHtml = parser(mdText);
    // If parser returns null or undefined or non-string, treat as empty for safety/test compliance
    if (typeof rawHtml !== "string") rawHtml = "";
  } catch (err) {
    rawHtml = escapeHTML(mdText);
  }
  // Optionally skip sanitizer (NEVER do this unless trusted context!)
  const html = options.allowRawHtml ? rawHtml : sanitizeHTML(rawHtml);
  return typeof html === "string" ? html : "";
}

/**
 * Fallback minimal markdown to HTML conversion (pure function, zero dependencies).
 * Supports: backtick code, bold, italic, line breaks.
 * Does NOT support raw HTML or advanced markdown.
 * @param {string} input
 * @returns {string} HTML string
 */
export function minimalMarkdownParse(input) {
  if (typeof input !== "string" || input.length === 0) return "";
  // First escape all HTML
  let html = escapeHTML(input);

  // Now, apply markdown:
  // 1. `code` (no bold/italic inside)
  html = html.replace(/`([^`]+?)`/g, function(_, code) {
    return `<code>${code}</code>`;
  });

  // 2. **bold** (no * inside)
  html = html.replace(/\*\*([^\*]+?)\*\*/g, function(_, bold) {
    return `<strong>${bold}</strong>`;
  });

  // 3. *italic*
  // Match exactly *...* NOT **
  html = html.replace(/(^|[^\*])\*([^\*\n]+?)\*(?!\*)/g, function(_, pre, italic) {
    return pre + `<em>${italic}</em>`;
  });

  // 4. Line breaks
  html = html.replace(/\n/g, "<br>");

  return html;
}

/**
 * DEV/TEST ONLY: Simulate a markdown parser failure.
 * Always throws an Error—used for testing error boundaries.
 * Never use in production logic.
 * @throws {Error}
 */
export function simulateMarkdownFailure() {
  throw new Error("Simulated markdown failure");
}

/**
 * DEV/TEST helper for raw-view toggle: returns raw, escaped HTML.
 * Use for preview/testing only—not for end-user production view.
 * @param {string} mdText
 * @returns {string} Raw escaped HTML in a <pre> tag.
 */
export function toggleRawOutput(mdText) {
  return `<pre class="raw-markdown">${escapeHTML(String(mdText))}</pre>`;
}

/**
 * Usage example:
 *   import {
 *     renderMarkdownToHTML,
 *     escapeHTML,
 *     sanitizeHTML,
 *     addAriaHelpers,
 *     minimalMarkdownParse,
 *     simulateMarkdownFailure,
 *     toggleRawOutput
 *   } from './markdown.js';
 * 
 *   el.innerHTML = renderMarkdownToHTML(markdownText);
 */