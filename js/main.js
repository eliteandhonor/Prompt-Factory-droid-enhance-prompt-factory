console.log('[DIAG][main.js] TOP OF FILE - If you see this, main.js is loading');
window.addEventListener('load', () => { import('./ui/progress.js').then(m => m.hideLoading && m.hideLoading()).catch(() => {}); });
window.addEventListener('error', () => { import('./ui/progress.js').then(m => m.hideLoading && m.hideLoading()).catch(() => {}); });
console.log('[main.js] TOP OF FILE');

// DEBUG: Ensure prompt-list-section is visible on app load
document.addEventListener('DOMContentLoaded', () => {
  const promptListSection = document.getElementById('prompt-list-section');
  if (promptListSection) {
    promptListSection.classList.remove('d-none');
    console.log('[main.js] Removed d-none from #prompt-list-section to show main UI');
  } else {
    console.warn('[main.js] #prompt-list-section not found');
  }
});
/**
 * Main app logic for minimal JSON-backed CRUD/tagging app.
 * Handles prompt CRUD, category/tag management, and UI rendering.
 * All user input is escaped, and utility functions are modularized.
 */
import { getSelectedOptions, escapeHtml, renderMarkdownToHTML } from './util/helpers.js';
import { renderCommentsResults } from './ui/commentsResults.js';
import { showPromptModal } from './ui/modals.js';
import { initTagCategoryManager } from './ui/tagCategoryManager.js';
import { initPromptManager } from './ui/promptManager.js';
import { showToast } from './ui/toast.js';
import * as appState from './state/appState.js';
import { getTags, getCategories } from './state/appState.js';

import { setCategories, setTags } from './state/appState.js';
import { fetchCategories, fetchTags, addCategory, addTag } from './util/categoryTagApi.js'; // [AUDITFIX] Modularized category/tag CRUD
/**
 * Wait for DOM to be ready before initializing app logic.
 */
import { initEventHandlers } from './ui/eventHandlers.js'; // [AUDITFIX] Modularized event handler logic
import { setFormElements, getFormElements } from './ui/formElements.js'; // [AUDITFIX] Encapsulate form elements
import { showLoading, hideLoading } from './ui/progress.js'; // [AUDITFIX] Loading indicator
import { debugLog, logError, logCriticalError } from './util/debugLogger.js'; // [AUDITFIX] Unified debug logger
import { attachPromptListControlListeners } from './ui/promptListControls.js';
/**
 * Modularized app initialization for maintainability, scalability, and robust debugging.
 */
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Only prompt list/grid is the main interface
    setupPromptList();
    setupFormElements();

    // Attach grid/list view toggle controls
    attachPromptListControlListeners(debugLog);

    // Defer event handler attachment to after next tick to ensure DOM is ready
    setTimeout(() => {
      console.debug('[main.js] Attaching event handlers after UI render');
      initEventHandlers(promptManager, debugLog); // [AUDITFIX] Modularized event handler logic, now uses getFormElements internally
    }, 0);

    setupSearch();
    window.__mainJsLoaded = true;
    window.app = { promptManager, appState };
    debugLog('[App] DOMContentLoaded complete, app initialized.');
  } catch (err) {
    logCriticalError('[App] Fatal error during initialization', err && err.stack ? err.stack : String(err));
    showToast('App failed to initialize. See console for details.');
  }
});



function setupPromptList() {
  import('./ui/promptList.js').then(mod => {
    if (typeof mod.initPromptList === 'function') {
      debugLog('[PromptList] Initializing prompt list');
      mod.initPromptList();
    }
  });
}

let promptManager;
let PAGE_SIZE = 20; // Configurable for scalability

function setupFormElements() {
  // All form and filter elements
  const elements = {
    promptList: document.getElementById('prompt-list'),
    form: document.getElementById('add-prompt-form'),
    titleInput: document.getElementById('prompt-title'),
    contentInput: document.getElementById('prompt-content'),
    addPreview: document.getElementById('add-preview'),
    categoryInput: document.getElementById('prompt-category'),
    tagsInput: document.getElementById('prompt-tags'),
    formError: document.getElementById('form-error'),
    loadMoreBtn: document.getElementById('load-more-btn'),
    filterCategory: document.getElementById('filter-category'),
    filterTag: document.getElementById('filter-tag'),
    clearFiltersBtn: document.getElementById('clear-filters-btn')
  };

  // Add ARIA labels to form elements if missing
  if (elements.form) {
    elements.form.setAttribute('aria-label', 'Add Prompt Form');
    elements.form.setAttribute('role', 'form');
  }
  if (elements.titleInput) elements.titleInput.setAttribute('aria-label', 'Prompt Title');
  if (elements.contentInput) elements.contentInput.setAttribute('aria-label', 'Prompt Content');
  if (elements.categoryInput) elements.categoryInput.setAttribute('aria-label', 'Prompt Category');
  if (elements.tagsInput) elements.tagsInput.setAttribute('aria-label', 'Prompt Tags');
  if (elements.loadMoreBtn) elements.loadMoreBtn.setAttribute('aria-label', 'Load More Prompts');
  if (elements.filterCategory) elements.filterCategory.setAttribute('aria-label', 'Filter by Category');
  if (elements.filterTag) elements.filterTag.setAttribute('aria-label', 'Filter by Tag');
  if (elements.clearFiltersBtn) elements.clearFiltersBtn.setAttribute('aria-label', 'Clear Filters');

  setFormElements(elements);

  promptManager = initPromptManager({
    promptList: elements.promptList,
    loadMoreBtn: elements.loadMoreBtn,
    filterCategory: elements.filterCategory,
    filterTag: elements.filterTag,
    clearFiltersBtn: elements.clearFiltersBtn,
    PAGE_SIZE,
    showToast
  });

  // Make promptManager globally available and signal readiness
  window.promptManager = promptManager;
  window.dispatchEvent(new Event('promptManagerReady'));

  // Initial load of categories/tags and prompts
  loadCategoriesAndTags();

  // Initialize tag/category management module
  initTagCategoryManager({
    loadCategoriesAndTags,
    showToast
  });

  // Initialize prompt manager and fetch prompts
  promptManager.fetchPrompts();

}


function setupSearch() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.setAttribute('aria-label', 'Search prompts');
    searchInput.addEventListener('input', () => {
      debugLog('[Search] Input changed:', searchInput.value);
      promptManager.setSearchQuery(searchInput.value.trim());
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        debugLog('[Search] Enter pressed:', searchInput.value);
        promptManager.setSearchQuery(searchInput.value.trim());
      }
    });
  }
}

/**
 * Load categories and tags from backend, then update UI.
 */
async function loadCategoriesAndTags() {
  const { categoryInput, tagsInput, filterCategory, filterTag, form, formError } = getFormElements();
  showLoading('Loading categories and tags...');
  try {
    debugLog('[loadCategoriesAndTags] Fetching categories and tags via categoryTagApi...');
    const [newCategories, newTags] = await Promise.all([
      fetchCategories(),
      fetchTags()
    ]);
    debugLog('[loadCategoriesAndTags] Parsed categories:', newCategories);
    debugLog('[loadCategoriesAndTags] Parsed tags:', newTags);
    setCategories(newCategories);
    console.log('[DIAG][main.js] setCategories called with:', newCategories);
    setTags(newTags);
    console.log('[DIAG][main.js] setTags called with:', newTags);

    populateCategories();
    populateTags();

    // Add Category from edit form
    const editAddCategoryBtn = document.getElementById('edit-add-category-btn');
    if (editAddCategoryBtn) {
      editAddCategoryBtn.onclick = async () => {
        const name = await showPromptModal('Enter new category name:');
        if (!name) return;
        showLoading('Adding category...');
        try {
          await addCategory(name);
          await loadCategoriesAndTags();
        } catch (err) {
          if (formError) formError.textContent = 'Error adding category. Please check your network connection or try again later.';
          debugLog('[EditAddCategory] Error:', err);
          showToast('Error adding category.');
          logError('Error adding category', err && err.stack ? err.stack : String(err));
        } finally {
          hideLoading();
        }
      };
    }

    // Add Tag logic
    const addTagBtn = document.getElementById('add-tag-btn');
    if (addTagBtn) {
      addTagBtn.onclick = async () => {
        const input = await showPromptModal('Enter new tag name(s), separated by commas:');
        if (!input) return;
        const tagNames = input.split(',').map(t => t.trim()).filter(Boolean);
        let anyInvalid = false;
        for (const tagName of tagNames) {
          if (!tagName || tagName.includes(',')) {
            anyInvalid = true;
            continue;
          }
          showLoading('Adding tag...');
          try {
            const tag = await addTag(tagName);
            await loadCategoriesAndTags();
            if (tagsInput) {
              Array.from(tagsInput.options).forEach(opt => {
                if (opt.value === tag.id) opt.selected = true;
              });
              tagsInput.focus();
            }
          } catch (err) {
            if (formError) formError.textContent = 'Error adding tag. Please check your network connection or try again later.';
            debugLog('[AddTag] Error:', err);
            showToast('Error adding tag.');
            logError('Error adding tag', err && err.stack ? err.stack : String(err));
          } finally {
            hideLoading();
          }
        }
        if (anyInvalid) showToast('Invalid tag(s) skipped (no commas allowed, no empty tags)');
      };
    }

    // Add Tag from edit form
    const editAddTagBtn = document.getElementById('edit-add-tag-btn');
    if (editAddTagBtn) {
      editAddTagBtn.onclick = async () => {
        const input = await showPromptModal('Enter new tag name(s), separated by commas:');
        if (!input) return;
        const tagNames = input.split(',').map(t => t.trim()).filter(Boolean);
        let anyInvalid = false;
        for (const tagName of tagNames) {
          if (!tagName || tagName.includes(',')) {
            anyInvalid = true;
            continue;
          }
          showLoading('Adding tag...');
          try {
            await addTag(tagName);
            await loadCategoriesAndTags();
          } catch (err) {
            if (formError) formError.textContent = 'Error adding tag. Please check your network connection or try again later.';
            debugLog('[EditAddTag] Error:', err);
            showToast('Error adding tag.');
            logError('Error adding tag (edit form)', err && err.stack ? err.stack : String(err));
          } finally {
            hideLoading();
          }
        }
        if (anyInvalid) showToast('Invalid tag(s) skipped (no commas allowed, no empty tags)');
      };
    }
  } catch (err) {
    debugLog('[loadCategoriesAndTags] Error:', err);
    let msg = '';
    if (err instanceof SyntaxError) {
      msg = 'Invalid JSON in categories.json or tags.json';
    } else if (err && err.message) {
      msg = 'Error loading categories/tags: ' + err.message;
    } else {
      msg = 'Unknown error loading categories/tags: ' + JSON.stringify(err);
    }
    showToast(msg);
    logError('Error loading categories/tags', err && err.stack ? err.stack : String(err));
  } finally {
    hideLoading();
  }
}

function populateCategories() {
  const { categoryInput, filterCategory, form, formError } = getFormElements();
  const categories = getCategories();
  if (categoryInput) {
    categoryInput.innerHTML = categories.map(
      c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`
    ).join('');
  }
  if (filterCategory) {
    filterCategory.innerHTML = `<option value="">All</option>` +
      categories.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    filterCategory.value = '';
  }
  if (categoryInput && categories.length === 0) {
    categoryInput.disabled = true;
    form.querySelector('button[type="submit"]').disabled = true;
    formError.textContent = 'Please add a category before creating prompts.';
  } else if (categoryInput) {
    categoryInput.disabled = false;
    form.querySelector('button[type="submit"]').disabled = false;
    formError.textContent = '';
  }
}

function populateTags() {
  const { tagsInput, filterTag } = getFormElements();
  const tags = getTags();
  if (tagsInput) {
    tagsInput.innerHTML = tags
      .filter(t => !t.name.includes(','))
      .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
      .join('');
    if (tags.length === 0) {
      tagsInput.disabled = true;
      const tagCta = document.getElementById('add-tag-btn');
      if (tagCta) tagCta.textContent = '+ Add First Tag';
    } else {
      tagsInput.disabled = false;
      const tagCta = document.getElementById('add-tag-btn');
      if (tagCta) tagCta.textContent = '+ Add Tag';
    }
  }
  if (filterTag) {
    const tagNames = Array.from(new Set(tags.map(t => t.name)));
    filterTag.innerHTML = `<option value="">All</option>` +
      tagNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    filterTag.value = '';
  }
}
export { loadCategoriesAndTags };

// [DIAG] Confirm state after category edit
window.addEventListener('categoriesUpdated', () => {
  console.log('[DIAG][main.js] categoriesUpdated event received. Current categories:', getCategories());
});
// Global prompt delete function for inline delete UI
window.deletePrompt = async function(promptId) {
  if (!promptId) throw new Error('No promptId provided to deletePrompt');
  console.debug('[deletePrompt] Called with id:', promptId);

  try {
    const response = await fetch('/api/prompts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: promptId, action: 'delete' })
    });
    const data = await response.json();
    console.debug('[deletePrompt] Response:', data);

    if (!data.ok) {
      throw new Error(data.error || 'Delete failed');
    }
    return data;
  } catch (err) {
    console.error('[deletePrompt] Error:', err);
    throw err;
  }
};
