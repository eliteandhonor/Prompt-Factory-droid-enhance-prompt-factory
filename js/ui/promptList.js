// promptList.js - Orchestrator for Prompt List UI (modularized 2025)

import { attachPromptCrudListeners, attachResultDeleteListener, attachFullPromptModalListener } from './promptListEvents.js';
import { attachPromptListControlListeners } from './promptListControls.js';
import { renderPrompts } from './promptListRender.js';

// Debug log utility (optional)
const DEBUG_MODE = window.DEBUG_MODE || false;
function debugLog(...args) {
  if (DEBUG_MODE) console.debug('[PromptList]', ...args);
}
window.debugLog = debugLog;

// Main initialization function
export function initPromptList(params = {}) {
  debugLog("initPromptList: START", { params });
  if (window.promptManager && typeof window.promptManager.setCurrentParams === 'function') {
    window.promptManager.setCurrentParams(params);
  }

  // Attach all listeners
  attachPromptCrudListeners(debugLog);
  attachResultDeleteListener(debugLog);
  attachFullPromptModalListener();
  attachPromptListControlListeners(debugLog);

  // Listen for filterPrompts event (global filter state)
  window.addEventListener('filterPrompts', (e) => {
    debugLog("[DIAG] filterPrompts event received", e.detail, "at", new Date().toISOString());
    if (window.promptManager && typeof window.promptManager.updateFiltersFromEvent === 'function') {
      window.promptManager.updateFiltersFromEvent(e.detail);
    }
    renderPrompts();
  });

  // Initial render
  renderPrompts();
}

// Export for ES module compatibility
export { renderPrompts };

/**
 * Re-render prompts and scroll to a specific prompt if promptId is provided.
 */
export function renderPromptsWithScroll(promptId) {
  renderPrompts();
  if (promptId) {
    setTimeout(() => {
      const el = document.querySelector(`[data-prompt-id="${promptId}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }
}
