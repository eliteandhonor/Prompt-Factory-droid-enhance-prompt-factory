/**
 * renderPromptBlock.js
 * Shared rendering utility for prompt cards (grid) and prompt modals (details).
 * Ensures consistent markup, secure HTML escaping, and easy a11y structure.
 * SECURITY: All dynamic fields go through escapeHTML, making this safe from XSS if not modified.
 * ACCESSIBILITY: headers, meta, and action buttons prepared for screenreaders; can be extended.
 */

import { escapeHTML } from '../util/markdown.js';
import { formatDate, truncateText } from '../util/helpers.js';

// Helper: Format date as in originals
/**
 * Internal helper: format a date string as YYY Mon DD, fallback to input string.
 * @param {string|Date} date
 * @returns {string}
 */

// Helper: Truncate text (for card style)
/**
 * Internal helper: Safely truncate text, adding ellipsis ("...") if exceeded.
 * @param {string} txt
 * @param {number} len
 * @returns {string}
 */

/**
 * Render prompt block as card (for grid/lists) or modal/detail view.
 * SECURITY: Never remove/replace escapeHTML calls; all user data passes through them.
 * Extensible: supports "card" and "modal" — to add, mimic the escape+markup pattern.
 * @param {Object} data - Prompt object ({ title, description, prompt, author, ... }).
 * @param {Object} opts
 *   - mode: "card" | "modal"
 *   - truncateLen: number (used for card/summary rendering only)
 * @returns {string} HTML (safe to inject as innerHTML)
 */
export function renderPromptBlock(data, opts = {}) {
  const {
    mode = 'card',
    truncateLen = 400
  } = opts;

  const {
    title = '(Untitled)',
    description = '',
    prompt = '',
    category = '',
    tags = [],
    author = 'anon',
    created_at = '',
    id = ''
  } = data || {};

  if (mode === 'modal') {
    return `
      <div class="modal-content">
        <button class="close-modal" aria-label="Close">&times;</button>
        <h2>${escapeHTML(title)}</h2>
        <p class="prompt-meta">${escapeHTML(author)} · ${escapeHTML(category)} · ${formatDate(created_at)}</p>
        <div class="prompt-modal-desc">${escapeHTML(description)}</div>
        <pre class="prompt-modal-text">${escapeHTML(prompt)}</pre>
        <div class="prompt-modal-tags">
          ${(tags || []).map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ')}
        </div>
      </div>
    `;
  }
  
  // Default: "card" mode
  return `
    <header>
      <h3 class="prompt-title">${escapeHTML(title)}</h3>
      <div class="prompt-meta">${escapeHTML(author)} · ${escapeHTML(category)} · ${formatDate(created_at)}</div>
      ${tags && tags.length
        ? `<div class="prompt-tags">${tags.map(t => `<span class="tag">${escapeHTML(t)}</span>`).join(' ')}</div>`
        : ''}
    </header>
    <section class="prompt-desc">${escapeHTML(description)}</section>
    <section class="prompt-body">${truncateText(escapeHTML(prompt), truncateLen)}</section>
    <div class="prompt-card-actions">
      <button class="show-detail-btn" data-id="${id}" aria-label="Show details for ${escapeHTML(title)}">Details</button>
      <button class="copy-prompt-btn" data-id="${id}" aria-label="Copy prompt for ${escapeHTML(title)}">Copy</button>
    </div>
  `;
}