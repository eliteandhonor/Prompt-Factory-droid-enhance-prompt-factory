/**
 * sidebar.js
 * Navigation/filter sidebar for PromptShare UI.
 * Pure exports for accessibility-focused rendering and event binding.
 * All state/context/data must be passed as arguments—no global state.
 *
 * @module sidebar
 */
import * as promptsApi from '../api/prompts.js';
import { escapeHTML } from '../util/markdown.js';
import { bindListSelection } from './util/domEvents.js';

/**
 * Render sidebar navigation and filter controls for categories and tags,
 * with full ARIA landmark, filter group labels, keyboard navigation, and XSS-escaped content.
 * All user-provided category/tag strings are sanitized using escapeHTML.
 * @param {HTMLElement} container - Sidebar DOM node (#sidebar).
 * @param {Object} state - { categories: string[], tags: string[], filters: { category: string, tag: string }}
 */
export function renderSidebar(container, state = {}) {
  if (!container) return;
  const { categories = [], tags = [], filters = {} } = state;
  container.innerHTML = `
    <nav aria-label="Sidebar" id="sidebar-nav">
      <section id="category-filter" class="sidebar-block" aria-labelledby="category-filter-heading">
        <h2 id="category-filter-heading">Categories</h2>
        <ul id="category-list" role="listbox" aria-labelledby="category-filter-heading">
          ${
            categories.length
              ? categories.map(
                  cat => `
            <li>
              <button class="category-btn${filters.category === cat ? ' active' : ''}"
                      data-category="${cat}"
                      role="option"
                      aria-selected="${filters.category === cat ? 'true' : 'false'}"
                      aria-pressed="${filters.category === cat}"
                      >${escapeHTML(cat)}</button>
            </li>`
                ).join('')
              : `<li><em>No categories</em></li>`
          }
        </ul>
      </section>
      <section id="tag-filter" class="sidebar-block" aria-labelledby="tag-filter-heading">
        <h2 id="tag-filter-heading">Tags</h2>
        <ul id="tag-list" role="listbox" aria-labelledby="tag-filter-heading">
          ${
            tags.length
              ? tags.map(
                  tag => `
            <li>
              <button class="tag-btn${filters.tag === tag ? ' active' : ''}"
                      data-tag="${tag}"
                      role="option"
                      aria-selected="${filters.tag === tag ? 'true' : 'false'}"
                      aria-pressed="${filters.tag === tag}"
                      >${escapeHTML(tag)}</button>
            </li>`
                ).join('')
              : `<li><em>No tags</em></li>`
          }
        </ul>
      </section>
      <section id="my-prompts-toggle" class="sidebar-block">
        <button id="show-my-prompts">My Prompts</button>
      </section>
    </nav>
  `;
}

/**
 * Bind navigation/filter/keyboard events for sidebar.
 * Handles category/tag button clicks and arrow key navigation (a11y).
 * Applies keyboard arrow navigation via enableListboxKeyNav for each filter list.
 * @param {HTMLElement} container
 * @param {Object} state - {filters: {category?, tag?}}
 * @param {Function} onFilterUpdate - Callback when filters change.
 */
export function bindSidebar(container, state = {}, onFilterUpdate = () => {}) {
  if (!container) return;

  // Helper for arrow key navigation in a listbox
  function enableListboxKeyNav(listSel) {
    const list = container.querySelector(listSel);
    if (!list) return;
    const options = Array.from(list.querySelectorAll('[role="option"]'));
    options.forEach(btn => {
      btn.addEventListener('keydown', e => {
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          let idx = options.indexOf(document.activeElement);
          if (e.key === "ArrowDown") idx = (idx + 1) % options.length;
          else if (e.key === "ArrowUp") idx = (idx - 1 + options.length) % options.length;
          else if (e.key === "Home") idx = 0;
          else if (e.key === "End") idx = options.length - 1;
          options[idx].focus();
        }
      });
    });
  }

  // Modular event binding for category and tag buttons using bindListSelection
  bindListSelection(container.querySelector('#category-list'), 'data-category', (liOrBtn) => {
    const cat = liOrBtn.dataset ? liOrBtn.dataset.category : liOrBtn.getAttribute('data-category');
    if (cat && (!state.filters || state.filters.category !== cat)) {
      onFilterUpdate({ ...state.filters, category: cat, tag: undefined });
    }
  });
  bindListSelection(container.querySelector('#tag-list'), 'data-tag', (liOrBtn) => {
    const tag = liOrBtn.dataset ? liOrBtn.dataset.tag : liOrBtn.getAttribute('data-tag');
    if (tag && (!state.filters || state.filters.tag !== tag)) {
      onFilterUpdate({ ...state.filters, category: undefined, tag: tag });
    }
  });

  // Apply listbox arrow key navigation (a11y)
  enableListboxKeyNav('#category-list');
  enableListboxKeyNav('#tag-list');

  // My Prompts toggle
  const myBtn = container.querySelector('#show-my-prompts');
  if (myBtn) {
    myBtn.addEventListener('click', e => {
      onFilterUpdate({ ...state.filters, myPrompts: true });
    });
  }
}

/**
 * Update sidebar UI (e.g. filter/active state refresh).
 * Internally calls renderSidebar.
 * @param {HTMLElement} container
 * @param {Object} state
 */
export function updateSidebar(container, state) {
  renderSidebar(container, state);
}

/**
 * DEV/TEST ONLY: simulation for sidebar filter state (e.g. empty).
 * Not for production use.
 * @param {HTMLElement} container
 * @param {string} scenario
 */
export function devSimulateSidebarState(container, scenario) {
  if (!container) return;
  if (scenario === 'empty') {
    container.innerHTML = '<em>No categories or tags (dev simulation)</em>';
  }
}

// Helper to escape HTML in sidebar