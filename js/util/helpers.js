import { DEBUG } from '../config.js';

/**
 * Centralized debug logging utility.
 * Usage: debugLog('message', ...args)
 * Controlled by window.DEBUG_MODE (default: true in dev) or config DEBUG flag.
 * Logs to console if enabled.
 */
export function debugLog(...args) {
  if (
    (typeof window !== 'undefined' && (window.DEBUG_MODE === undefined || window.DEBUG_MODE)) ||
    DEBUG
  ) {
    // eslint-disable-next-line no-console
    console.log('[DEBUG]', ...args);
  }
}

/**
 * Utility functions for minimal JSON-backed CRUD app.
 * These are imported by main.js and other modules.
 */

/**
 * Get selected values from a multi-select <select> element.
 * @param {HTMLSelectElement} select
 * @returns {string[]} Array of selected option values
 */
export function getSelectedOptions(select) {
  debugLog('getSelectedOptions: called with', select);
  if (!select || !select.selectedOptions) {
    debugLog('getSelectedOptions: invalid select element', select);
    return [];
  }
  const values = Array.from(select.selectedOptions).map(opt => opt.value);
  debugLog('getSelectedOptions: returning', values);
  return values;
}

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
  debugLog('escapeHtml: called with', str);
  const escaped = String(str).replace(/[&<>"']/g, function (c) {
    switch (c) {
      case '&': return '&';
      case '<': return '<';
      case '>': return '>';
      case '"': return '"';
      case "'": return '&#39;';
      default: return c;
    }
  });
  debugLog('escapeHtml: returning', escaped);
  return escaped;
}

/**
 * Validate content length for comments/results.
 * @param {string} content
 * @param {number} maxLength
 * @returns {string|null} Error message or null if valid
 */
export function validateContentLength(content, maxLength) {
  if (typeof content !== 'string') return 'Content must be a string';
  if (!content.trim()) return 'Content cannot be empty';
  if (content.length > maxLength) return `Content too long (max ${maxLength} characters)`;
  return null;
}

/**
 * Validate author field for comments/results.
 * @param {string} author
 * @param {number} maxLength
 * @returns {string|null} Error message or null if valid
 */
export function validateAuthor(author, maxLength) {
  if (typeof author !== 'string') return 'Author must be a string';
  if (!author.trim()) return 'Author cannot be empty';
  if (author.length > maxLength) return `Author name too long (max ${maxLength} characters)`;
  return null;
}

/**
 * Minimal markdown renderer: supports **bold**, *italic*, `code`, and escapes HTML.
 * @param {string} md
 * @returns {string} HTML string
 */
export function renderMarkdownToHTML(md) {
  debugLog('renderMarkdownToHTML: called with', md);
  if (!md) {
    debugLog('renderMarkdownToHTML: empty input');
    return '';
  }
  // Properly escape &, <, > for security
  let html = escapeHtml(md);
  html = html
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^\*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^\*]+)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  debugLog('renderMarkdownToHTML: returning', html);
  return html;
}

/**
 * Generate HTML for the prompt CRUD form.
 * @param {Object} params
 * @param {string} params.mode - 'add' or 'edit'
 * @param {Object} params.prompt - prompt object
 * @param {Array} params.categories - array of category objects
 * @param {Array} params.tags - array of tag objects
 * @returns {string} HTML string for the form
 */
export function generatePromptCrudFormHTML({ mode = 'add', prompt = {}, categories = [], tags = [] } = {}) {
  debugLog("generatePromptCrudFormHTML: called with", { mode, prompt, categories, tags });
  // Accessibility: aria-labels, required, autofocus, feedback area, close button
  // Styling: field stacking, label color, input radius/padding, dropdowns, sticky submit, etc.
  const html = `
    <button type="button"
      class="close-modal"
      aria-label="Close Add/Edit Prompt Modal"
      tabindex="0"
      id="close-crud-modal-btn"
      style="position:absolute;top:16px;right:16px;width:32px;height:32px;z-index:10;"
      data-testid="close-crud-modal-btn"
    >&times;</button>
    <form id="prompt-crud-form" autocomplete="off" aria-labelledby="crud-modal-title" style="margin-top:8px;">
      <h2 id="crud-modal-title" style="margin-bottom:20px;">${mode === 'edit' ? 'Edit' : 'Add'} Prompt</h2>
      <div style="display:flex;flex-direction:column;gap:0;">
        <div class="form-group">
          <label for="prompt-title-input" style="margin-bottom:4px;font-size:0.97em;font-weight:700;color:#BBA9E9;letter-spacing:0.01em;">
            Title
          </label>
          <input
            id="prompt-title-input"
            name="title"
            type="text"
            value="${escapeHtml(prompt.title || '')}"
            required
            data-testid="prompt-title-input"
            aria-label="Prompt Title"
            style="width:100%;border-radius:10px;padding:12px;"
            autofocus
          />
        </div>
        <div class="form-group">
          <label for="prompt-content-input" style="margin-bottom:4px;font-size:0.97em;font-weight:700;color:#BBA9E9;">
            Content
          </label>
          <textarea
            id="prompt-content-input"
            name="content"
            rows="6"
            required
            data-testid="prompt-content-input"
            aria-label="Prompt Content"
            style="width:100%;border-radius:10px;padding:12px;resize:vertical;"
          >${escapeHtml(prompt.content || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="prompt-description-input" style="margin-bottom:4px;font-size:0.97em;font-weight:700;color:#BBA9E9;">
            Description
          </label>
          <textarea
            id="prompt-description-input"
            name="description"
            rows="3"
            data-testid="prompt-description-input"
            aria-label="Prompt Description"
            style="width:100%;border-radius:10px;padding:12px;resize:vertical;"
          >${escapeHtml(prompt.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label for="prompt-category-select" style="margin-bottom:4px;font-size:0.97em;font-weight:700;color:#BBA9E9;">
            Category
          </label>
          <select
            id="prompt-category-select"
            name="category"
            required
            aria-label="Prompt Category"
            style="width:100%;border-radius:10px;padding:12px;appearance:none;background:var(--color-bg);color:var(--color-text);font-size:1em;"
          >
            ${categories.length
              ? categories.map(cat => `<option value="${escapeHtml(cat.id)}"${(prompt.category === cat.id || (!prompt.category && categories[0].id === cat.id)) ? ' selected' : ''}>${escapeHtml(cat.name)}</option>`).join('')
              : '<option value="">No categories</option>'}
          </select>
        </div>
        <div class="form-group">
          <label for="prompt-tags-select" style="margin-bottom:4px;font-size:0.97em;font-weight:700;color:#BBA9E9;">
            Tags
          </label>
          <select
            id="prompt-tags-select"
            name="tags"
            multiple
            size="2"
            aria-label="Prompt Tags"
            style="width:100%;border-radius:10px;padding:12px;appearance:none;background:var(--color-bg);color:var(--color-text);font-size:1em;"
          >
            ${tags.length
              ? tags.map(tag => `<option value="${escapeHtml(tag.id)}"${(prompt.tags && prompt.tags.includes(tag.id)) ? ' selected' : ''}>${escapeHtml(tag.name)}</option>`).join('')
              : ''}
          </select>
        </div>
      </div>
      <div id="prompt-crud-feedback" aria-live="polite" style="min-height:24px;margin-bottom:8px;color:#ffb3b3;font-size:0.98em;"></div>
      <div class="sticky-submit" style="margin-top:24px;">
        <button
          type="submit"
          data-testid="save-prompt-btn"
          class="primary"
          style="width:100%;height:44px;border-radius:9999px;font-weight:600;font-size:1.13em;background:linear-gradient(90deg,#853ac7 60%,#9e59ef 100%);color:#fff;box-shadow:0 2px 8px var(--color-shadow);transition:background 0.18s;"
        >${mode === 'edit' ? 'Update' : 'Create'}</button>
        ${mode === 'edit'
          ? '<button type="button" id="delete-prompt-btn" class="danger" style="margin-left:1em;">Delete</button>'
          : ''}
      </div>
    </form>
  `;
  debugLog("generatePromptCrudFormHTML: returning HTML");
  return html;
}

/**
 * Show an error message in a toast or alert, and log for debugging.
 * @param {string} message
 */
export function showError(message) {
  debugLog('showError: called with', message);
  try {
    window.dispatchEvent(new CustomEvent('showToast', { detail: { message, type: 'error' } }));
    debugLog('showError: dispatched showToast event');
  } catch (err) {
    debugLog('showError: failed to dispatch showToast', err);
    // eslint-disable-next-line no-console
    console.error('showError: failed to dispatch showToast', err);
    alert(message);
  }
}

/**
 * Generate HTML for a single prompt block.
 * @param {Object} prompt
 * @param {Array} categories
 * @param {Array} tags
 * @returns {string}
 */