// promptListControls.js - UI control listeners for Prompt List

import { closeIsolatedModal } from './modals.js';
import { createPrompt } from '../api/prompts.js';

export function attachViewToggleListeners(debugLog = () => {}) {
  const promptList = document.getElementById('prompt-list');
  const promptListActions = document.getElementById('prompt-list-actions');
  let listViewBtn = document.getElementById('list-view-btn');
  let gridViewBtn = document.getElementById('grid-view-btn');
  if (promptListActions && !listViewBtn && !gridViewBtn) {
    const viewToggleContainer = document.createElement('div');
    viewToggleContainer.style.display = 'flex';
    viewToggleContainer.style.gap = '8px';
    viewToggleContainer.style.justifyContent = 'center';
    viewToggleContainer.style.marginBottom = '12px';
    viewToggleContainer.innerHTML = `
      <button id="list-view-btn" data-testid="list-view-btn" type="button" class="utility" aria-label="List View" tabindex="0" role="button">List View</button>
      <button id="grid-view-btn" data-testid="grid-view-btn" type="button" class="utility" aria-label="Grid View" tabindex="0" role="button">Grid View</button>
      <button id="refresh-prompts-btn" data-testid="refresh-prompts-btn" type="button" class="utility" aria-label="Refresh Prompts" tabindex="0" role="button" title="Reload the page">🔄 Refresh</button>
    `;
    promptListActions.prepend(viewToggleContainer);
    listViewBtn = document.getElementById('list-view-btn');
    gridViewBtn = document.getElementById('grid-view-btn');
    const refreshBtn = document.getElementById('refresh-prompts-btn');
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.onclick = () => {
        window.location.reload();
      };
    }
  }
  let savedView = localStorage.getItem('promptViewMode');
  if (!savedView) {
    savedView = 'grid';
    localStorage.setItem('promptViewMode', savedView);
  }
  if (promptList) {
    promptList.classList.remove('prompt-list', 'prompt-grid');
    if (savedView === 'list') {
      promptList.classList.add('prompt-list');
    } else {
      promptList.classList.add('prompt-grid');
    }
  }
  if (listViewBtn && gridViewBtn) {
    if (savedView === 'list') {
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
    } else {
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
    }
    listViewBtn.onclick = () => {
      if (promptList) {
        promptList.classList.remove('prompt-grid');
        promptList.classList.add('prompt-list');
      }
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      localStorage.setItem('promptViewMode', 'list');
      if (typeof window.renderPrompts === 'function') window.renderPrompts();
    };
    gridViewBtn.onclick = () => {
      if (promptList) {
        promptList.classList.remove('prompt-list');
        promptList.classList.add('prompt-grid');
      }
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      localStorage.setItem('promptViewMode', 'grid');
      if (typeof window.renderPrompts === 'function') window.renderPrompts();
    };
  }
}

export function attachAddPromptListener(debugLog = () => {}) {
  const addPromptBtn = document.getElementById('add-prompt-btn');
  if (addPromptBtn) {
    console.log('[DIAG][promptListControls] addPromptBtn found, attaching click handler');
    addPromptBtn.onclick = () => {
      console.log('[DIAG][promptListControls] addPromptBtn clicked, dispatching openCrudModal');
      window.dispatchEvent(new CustomEvent('openCrudModal', { detail: { mode: 'add' } }));
    };
  } else {
    console.warn('[DIAG][promptListControls] addPromptBtn NOT found in DOM');
  }
}

export function attachBatchImportListener(debugLog = () => {}) {
  const batchImportBtn = document.getElementById('batch-import-btn');
  if (batchImportBtn) {
    console.log('[DIAG][promptListControls] batchImportBtn found, attaching click handler');
    batchImportBtn.onclick = () => {
      console.log('[DIAG][promptListControls] batchImportBtn clicked, dispatching openImportModal');
      window.dispatchEvent(new CustomEvent('openImportModal'));
    };
  } else {
    console.warn('[DIAG][promptListControls] batchImportBtn NOT found in DOM');
  }
}

export function attachImportPromptsListener(debugLog = () => {}) {
  const importBtn = document.getElementById('import-prompts-btn');
  // Use the correct file input ID from the HTML
  const importInput = document.getElementById('multi-import-file-input');
  if (!importInput) {
    console.warn('[DIAG] multi-import-file-input not found in DOM');
  }
  if (importBtn && importInput) {
    importBtn.onclick = () => {
      importInput.click();
    };
    importInput.onchange = (e) => {
      window.dispatchEvent(new CustomEvent('importFilesSelected', { detail: { files: Array.from(importInput.files || []) } }));
    };
  }
}

export function attachPromptListControlListeners(debugLog = () => {}) {
  console.log('[DIAG][promptListControls] attachPromptListControlListeners called');
  debugLog('[DIAG] attachPromptListControlListeners called');
  console.log('[DIAG][promptListControls] Attaching view toggle listeners');
  debugLog('[DIAG] Attaching view toggle listeners');
  attachViewToggleListeners(debugLog);
  console.log('[DIAG][promptListControls] Attaching add prompt listener');
  debugLog('[DIAG] Attaching add prompt listener');
  attachAddPromptListener(debugLog);
  console.log('[DIAG][promptListControls] Attaching batch import listener');
  debugLog('[DIAG] Attaching batch import listener');
  attachBatchImportListener(debugLog);
  console.log('[DIAG][promptListControls] Attaching import prompts listener');
  debugLog('[DIAG] Attaching import prompts listener');
  attachImportPromptsListener(debugLog);
  console.log('[DIAG][promptListControls] All prompt list control listeners attached');
  debugLog('[DIAG] All prompt list control listeners attached');

  // Attach search input event listener (synchronize input and state)
  const searchInput = document.querySelector('[data-testid="prompt-search-input"]');
  if (searchInput && !searchInput.__searchListenerAdded) {
    searchInput.addEventListener("input", (e) => {
      if (window.promptManager && typeof window.promptManager.setSearchQuery === 'function') {
        window.promptManager.setSearchQuery(e.target.value, { updateInput: false });
      }
    });
    searchInput.__searchListenerAdded = true;
    searchInput.value = (window.currentParams && window.currentParams.search) || "";
  }
}