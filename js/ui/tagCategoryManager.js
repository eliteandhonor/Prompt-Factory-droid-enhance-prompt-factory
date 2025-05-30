/**
/**
 * Tag and Category Management Module
 * Handles tag/category CRUD, management modals, and UI rendering.
 * Extracted from main.js for modularity and maintainability.
 * 
 * [AUDIT] Debug logging, error handling, accessibility, and maintainability improved.
 */
import { escapeHtml } from '../util/helpers.js';
import { getTags, getCategories, subscribe } from '../state/appState.js';
import { showConfirmModal, openIsolatedModal, closeIsolatedModal } from './modals.js';
import { trackEvent } from '../util/analytics.js'; // [AUDITFIX] Analytics/event tracking

/**
 * Helper: Log debug messages with context.
 */
function debugLog(context, ...args) {
  // eslint-disable-next-line no-console
  console.debug(`[TagCategoryManager] ${context}:`, ...args);
}

/**
 * Helper: Validate name input for tags/categories.
 */
function validateNameInput(name, type, showToast) {
  if (!name) {
    showToast(`${type} name cannot be empty`);
    return false;
  }
  if (name.length > 32) {
    showToast(`${type} name too long`);
    return false;
  }
  if (name.includes(',')) {
    showToast(`No commas allowed in ${type.toLowerCase()} names`);
    return false;
  }
  return true;
}

/**
 * Helper: Set ARIA attributes and focus for modals.
 */
function enhanceModalAccessibility(modal, labelId) {
  if (modal) {
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (labelId) modal.setAttribute('aria-labelledby', labelId);
  }
}

export function initTagCategoryManager({
  loadCategoriesAndTags,
  showToast
}) {
  debugLog('initTagCategoryManager', 'Initializing Tag/Category Manager');

  // Tag Management Elements
  const manageTagsBtn = document.getElementById('manage-tags-btn');
  const tagManagementModal = document.getElementById('tag-management-modal');
  const tagManagementContent = document.getElementById('tag-management-content');
  const closeTagManagementModal = document.getElementById('close-tag-management-modal');

  // Category Management Elements
  const manageCategoriesBtn = document.getElementById('manage-categories-btn');
  const categoryManagementModal = document.getElementById('category-management-modal');
  const categoryManagementContent = document.getElementById('category-management-content');
  const closeCategoryManagementModal = document.getElementById('close-category-management-modal');

  // Enhance accessibility for modals
  enhanceModalAccessibility(tagManagementModal, 'tag-management-title');
  enhanceModalAccessibility(categoryManagementModal, 'category-management-title');

  // --- Tag Management UI ---
  function renderTagManagement() {
    debugLog('renderTagManagement', 'START: Rendering tag management UI');
    const tags = getTags();
    tagManagementContent.innerHTML = `
      <form id="add-tag-form" class="management-form-row" aria-label="Add tag form">
        <input id="add-tag-input" type="text" maxlength="32" placeholder="New tag name" aria-label="New tag name" style="flex:1;padding:0.3em 0.5em;" autocomplete="off" />
        <button type="submit" class="primary" id="add-tag-btn">Add Tag</button>
      </form>
      ${tags.map(tag => `
        <div class="management-item-row">
          <input type="text" value="${escapeHtml(tag.name)}" data-id="${tag.id}" style="flex:1;padding:0.3em 0.5em;" maxlength="32" aria-label="Edit tag name" />
          <button class="save-tag-btn primary" data-id="${tag.id}" aria-label="Save tag">Save</button>
          <button class="delete-tag-btn danger" data-id="${tag.id}" aria-label="Delete tag">Delete</button>
        </div>
      `).join('')}
    `;
    debugLog('renderTagManagement', 'END: Tag management UI rendered, form should be present');

    // Add Tag handler
    const addTagForm = tagManagementContent.querySelector('#add-tag-form');
    const addTagInput = tagManagementContent.querySelector('#add-tag-input');
    addTagForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = addTagInput.value.trim();
      debugLog('AddTag', 'Attempting to add tag', newName);
      if (!validateNameInput(newName, 'Tag', showToast)) return;
      addTagInput.disabled = true;
      try {
        const res = await fetch('/api/tags.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        const data = await res.json();
        debugLog('AddTag', 'API response', data);
        if (data.ok) {
          showToast('Tag added');
          trackEvent('tag_add', { name: newName });
          addTagInput.value = '';
          await loadCategoriesAndTags();
          renderTagManagement();
          window.dispatchEvent(new CustomEvent('tagsUpdated'));
        } else {
          showToast('Failed to add tag: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        showToast('Error adding tag');
        console.error('[TagCategoryManager] AddTag error:', err);
      }
      addTagInput.disabled = false;
    };

    // Save handlers
    tagManagementContent.querySelectorAll('.save-tag-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const input = tagManagementContent.querySelector(`input[data-id="${id}"]`);
        const newName = input.value.trim();
        debugLog('SaveTag', `Attempting to save tag id=${id}`, newName);
        if (!validateNameInput(newName, 'Tag', showToast)) return;
        btn.disabled = true;
        try {
          const res = await fetch(`/api/tags.php?id=${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
          });
          const data = await res.json();
          debugLog('SaveTag', 'API response', data);
          if (data.ok) {
            showToast('Tag renamed');
            trackEvent('tag_edit', { id, newName });
            await loadCategoriesAndTags();
            renderTagManagement();
            window.dispatchEvent(new CustomEvent('tagsUpdated'));
          } else {
            showToast('Failed to rename tag: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          showToast('Error renaming tag');
          console.error('[TagCategoryManager] SaveTag error:', err);
        }
        btn.disabled = false;
      };
    });

    // Delete handlers
    tagManagementContent.querySelectorAll('.delete-tag-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        debugLog('DeleteTag', `Attempting to delete tag id=${id}`);
        if (!(await showConfirmModal('Delete this tag? It will be removed from all prompts.'))) {
          debugLog('DeleteTag', 'User cancelled deletion');
          return;
        }
        btn.disabled = true;
        // Find the tag data before deletion for undo
        const tags = getTags();
        const deletedTag = tags.find(t => String(t.id) === String(id));
        let undoTimeout;
        try {
          const res = await fetch(`/api/tags.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          const data = await res.json();
          debugLog('DeleteTag', 'API response', data);
          if (data.ok) {
            // Show undo toast
            let undoClicked = false;
            trackEvent('tag_delete', { id, name: deletedTag?.name });
            showToast('Tag deleted. <button id="undo-delete-tag-btn" style="margin-left:1em;">Undo</button>', 5000);
            setTimeout(() => {
              if (!undoClicked) {
                // Finalize deletion after timeout
                window._lastDeletedTag = null;
              }
            }, 5000);
            window._lastDeletedTag = deletedTag;
            // Attach undo handler
            setTimeout(() => {
              const undoBtn = document.getElementById('undo-delete-tag-btn');
              if (undoBtn) {
                undoBtn.onclick = async () => {
                  undoClicked = true;
                  if (window._lastDeletedTag) {
                    // Restore tag
                    await fetch('/api/tags.php', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: window._lastDeletedTag.name })
                    });
                    showToast('Tag restored');
                    trackEvent('tag_undo_delete', { id, name: window._lastDeletedTag.name });
                    await loadCategoriesAndTags();
                    renderTagManagement();
                    window.dispatchEvent(new CustomEvent('tagsUpdated'));
                    window._lastDeletedTag = null;
                  }
                };
              }
            }, 100); // Wait for toast to render
            await loadCategoriesAndTags();
            renderTagManagement();
            window.dispatchEvent(new CustomEvent('tagsUpdated'));
          } else {
            showToast('Failed to delete tag: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          showToast('Error deleting tag');
          console.error('[TagCategoryManager] DeleteTag error:', err);
        }
        btn.disabled = false;
      };
    });
    debugLog('renderTagManagement', 'Tag management UI rendered');
  }

  // --- Category Management UI ---
  function renderCategoryManagement() {
    debugLog('renderCategoryManagement', 'START: Rendering category management UI');
    const categories = getCategories();
    categoryManagementContent.innerHTML = `
      <form id="add-category-form" class="management-form-row" aria-label="Add category form">
        <input id="add-category-input" type="text" maxlength="32" placeholder="New category name" aria-label="New category name" style="flex:1;padding:0.3em 0.5em;" autocomplete="off" />
        <button type="submit" class="primary" id="add-category-btn">Add Category</button>
      </form>
      ${categories.map(cat => `
        <div class="management-item-row">
          <input type="text" value="${escapeHtml(cat.name)}" data-id="${cat.id}" style="flex:1;padding:0.3em 0.5em;" maxlength="32" aria-label="Edit category name" />
          <button class="save-category-btn primary" data-id="${cat.id}" aria-label="Save category">Save</button>
          <button class="delete-category-btn danger" data-id="${cat.id}" aria-label="Delete category">Delete</button>
        </div>
      `).join('')}
    `;
    debugLog('renderCategoryManagement', 'END: Category management UI rendered, form should be present');

    // Add Category handler
    const addCategoryForm = categoryManagementContent.querySelector('#add-category-form');
    const addCategoryInput = categoryManagementContent.querySelector('#add-category-input');
    addCategoryForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = addCategoryInput.value.trim();
      debugLog('AddCategory', 'Attempting to add category', newName);
      if (!validateNameInput(newName, 'Category', showToast)) return;
      addCategoryInput.disabled = true;
      try {
        const res = await fetch('/api/categories.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        const data = await res.json();
        debugLog('AddCategory', 'API response', data);
        if (data.ok) {
          showToast('Category added');
          trackEvent('category_add', { name: newName });
          addCategoryInput.value = '';
          await loadCategoriesAndTags();
          renderCategoryManagement();
          window.dispatchEvent(new CustomEvent('categoriesUpdated'));
        } else {
          showToast('Failed to add category: ' + (data.error || 'Unknown error'));
        }
      } catch (err) {
        showToast('Error adding category');
        console.error('[TagCategoryManager] AddCategory error:', err);
      }
      addCategoryInput.disabled = false;
    };

    // Save handlers
    categoryManagementContent.querySelectorAll('.save-category-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        const input = categoryManagementContent.querySelector(`input[data-id="${id}"]`);
        const newName = input.value.trim();
        debugLog('SaveCategory', `Attempting to save category id=${id}`, newName);
        if (!validateNameInput(newName, 'Category', showToast)) return;
        btn.disabled = true;
        try {
          const res = await fetch(`/api/categories.php?id=${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName })
          });
          const data = await res.json();
          debugLog('SaveCategory', 'API response', data);
          if (data.ok) {
            showToast('Category renamed');
            trackEvent('category_edit', { id, newName });
            await loadCategoriesAndTags();
            renderCategoryManagement();
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          } else {
            showToast('Failed to rename category: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          showToast('Error renaming category');
          console.error('[TagCategoryManager] SaveCategory error:', err);
        }
        btn.disabled = false;
      };
    });

    // Delete handlers
    categoryManagementContent.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.getAttribute('data-id');
        debugLog('DeleteCategory', `Attempting to delete category id=${id}`);
        if (!(await showConfirmModal('Delete this category? It will be removed from all prompts.'))) {
          debugLog('DeleteCategory', 'User cancelled deletion');
          return;
        }
        btn.disabled = true;
        // Find the category data before deletion for undo
        const categories = getCategories();
        const deletedCategory = categories.find(c => String(c.id) === String(id));
        let undoTimeout;
        try {
          const res = await fetch(`/api/categories.php?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
          const data = await res.json();
          debugLog('DeleteCategory', 'API response', data);
          if (data.ok) {
            // Show undo toast
            let undoClicked = false;
            showToast('Category deleted. <button id="undo-delete-category-btn" style="margin-left:1em;">Undo</button>', 5000);
            setTimeout(() => {
              if (!undoClicked) {
                // Finalize deletion after timeout
                window._lastDeletedCategory = null;
              }
            }, 5000);
            window._lastDeletedCategory = deletedCategory;
            // Attach undo handler
            setTimeout(() => {
              const undoBtn = document.getElementById('undo-delete-category-btn');
              if (undoBtn) {
                undoBtn.onclick = async () => {
                  undoClicked = true;
                  if (window._lastDeletedCategory) {
                    // Restore category
                    await fetch('/api/categories.php', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: window._lastDeletedCategory.name })
                    });
                    showToast('Category restored');
                    await loadCategoriesAndTags();
                    renderCategoryManagement();
                    window.dispatchEvent(new CustomEvent('categoriesUpdated'));
                    window._lastDeletedCategory = null;
                  }
                };
              }
            }, 100); // Wait for toast to render
            await loadCategoriesAndTags();
            renderCategoryManagement();
            window.dispatchEvent(new CustomEvent('categoriesUpdated'));
          } else {
            showToast('Failed to delete category: ' + (data.error || 'Unknown error'));
          }
        } catch (err) {
          showToast('Error deleting category');
          console.error('[TagCategoryManager] DeleteCategory error:', err);
        }
        btn.disabled = false;
      };
    });
    debugLog('renderCategoryManagement', 'Category management UI rendered');
  }

  // --- Modal open/close event listeners ---
  // Ensure only one management modal is open at a time
  function closeAllManagementModals() {
    if (tagManagementModal) closeIsolatedModal(tagManagementModal);
    if (categoryManagementModal) closeIsolatedModal(categoryManagementModal);
  }

  if (manageTagsBtn && tagManagementModal) {
    console.log('[DIAG][tagCategoryManager] manageTagsBtn found, attaching click handler');
    manageTagsBtn.onclick = () => {
      console.log('[DIAG][tagCategoryManager] manageTagsBtn clicked, opening tag management modal');
      debugLog('Modal', 'Opening tag management modal');
      closeAllManagementModals();
      renderTagManagement();
      openIsolatedModal(tagManagementModal);
      setTimeout(() => {
        const firstInput = tagManagementModal.querySelector('input');
        if (firstInput) firstInput.focus();
      }, 50);
    };
  } else {
    console.warn('[DIAG][tagCategoryManager] manageTagsBtn NOT found in DOM');
  }
  if (closeTagManagementModal && tagManagementModal) {
    closeTagManagementModal.onclick = () => {
      debugLog('Modal', 'Closing tag management modal');
      closeIsolatedModal(tagManagementModal);
    };
    tagManagementModal.addEventListener('click', e => {
      if (e.target === tagManagementModal) {
        debugLog('Modal', 'Backdrop click closes tag management modal');
        closeIsolatedModal(tagManagementModal);
      }
    });
  }
  if (manageCategoriesBtn && categoryManagementModal) {
    console.log('[DIAG][tagCategoryManager] manageCategoriesBtn found, attaching click handler');
    manageCategoriesBtn.onclick = () => {
      console.log('[DIAG][tagCategoryManager] manageCategoriesBtn clicked, opening category management modal');
      debugLog('Modal', 'Opening category management modal');
      closeAllManagementModals();
      renderCategoryManagement();
      openIsolatedModal(categoryManagementModal);
      setTimeout(() => {
        const firstInput = categoryManagementModal.querySelector('input');
        if (firstInput) firstInput.focus();
      }, 50);
    };
  } else {
    console.warn('[DIAG][tagCategoryManager] manageCategoriesBtn NOT found in DOM');
  }
  if (closeCategoryManagementModal && categoryManagementModal) {
    closeCategoryManagementModal.onclick = () => {
      debugLog('Modal', 'Closing category management modal');
      closeIsolatedModal(categoryManagementModal);
    };
    categoryManagementModal.addEventListener('click', e => {
      if (e.target === categoryManagementModal) {
        debugLog('Modal', 'Backdrop click closes category management modal');
        closeIsolatedModal(categoryManagementModal);
      }
    });
  }

  // Re-render management UIs when tags/categories change
  subscribe(() => {
    debugLog('State', 'Detected state change, re-rendering management UIs if open');
    if (tagManagementModal && tagManagementModal.style.display === 'flex') renderTagManagement();
    if (categoryManagementModal && categoryManagementModal.style.display === 'flex') renderCategoryManagement();
  });

  debugLog('initTagCategoryManager', 'Initialization complete');
}