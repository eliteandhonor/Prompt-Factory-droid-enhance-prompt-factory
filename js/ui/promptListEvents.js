// promptListEvents.js - Global event listeners for Prompt List UI

import { showConfirmModal, showFullPromptModal } from './modals.js';
import { deletePrompt, createPrompt, updatePrompt } from '../api/prompts.js';
import { getCategories, getTags, getPrompts, setPrompts } from '../state/appState.js';

// Attach global CRUD event listeners
export function attachPromptCrudListeners(debugLog = () => {}) {
  if (!window.__promptCrudListenersAdded) {
    window.addEventListener('prompt:edit', (e) => {
      const prompt = e?.detail?.prompt;
      if (!prompt) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Prompt data missing for edit.', type: 'error' } }));
        return;
      }
      window.dispatchEvent(new CustomEvent('openCrudModal', { detail: { mode: 'edit', promptId: prompt.id } }));
    });

    window.addEventListener('prompt:delete', async (e) => {
      const promptId = e?.detail?.promptId;
      const prompt = e?.detail?.prompt;
      if (!promptId) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Prompt ID missing for delete.', type: 'error' } }));
        return;
      }
      const confirmed = await showConfirmModal(
        `Are you sure you want to delete the prompt "${prompt?.title || promptId}"? This action cannot be undone.`
      );
      if (!confirmed) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Prompt deletion cancelled.', type: 'info' } }));
        return;
      }
      try {
        await deletePrompt(promptId);
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Prompt deleted.', type: 'success' } }));
        window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
        setTimeout(() => {
          const main = document.getElementById('main-content') || document.body;
          if (main && typeof main.focus === 'function') main.focus();
        }, 150);
      } catch (err) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Error deleting prompt.', type: 'error' } }));
      }
    });
    window.__promptCrudListenersAdded = true;
  }
}

// Attach global result:delete event listener
export function attachResultDeleteListener(debugLog = () => {}) {
  if (!window.__resultDeleteListenerAdded) {
    window.addEventListener('result:delete', async (e) => {
      const { promptId, resultId, result, prompt } = e.detail || {};
      if (!promptId || typeof resultId === 'undefined') {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Missing prompt or result ID for delete.', type: 'error' } }));
        return;
      }
      try {
        if (window.deleteResult) {
          await window.deleteResult(resultId);
        }
        if (prompt && Array.isArray(prompt.results)) {
          const idx = prompt.results.findIndex(r => (r.id || r) === resultId);
          if (idx !== -1) {
            prompt.results = [
              ...prompt.results.slice(0, idx),
              ...prompt.results.slice(idx + 1)
            ];
          }
        }
        window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Result deleted.', type: 'success' } }));
      } catch (err) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Error deleting result.', type: 'error' } }));
      }
    });
    window.__resultDeleteListenerAdded = true;
  }
}

// Attach global full prompt modal listener
export function attachFullPromptModalListener() {
  if (!window.__fullPromptModalListenerAdded) {
    window.addEventListener('openFullPromptModal', (e) => {
      const prompt = e?.detail?.prompt;
      if (prompt) showFullPromptModal(prompt);
    });
    window.__fullPromptModalListenerAdded = true;
  }
}
// KISS global event listener for add/edit/view prompt modal
if (!window.__openCrudModalListenerAdded) {
  window.addEventListener('openCrudModal', (e) => {
    const detail = e?.detail || {};
    const mode = detail.mode;
    const promptId = detail.promptId;
    const crudModal = document.getElementById('crud-modal');
    const crudModalBody = document.getElementById('crud-modal-body');
    if (!crudModal || !crudModalBody) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Prompt modal not found.', type: 'error' } }));
      return;
    }
    if (mode === 'add') {
      // Render category and tag options
      const categories = getCategories();
      const tags = getTags();
      const categoryOptions = categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      const tagOptions = tags.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
      crudModalBody.innerHTML = `
        <div>
          <h2>Add Prompt</h2>
          <form id="add-prompt-form-modal">
            <input type="text" id="modal-prompt-title" placeholder="Title" required style="width:100%;margin-bottom:0.5em;" />
            <textarea id="modal-prompt-content" placeholder="Content" required style="width:100%;height:100px;margin-bottom:0.5em;"></textarea>
            <input type="text" id="modal-prompt-description" placeholder="Description (optional)" style="width:100%;margin-bottom:0.5em;" />
            <input type="text" id="modal-prompt-author" placeholder="Author (default: anonymous)" style="width:100%;margin-bottom:0.5em;" />
            <label for="modal-prompt-category">Category:</label>
            <select id="modal-prompt-category" required style="width:100%;margin-bottom:0.5em;">${categoryOptions}</select>
            <label for="modal-prompt-tags">Tags:</label>
            <select id="modal-prompt-tags" multiple required style="width:100%;margin-bottom:0.5em;">${tagOptions}</select>
            <button type="submit" class="primary">Add</button>
            <button type="button" id="cancel-add-prompt-btn" style="margin-left:1em;">Cancel</button>
          </form>
          <div id="add-prompt-error" style="color:red;margin-top:0.5em;"></div>
        </div>
      `;
      showModal(crudModal);
      const form = document.getElementById('add-prompt-form-modal');
      const errorDiv = document.getElementById('add-prompt-error');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('modal-prompt-title').value.trim();
        const content = document.getElementById('modal-prompt-content').value.trim();
        let author = document.getElementById('modal-prompt-author').value.trim();
        if (!author) author = 'anonymous';
        let description = document.getElementById('modal-prompt-description').value.trim();
        const category = document.getElementById('modal-prompt-category').value;
        const tagSelect = document.getElementById('modal-prompt-tags');
        const tagIds = Array.from(tagSelect.selectedOptions).map(opt => opt.value);
        const promptToSend = { title, content, author, description, category, tags: tagIds };
        console.log('[DIAG][ADD PROMPT SUBMIT] Fields to send:', promptToSend);
        if (!title || !content) {
          errorDiv.textContent = 'Title and content are required.';
          return;
        }
        if (!category) {
          errorDiv.textContent = 'Please select a category.';
          return;
        }
        if (!tagIds.length) {
          errorDiv.textContent = 'Please select at least one tag.';
          return;
        }
        try {
          const resp = await createPrompt(promptToSend);
          // Add new prompt to state immediately if backend returns it
          if (resp && resp.prompt) {
            const prompts = getPrompts();
            setPrompts([...prompts, resp.prompt]);
          }
          hideModal(crudModal);
          // Force full reload from backend after add
          if (window.promptManager && typeof window.promptManager.fetchPrompts === 'function') {
            window.promptManager.fetchPrompts();
          } else {
            window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
          }
        } catch (err) {
          errorDiv.textContent = 'Error adding prompt.';
        }
      };
      document.getElementById('cancel-add-prompt-btn').onclick = () => {
        hideModal(crudModal);
      };
    }
    // Implement edit mode
    if (mode === 'edit') {
      // Find the prompt to edit (from app state)
      // Always use latest prompts from app state
      const prompts = getPrompts();
      const prompt = prompts.find(p => String(p.id) === String(promptId));
      if (!prompt) {
        crudModalBody.innerHTML = '<div style="color:red;">Prompt not found.</div>';
        showModal(crudModal);
        return;
      }
      const categories = getCategories();
      const tags = getTags();
      const categoryOptions = categories.map(c => `<option value="${c.id}"${c.id === prompt.category ? ' selected' : ''}>${c.name}</option>`).join('');
      const tagOptions = tags.map(t => `<option value="${t.id}"${Array.isArray(prompt.tags) && prompt.tags.includes(t.id) ? ' selected' : ''}>${t.name}</option>`).join('');
      crudModalBody.innerHTML = `
        <div>
          <h2>Edit Prompt</h2>
          <form id="edit-prompt-form-modal">
            <input type="text" id="modal-prompt-title" placeholder="Title" required style="width:100%;margin-bottom:0.5em;" value="${prompt.title || ''}" />
            <textarea id="modal-prompt-content" placeholder="Content" required style="width:100%;height:100px;margin-bottom:0.5em;">${prompt.content || ''}</textarea>
            <input type="text" id="modal-prompt-description" placeholder="Description (optional)" style="width:100%;margin-bottom:0.5em;" value="${prompt.description || ''}" />
            <input type="text" id="modal-prompt-author" placeholder="Author (default: anonymous)" style="width:100%;margin-bottom:0.5em;" value="${prompt.author || ''}" />
            <label for="modal-prompt-category">Category:</label>
            <select id="modal-prompt-category" required style="width:100%;margin-bottom:0.5em;">${categoryOptions}</select>
            <label for="modal-prompt-tags">Tags:</label>
            <select id="modal-prompt-tags" multiple required style="width:100%;margin-bottom:0.5em;">${tagOptions}</select>
            <button type="submit" class="primary">Save</button>
            <button type="button" id="cancel-edit-prompt-btn" style="margin-left:1em;">Cancel</button>
          </form>
          <div id="edit-prompt-error" style="color:red;margin-top:0.5em;"></div>
        </div>
      `;
      showModal(crudModal);
      const form = document.getElementById('edit-prompt-form-modal');
      const errorDiv = document.getElementById('edit-prompt-error');
      form.onsubmit = async (e) => {
        e.preventDefault();
        const title = document.getElementById('modal-prompt-title').value.trim();
        const content = document.getElementById('modal-prompt-content').value.trim();
        let author = document.getElementById('modal-prompt-author').value.trim();
        if (!author) author = 'anonymous';
        let description = document.getElementById('modal-prompt-description').value.trim();
        const category = document.getElementById('modal-prompt-category').value;
        const tagSelect = document.getElementById('modal-prompt-tags');
        const tagIds = Array.from(tagSelect.selectedOptions).map(opt => opt.value);
        const promptToSend = { title, content, author, description, category, tags: tagIds };
        console.log('[DIAG][EDIT PROMPT SUBMIT] Fields to send:', promptToSend);
        if (!title || !content) {
          errorDiv.textContent = 'Title and content are required.';
          return;
        }
        if (!category) {
          errorDiv.textContent = 'Please select a category.';
          return;
        }
        if (!tagIds.length) {
          errorDiv.textContent = 'Please select at least one tag.';
          return;
        }
        try {
          const resp = await updatePrompt(prompt.id, promptToSend);
          // Update prompt in state immediately if backend returns it
          if (resp && resp.prompt) {
            const prompts = getPrompts();
            const idx = prompts.findIndex(p => p.id === resp.prompt.id);
            if (idx !== -1) {
              prompts[idx] = resp.prompt;
              setPrompts([...prompts]);
            }
          }
          hideModal(crudModal);
          // Force full reload from backend after edit
          if (window.promptManager && typeof window.promptManager.fetchPrompts === 'function') {
            window.promptManager.fetchPrompts();
          } else {
            window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
          }
        } catch (err) {
          errorDiv.textContent = 'Error saving prompt.';
        }
      };
      document.getElementById('cancel-edit-prompt-btn').onclick = () => {
        hideModal(crudModal);
      };
    }
  });
  // KISS modal helpers
  window.showModal = function(modalEl) {
    if (!modalEl) return;
    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    modalEl.classList.add('active');
    modalEl.focus();
    document.body.classList.add('modal-open');
  };
  window.hideModal = function(modalEl) {
    if (!modalEl) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    modalEl.classList.remove('active');
    document.body.classList.remove('modal-open');
  };
  window.__openCrudModalListenerAdded = true;
}
// KISS global event listener for batch import modal and file processing
if (!window.__openImportModalListenerAdded) {
  // Ensure a single hidden file input exists for multi-import
  let importInput = document.getElementById('multi-import-file-input');
  if (!importInput) {
    importInput = document.createElement('input');
    importInput.type = 'file';
    importInput.id = 'multi-import-file-input';
    importInput.multiple = true;
    importInput.accept = '.txt,.md,.json';
    importInput.style.display = 'none';
    document.body.appendChild(importInput);
  }
  window.addEventListener('openImportModal', () => {
    importInput.value = '';
    importInput.click();
  });
  importInput.onchange = (e) => {
    window.dispatchEvent(new CustomEvent('importFilesSelected', { detail: { files: Array.from(importInput.files || []) } }));
  };
  window.addEventListener('importFilesSelected', async (e) => {
    const files = e?.detail?.files || [];
    if (!files.length) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'No files selected.', type: 'error' } }));
      return;
    }
    function parsePromptFile(file, text) {
      // KISS: Use file name (without extension) as title, all file content as content
      const title = file.name.replace(/\.[^/.]+$/, '');
      const content = text;
      return {
        title,
        content,
        description: '',
        category: '',
        tags: []
      };
    }
    try {
      const promptObjs = [];
      for (const file of files) {
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });
        const prompt = parsePromptFile(file, text);
        if (!prompt.title || !prompt.content) {
          window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `File "${file.name}" is missing a title or content.`, type: 'error' } }));
          continue;
        }
        promptObjs.push(prompt);
      }
      if (!promptObjs.length) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'No valid prompts found in selected files.', type: 'error' } }));
        importInput.value = '';
        return;
      }
      const crudModal = document.getElementById('crud-modal');
      const crudModalBody = document.getElementById('crud-modal-body');
      if (!crudModal || !crudModalBody) {
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Import modal not found.', type: 'error' } }));
        importInput.value = '';
        return;
      }
      crudModalBody.innerHTML = `
        <div>
          <h2>Import Prompts</h2>
          <label for="import-author-input">Author for all prompts (default: anonymous):</label>
          <input type="text" id="import-author-input" placeholder="Author (default: anonymous)" style="width:100%;margin-bottom:0.5em;" />
          <p>Ready to import <strong>${promptObjs.length}</strong> prompt(s):</p>
          <ul style="max-height:200px;overflow:auto;">
            ${promptObjs.map(p => `<li><strong>${p.title}</strong><br><pre style="white-space:pre-wrap;">${p.content.slice(0, 200)}${p.content.length > 200 ? '...' : ''}</pre></li>`).join('')}
          </ul>
          <div style="margin-top:1em;">
            <button id="confirm-import-btn" data-testid="confirm-import-btn">Import</button>
            <button id="cancel-import-btn" style="margin-left:1em;">Cancel</button>
          </div>
          <div id="import-progress" style="margin-top:1em;"></div>
        </div>
      `;
      window.showModal(crudModal);
      document.getElementById('confirm-import-btn').onclick = async () => {
        const progressDiv = document.getElementById('import-progress');
        let successCount = 0;
        let failCount = 0;
        let author = document.getElementById('import-author-input').value.trim();
        if (!author) author = 'anonymous';
        progressDiv.textContent = 'Importing...';
        // Get first available category and tag
        const categories = getCategories();
        const tags = getTags();
        if (!categories.length || !tags.length) {
          progressDiv.textContent = 'At least one category and one tag are required to import prompts. Please add them first.';
          return;
        }
        const category = categories[0].id;
        const tagIds = [tags[0].id];
        for (const prompt of promptObjs) {
          try {
            await createPrompt({ ...prompt, author, category, tags: tagIds });
            successCount++;
            progressDiv.textContent = `Imported ${successCount}/${promptObjs.length}`;
          } catch (err) {
            failCount++;
            progressDiv.textContent = `Imported ${successCount}/${promptObjs.length}, failed ${failCount}`;
          }
        }
        window.dispatchEvent(new CustomEvent('showToast', { detail: { message: `Imported ${successCount} prompt(s).${failCount ? ' ' + failCount + ' failed.' : ''}`, type: failCount ? 'warning' : 'success' } }));
        window.hideModal(crudModal);
        window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
        importInput.value = '';
      };
      document.getElementById('cancel-import-btn').onclick = () => {
        window.hideModal(crudModal);
        importInput.value = '';
      };
    } catch (err) {
      window.dispatchEvent(new CustomEvent('showToast', { detail: { message: 'Error reading files.', type: 'error' } }));
      importInput.value = '';
    }
  });
  window.__openImportModalListenerAdded = true;
}