// eventHandlers.js
// [AUDITFIX] Modularize event handler logic from main.js

import { showPromptModal } from './modals.js';
import { showToast } from './toast.js';
import { getCategories } from '../state/appState.js';
import { loadCategoriesAndTags } from '../main.js'; // Will need to ensure no circular dependency

export function initEventHandlers(_formElements, promptManager, debugLog) {
  const log = debugLog || window.debugLog || (() => {});
  console.log('[initEventHandlers] function called');
  const {
    promptList,
    form,
    titleInput,
    categoryInput,
    tagsInput,
    formError
  } = _formElements;

  // Debug: Log presence of all key UI elements
  console.debug('[initEventHandlers] DOM presence:', {
    promptList: !!promptList,
    form: !!form,
    titleInput: !!titleInput,
    categoryInput: !!categoryInput,
    tagsInput: !!tagsInput,
    formError: !!formError
  });

  // Global click logger for bug reporting
  if (!window.__globalClickLoggerAttached) {
    document.addEventListener('click', (e) => {
      console.debug('[GLOBAL CLICK LOGGER] Click event:', {
        target: e.target,
        tag: e.target.tagName,
        id: e.target.id,
        class: e.target.className,
        dataTestid: e.target.getAttribute('data-testid')
      });
    }, true);
    window.__globalClickLoggerAttached = true;
  }

  // Add Prompt button opens CRUD modal
  const addPromptBtn = document.querySelector('[data-testid="add-prompt-btn"]');
  if (addPromptBtn) {
    console.debug('[initEventHandlers] Found [data-testid="add-prompt-btn"], attaching click handler');
    addPromptBtn.addEventListener('click', (e) => {
      log('[UI] Add Prompt button clicked', e);
      window.dispatchEvent(new CustomEvent('openCrudModal', { detail: { mode: 'add' } }));
    });
    console.debug('[initEventHandlers] [data-testid="add-prompt-btn"] click handler attached');
  } else {
    console.warn('[initEventHandlers] [data-testid="add-prompt-btn"] not found at handler attach time');
  }

  // Event delegation: listen on document for prompt block clicks
  document.addEventListener('click', (e) => {
    const promptBlock = e.target.closest('[data-testid="prompt-block"]');
    if (promptBlock) {
      try {
        const promptId = promptBlock.getAttribute('data-id');
        log('[UI] Prompt block clicked (delegated), id:', promptId, e);
        window.dispatchEvent(new CustomEvent('openPromptDetailModal', { detail: { promptId } }));
      } catch (err) {
        log('[UI] Error handling prompt block click (delegated):', err);
        showToast('Error opening prompt details.');
      }
    }
  });
  console.debug('[initEventHandlers] Using event delegation for prompt block clicks');

  // Event delegation for Add Category button
  document.addEventListener('click', async (e) => {
    const addCategoryBtn = e.target.closest('#add-category-btn');
    if (addCategoryBtn) {
      log('[AddCategory] (delegated) Clicked', e);
      const name = await showPromptModal('Enter new category name:');
      if (!name) return;
      try {
        await loadCategoriesAndTags();
        if (categoryInput) {
          categoryInput.value = getCategories().slice(-1)[0]?.id || '';
          log('[AddCategory] Set categoryInput.value to', categoryInput.value);
          if (titleInput) titleInput.focus();
        }
        log('[AddCategory] Current categories after add:', getCategories());
      } catch (err) {
        if (formError) formError.textContent = 'Error adding category. Please check your network connection or try again later.';
        log('[AddCategory] Error:', err);
        showToast('Error adding category.');
      }
    }
  });
  console.debug('[initEventHandlers] Using event delegation for #add-category-btn');
}