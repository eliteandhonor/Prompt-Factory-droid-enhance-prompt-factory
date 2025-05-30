/**
 * modals.js
 * Modal dialog and component manager for CRUD, import/export, comments/results, and focus/animation behavior.
 * Pure functional exports only; no direct global state or DOM access outside arguments.
 *
 * @module modals
 */
import * as promptsApi from '../api/prompts.js';
import { escapeHTML } from '../util/markdown.js';
import { renderPromptBlock } from './renderPromptBlock.js';
import { formatDate } from '../util/helpers.js';
import { bindModalEvents } from './util/domEvents.js';
import { showBanner } from './banners.js';

/**
 * Open a modal dialog, managing ARIA state, keyboard focus trap, and cleanup of focus and listeners.
 * Private modalEl properties _lastFocused and _cleanupListeners are not part of the public API.
 * @param {HTMLElement} modalEl - The modal element/container.
 * @param {Object} props - Modal state/options (mode, data, etc.).
 */
export function openModal(modalEl, props = {}) {
  console.log('[UI/AUDIT] openModal: entry', { modalEl, props });
  if (!modalEl) {
    console.error('[UI/AUDIT] openModal: abort, modalEl is falsy');
    return;
  }

  // Visual/ARIA/modal-open
  modalEl.removeAttribute('hidden');
  modalEl.setAttribute('aria-modal', 'true');
  modalEl.setAttribute('role', 'dialog');
  modalEl.tabIndex = -1;
  document.body.classList.add('modal-open');

  // Focus trap: focus modal on open
  setTimeout(() => {
    let focusEl = modalEl.querySelector('button, [tabindex]:not([tabindex="-1"])');
    if (focusEl) focusEl.focus();
    else modalEl.focus();
  }, 40);

  // Modular DRY dismissal logic
  bindModalEvents(modalEl, () => closeModal(modalEl));
  console.log('[UI/AUDIT] openModal: exit', { modalEl });
}

/**
 * Close a modal dialog and restore prior focus if appropriate.
 * Also cleans event listeners managed by openModal. Private modalEl props not API.
 * @param {HTMLElement} modalEl
 */
export function closeModal(modalEl) {
  console.log('[UI/AUDIT] closeModal: entry', { modalEl });
  if (!modalEl) {
    console.error('[UI/AUDIT] closeModal: abort, modalEl is falsy');
    return;
  }
  modalEl.setAttribute('hidden', '');
  document.body.classList.remove('modal-open');
  modalEl.blur();

  // Clean any event listeners added by openModal
  if (modalEl._cleanupListeners instanceof Function) {
    modalEl._cleanupListeners();
    modalEl._cleanupListeners = null;
  }

  // Restore focus to prior element (unless already in modal)
  if (modalEl._lastFocused && typeof modalEl._lastFocused.focus === "function") {
    setTimeout(() => {
      try {
        modalEl._lastFocused.focus();
      } catch (e) {
        console.warn('[UI/AUDIT] closeModal: restore focus failed', e);
      }
      modalEl._lastFocused = null;
    }, 30);
  }
  console.log('[UI/AUDIT] closeModal: exit', { modalEl });
}

/**
 * Render the detail modal for a prompt (content is XSS-escaped via renderPromptBlock).
 * Opens with ARIA/focus state via openModal.
 * @param {HTMLElement} modalEl
 * @param {Object} prompt
 * @param {Object} options
 */
export function renderPromptDetailModal(modalEl, prompt = {}, options = {}) {
  console.log('[UI/AUDIT] renderPromptDetailModal: entry', { modalEl, prompt, options });
  if (!modalEl || !prompt) {
    console.error('[UI/AUDIT] renderPromptDetailModal: abort, modalEl or prompt falsy');
    // Critical UI requirement: show banner on error so user always gets feedback
    const toast = document.getElementById('toast');
    if (toast && typeof showBanner === 'function') {
      showBanner(toast, {
        ok: false,
        message: 'Error opening prompt: missing data or UI component.',
        detail: [
          !modalEl ? 'Modal element missing.' : '',
          !prompt ? 'Prompt data missing.' : ''
        ].filter(Boolean).join(' ')
      });
    } else {
      // fallback: classic alert
      alert('Error: unable to render prompt detail modal.');
    }
    return;
  }
  modalEl.innerHTML = renderPromptBlock(prompt, { mode: 'modal' });
  openModal(modalEl);
  console.log('[UI/AUDIT] renderPromptDetailModal: exit', { modalEl });
}

/**
 * Render/create the CRUD (add/edit/delete) modal, with ARIA/accessible form.
 * All prompt field content is XSS-escaped via escapeHTML and renderPromptBlock.
 * Keyboard focus is restricted to modal while open.
 * @param {HTMLElement} modalEl
 * @param {'add'|'edit'|'delete'} mode
 * @param {Object} prompt (for edit/delete)
 * @param {Object} options - { onSave, onDelete, onCancel }
 */
export function renderCrudModal(modalEl, mode, prompt = {}, options = {}) {
  console.log('[UI/AUDIT] renderCrudModal: entry', { modalEl, mode, prompt, options });
  if (!modalEl) {
    console.error('[UI/AUDIT] renderCrudModal: abort, modalEl is falsy', { mode, prompt, options });
    return;
  }
  // Wipe previous content and handlers
  modalEl.innerHTML = '';
  let inner = '';
  let focusSelector = '';

  if (mode === 'add' || mode === 'edit') {
    inner = `
      <form class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="0" autocomplete="off" novalidate>
        <button type="button" class="close-modal" aria-label="Cancel">&times;</button>
        <h2 id="modal-title">${mode === 'add' ? 'Add New Prompt' : 'Edit Prompt'}</h2>
        <label>
          <span>Title<span aria-hidden="true">*</span></span>
          <input name="title" type="text" maxlength="100" required aria-required="true" value="${escapeHTML(prompt.title || '')}" />
        </label>
        <label>
          <span>Description</span>
          <textarea name="description" maxlength="500" aria-multiline="true">${escapeHTML(prompt.description || '')}</textarea>
        </label>
        <label>
          <span>Prompt<span aria-hidden="true">*</span></span>
          <textarea name="prompt" required aria-required="true" maxlength="2000" rows="6">${escapeHTML(prompt.prompt || '')}</textarea>
        </label>
        <label>
          <span>Category</span>
          <input name="category" type="text" maxlength="50" value="${escapeHTML(prompt.category || '')}" />
        </label>
        <label>
          <span>Tags <small>(comma-separated)</small></span>
          <input name="tags" type="text" maxlength="100" value="${escapeHTML((prompt.tags || []).join(', '))}" />
        </label>
        <label>
          <span>Author</span>
          <input name="author" type="text" maxlength="40" value="${escapeHTML(prompt.author || '')}" />
        </label>
        <div class="modal-actions">
          <button type="submit" class="primary">${mode === 'add' ? 'Create' : 'Save'}</button>
          <button type="button" class="close-modal secondary">Cancel</button>
        </div>
        <div class="modal-error" role="alert" aria-live="assertive" style="display:none"></div>
      </form>
    `;
    focusSelector = 'input[name="title"]';
  } else if (mode === 'delete') {
    inner = `
      <div class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="0">
        <button type="button" class="close-modal" aria-label="Cancel">&times;</button>
        <h2 id="modal-title">Delete Prompt</h2>
        <div class="modal-delete-warning" role="alert" style="color:#d33;">
          Are you sure you want to <strong>delete</strong> this prompt? This cannot be undone.
        </div>
        <div class="modal-prompt-preview">
          ${renderPromptBlock(prompt, { mode: 'modal' })}
        </div>
        <div class="modal-actions">
          <button type="button" class="danger delete-confirm-btn">Delete</button>
          <button type="button" class="close-modal secondary">Cancel</button>
        </div>
      </div>
    `;
    focusSelector = '.delete-confirm-btn';
  } else {
    console.error('[UI/AUDIT] renderCrudModal: abort, unknown mode', { mode, prompt, options });
    return;
  }
  modalEl.innerHTML = inner;
  openModal(modalEl);

  // Focus trap: restrict focus within modal while open
  const focusable = modalEl.querySelectorAll('button, [tabindex]:not([tabindex="-1"]), input, textarea, select, a[href]');
  let firstFocusable = focusable[0];
  let lastFocusable = focusable[focusable.length - 1];
  modalEl.addEventListener('keydown', function trapTab(e) {
    if (e.key === 'Tab') {
      if (focusable.length === 0) return;
      // Shift+Tab
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      }
      // Tab forward
      else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });

  // Set initial focus
  if (focusSelector) {
    setTimeout(() => {
      const el = modalEl.querySelector(focusSelector);
      if (el) el.focus();
    }, 60);
  }

  // Handler for add/edit form
  if (mode === 'add' || mode === 'edit') {
    const form = modalEl.querySelector('form');
    const errorDiv = modalEl.querySelector('.modal-error');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorDiv.style.display = 'none';

      // Validation
      const formData = new FormData(form);
      const title = formData.get('title').trim();
      const promptTxt = formData.get('prompt').trim();
      if (!title || !promptTxt) {
        errorDiv.textContent = 'Title and Prompt are required.';
        errorDiv.style.display = 'block';
        console.warn('[UI/AUDIT] renderCrudModal: validation error (missing title or prompt)', { title, promptTxt });
        return;
      }
      // Parse tags
      const tags = (formData.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean);
      const newPrompt = {
        ...prompt,
        title,
        description: formData.get('description').trim() || "(No description)",
        prompt: promptTxt,
        category: formData.get('category').trim(),
        tags,
        author: formData.get('author').trim(),
      };

      try {
        console.log('[UI/AUDIT] renderCrudModal: submitting prompt', { mode, newPrompt });
        let saveResult = undefined;
        if (mode === 'add') {
          if (typeof options.onSave === 'function') {
            saveResult = await options.onSave(newPrompt);
            console.log('[UI/AUDIT] renderCrudModal: onSave result', { result: saveResult });
          }
        } else if (mode === 'edit') {
          if (typeof options.onSave === 'function') {
            saveResult = await options.onSave(newPrompt);
            console.log('[UI/AUDIT] renderCrudModal: onSave result', { result: saveResult });
          }
        }
        if (saveResult && typeof saveResult === 'object' && saveResult.code) {
          // Error
          errorDiv.textContent = saveResult.message || 'Error saving prompt.';
          errorDiv.style.display = 'block';
          // Surface error in global UI banner too:
          const toast = document.getElementById('toast');
          if (toast && typeof showBanner === 'function') {
            showBanner(toast, {
              ok: false,
              message: 'Error saving prompt',
              detail: saveResult.message || 'An unknown error occurred when saving the prompt.'
            });
          }
          console.error('[UI/AUDIT] renderCrudModal: user/onSave error', { saveResult, newPrompt });
          return;
        }
        console.log('[UI/AUDIT] renderCrudModal: submit success, closing modal');
        closeModal(modalEl);
      } catch (err) {
        errorDiv.textContent = err && err.message ? err.message : 'Error saving prompt.';
        errorDiv.style.display = 'block';
        // Surface error in global UI banner too:
        const toast = document.getElementById('toast');
        if (toast && typeof showBanner === 'function') {
          showBanner(toast, {
            ok: false,
            message: 'Exception saving prompt',
            detail: err && err.message ? err.message : 'Unknown error'
          });
        }
        // Also surface in a toast notification (universal error surfacing)
        if (typeof window !== "undefined" && typeof window.showToast === "function") {
          window.showToast("Network error: Failed to save. Please try again.", "danger");
        } else if (typeof UI !== "undefined" && typeof UI.showToast === "function") {
          UI.showToast("Network error: Failed to save. Please try again.", "danger");
        }
        console.error('[UI/AUDIT] renderCrudModal: exception during prompt submit', { error: err, attempted: newPrompt });
      }
    });
  }

  // Handler for delete modal
  if (mode === 'delete') {
    const delBtn = modalEl.querySelector('.delete-confirm-btn');
    delBtn.addEventListener('click', async () => {
      try {
        console.log('[UI/AUDIT] renderCrudModal: delete-confirm click', { prompt });
        if (typeof options.onDelete === 'function') {
          await options.onDelete(prompt);
          console.log('[UI/AUDIT] renderCrudModal: onDelete success, closing modal', { prompt });
        }
        closeModal(modalEl);
      } catch (err) {
        // Show feedback error (reuse modal-error if you wish)
        const toast = document.getElementById('toast');
        if (toast && typeof showBanner === 'function') {
          showBanner(toast, {
            ok: false,
            message: 'Error deleting prompt',
            detail: (err && err.message) ? err.message : 'Delete failed.'
          });
        }
        console.error('[UI/AUDIT] renderCrudModal: delete error', { error: err, prompt });
        alert((err && err.message) ? err.message : 'Delete failed.');
      }
    });
  }

  // All cancel/close actions must close modal and call onCancel if provided
  modalEl.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('[UI/AUDIT] renderCrudModal: cancel/close click', { modalEl, mode, prompt });
      closeModal(modalEl);
      if (typeof options.onCancel === 'function') {
        options.onCancel();
        console.log('[UI/AUDIT] renderCrudModal: cancel callback called', { modalEl, mode, prompt });
      }
    });
  });
  console.log('[UI/AUDIT] renderCrudModal: exit', { modalEl, mode });
}
/**
 * Render batch import/export modal UI.
 */
/**
 * Render batch import modal for .md/.txt files, with ARIA and validation.
 * Handles keyboard focus trap and XSS-protects all filenames displayed.
 * @param {HTMLElement} modalEl
 * @param {Object} options - { onImport(files), onCancel }
 */
export function renderBatchImportModal(modalEl, options = {}) {
  console.log('[UI/AUDIT] renderBatchImportModal: entry', { modalEl, options });
  if (!modalEl) {
    console.error('[UI/AUDIT] renderBatchImportModal: abort, modalEl is falsy', { options });
    return;
  }
  modalEl.innerHTML = `
    <form class="modal-content" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="0" autocomplete="off" novalidate>
      <button type="button" class="close-modal" aria-label="Cancel">&times;</button>
      <h2 id="modal-title">Import Prompts (.md or .txt)</h2>
      <label>
        <span>Select files:</span>
        <input type="file" name="importFiles" multiple accept=".md,.txt" aria-required="true" required />
      </label>
      <ul class="modal-import-filelist" style="margin:1em 0;padding:0;list-style:none"></ul>
      <div class="modal-actions">
        <button type="submit" class="primary">Import</button>
        <button type="button" class="close-modal secondary">Cancel</button>
      </div>
      <div class="modal-error" role="alert" aria-live="assertive" style="display:none"></div>
    </form>
  `;
  openModal(modalEl);

  // Keyboard/tab trap
  const focusable = modalEl.querySelectorAll('button, [tabindex]:not([tabindex="-1"]), input, textarea, select, a[href]');
  let firstFocusable = focusable[0];
  let lastFocusable = focusable[focusable.length - 1];
  modalEl.addEventListener('keydown', function trapTab(e) {
    if (e.key === 'Tab') {
      if (focusable.length === 0) return;
      if (e.shiftKey && document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable.focus();
      } else if (!e.shiftKey && document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable.focus();
      }
    }
  });

  // File input/preview
  const form = modalEl.querySelector('form');
  const fileInput = form.querySelector('input[type="file"]');
  const fileListEl = form.querySelector('.modal-import-filelist');
  const errorDiv = form.querySelector('.modal-error');

  fileInput.addEventListener('change', () => {
    fileListEl.innerHTML = '';
    errorDiv.style.display = 'none';
    const files = Array.from(fileInput.files || []);
    console.log('[UI/AUDIT] renderBatchImportModal: file input change', { fileCount: files.length, files: files.map(f => f.name) });
    if (!files.length) return;
    files.forEach(f => {
      let valid = /\.(md|txt)$/i.test(f.name);
      fileListEl.innerHTML += `<li style="color:${valid ? '#222' : '#d33'}">${escapeHTML(f.name)}${valid ? '' : ' (invalid type)'}</li>`;
    });
  });

  // Submit/import handler
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';
    const files = Array.from(fileInput.files || []);
    // Validate presence and type
    if (!files.length || !files.every(f => /\.(md|txt)$/i.test(f.name))) {
      errorDiv.textContent = 'Please select only .md or .txt files to import.';
      errorDiv.style.display = 'block';
      console.warn('[UI/AUDIT] renderBatchImportModal: invalid files selected', { files: files.map(f => f.name) });
      return;
    }
    try {
      console.log('[UI/AUDIT] renderBatchImportModal: importing files', { fileCount: files.length, files: files.map(f => f.name) });
      if (typeof options.onImport === 'function') {
        await options.onImport(files);
        console.log('[UI/AUDIT] renderBatchImportModal: import callback done');
      }
      closeModal(modalEl);
      console.log('[UI/AUDIT] renderBatchImportModal: modal closed after import');
    } catch (err) {
      errorDiv.textContent = err && err.message ? err.message : 'Import failed.';
      errorDiv.style.display = 'block';
      console.error('[UI/AUDIT] renderBatchImportModal: import error', { error: err, files: files.map(f => f.name) });
    }
  });

  // Cancel/close actions
  modalEl.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      console.log('[UI/AUDIT] renderBatchImportModal: cancel/close click', { modalEl });
      closeModal(modalEl);
      if (typeof options.onCancel === 'function') {
        options.onCancel();
        console.log('[UI/AUDIT] renderBatchImportModal: cancel callback called', { modalEl });
      }
    });
  });
  console.log('[UI/AUDIT] renderBatchImportModal: exit', { modalEl });
}

/**
 * DEV/TEST ONLY: simulation stub for modal error/focus state.
 * Not for production use.
 */
export function devSimulateModalState(container, scenario) {
  // Stub for now
}

// Helper to escape HTML and format

/**
 * Internal helper: Format date as YYY Mon DD, fallback to input string if parsing fails.
 * @param {string|Date} date
 * @returns {string}
 */