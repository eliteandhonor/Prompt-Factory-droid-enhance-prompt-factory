/**
 * grid.js
 * Grid/List rendering module for PromptShare UI.
 * Pure functional exports for rendering/updating/destroying prompt and result lists or cards.
 * No global state; all state/context passed via arguments.
 * 
 * @module grid
 */

import * as promptsApi from '../api/prompts.js';
import * as config from '../config.js';
import { renderPromptDetailModal } from './modals.js';
import { escapeHTML } from '../util/markdown.js';
import { renderPromptBlock } from './renderPromptBlock.js';
import { formatDate, truncateText } from '../util/helpers.js';
import { bindCardActions } from './util/domEvents.js';

/**
 * Render prompt/result grid into container with ARIA and keyboard support.
 * Each card is rendered XSS-safe (see renderPromptBlock and escapeHTML).
 * Implements ARIA grid pattern and keyboard navigation for accessibility.
 * @param {HTMLElement} container - Target container (#prompt-list).
 * @param {Array} items - Array of prompt (or result) objects.
 * @param {Object} options - { view: 'grid'|'list', pagination, selection, modalContainer }.
 */
export function renderGrid(container, items, options = {}) {
  if (!container) return;
  container.innerHTML = '';

  const { modalContainer } = options;

  // Top-level: accessibility roles, focuspath
  // Upgraded to ARIA grid pattern and keyboard navigation:
  container.setAttribute('role', 'grid');
  container.setAttribute('aria-live', 'polite');
  container.tabIndex = 0;

  if (!Array.isArray(items) || !items.length) {
    container.innerHTML = '<div class="empty-message" role="status">No prompts to display.</div>';
    return;
  }

  // Render each prompt/result card as a row with one "cell"
  items.forEach((item, idx) => {
    // Required prompt fields
    const {
      title = '(Untitled)', description = '', prompt = '', category = '', tags = [],
      author = 'anon', created_at = '', id = ''
    } = item || {};

    const row = document.createElement('div');
    row.className = 'grid-row';
    row.setAttribute('role', 'row');

    const card = document.createElement('article');
    card.className = 'prompt-card';
    card.setAttribute('role', 'gridcell');
    card.tabIndex = 0;
    card.setAttribute('aria-label', title);
    card.setAttribute('data-idx', idx);

    // Card content
    card.innerHTML = renderPromptBlock(item, { mode: 'card' });

    row.appendChild(card);
    container.appendChild(row);
  });

  // Keyboard arrow navigation for grid pattern
  const focusableCards = Array.from(container.querySelectorAll('.prompt-card'));
  focusableCards.forEach((card, idx) => {
    card.addEventListener('keydown', (e) => {
      let nextIdx = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nextIdx = (idx + 1) % focusableCards.length;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nextIdx = (idx - 1 + focusableCards.length) % focusableCards.length;
      if (e.key === 'Home') nextIdx = 0;
      if (e.key === 'End') nextIdx = focusableCards.length - 1;
      if (nextIdx !== null) {
        e.preventDefault();
        focusableCards[nextIdx].focus();
      }
    });
  });

  // Modular event handling for card actions
  bindCardActions(container, {
    card: (id, cardEl) => {
      // No-op: cards may have a show-detail button instead.
    },
    showDetail: (id, btn) => {
      const promptObj = items.find(i => i && i.id === id);
      if (promptObj && modalContainer) {
        renderPromptDetailModal(modalContainer, promptObj, {});
      }
    },
    copy: (id, btn) => {
      const promptObj = items.find(i => i && i.id === id);
      if (promptObj && promptObj.prompt) {
        navigator.clipboard.writeText(promptObj.prompt).then(() => {
          btn.setAttribute('aria-live', 'polite');
          btn.textContent = 'Copied!';
          setTimeout(() => (btn.textContent = 'Copy'), 1600);
        });
      }
    }
  });
}

/**
* Efficiently update a prompt/result card by id.
* Implementation: calls renderGrid for that item only (could optimize further to patch-in-place).
* @param {HTMLElement} container
* @param {Object} item - Prompt/result object (must have .id)
* @param {Object} options - Same as renderGrid
*/
export function updateGridItem(container, item, options = {}) {
 if (!container || !item || !item.id) return;
 const card = container.querySelector(`.prompt-card [data-id="${item.id}"]`);
 if (!card) return;
 renderGrid(container, [item], options);
}

/**
* Destroy all prompt/result cards: empties entire grid container.
* @param {HTMLElement} container
*/
export function destroyGrid(container) {
 if (!container) return;
 container.innerHTML = '';
}

/**
* DEV/TEST only: Simulate different states (error/empty/normal) for UX testing.
* Not for production use.
* @param {HTMLElement} container
* @param {string} scenario - 'error'|'empty'|'normal'
*/
export function devSimulateGridState(container, scenario) {
 if (!container) return;
 if (scenario === 'error') {
   container.innerHTML = '<div class="error-message" role="alert">Grid error: Unable to load items.</div>';
 } else if (scenario === 'empty') {
   container.innerHTML = '<div class="empty-message" role="status">No prompts available (simulation).</div>';
 } else if (scenario === 'normal') {
   container.innerHTML = '';
 }
}

// Helpers: Escape HTML, date/time, truncate text

/**
 * Internal helper: Format date as YYY Mon DD, fallback to input string if parsing fails.
 * @param {string|Date} date
 * @returns {string}
 */
/**
 * Internal helper: truncate text, adding ellipsis ("...") if exceeded.
 * @param {string} txt
 * @param {number} len
 * @returns {string}
 */