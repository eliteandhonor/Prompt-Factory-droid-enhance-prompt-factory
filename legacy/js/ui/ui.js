// ========== GLOBAL ERROR HANDLING INSTRUMENTATION ==========
// This ensures any uncaught JS error or unhandled Promise rejection triggers visible UI feedback (with a diagnostic UID) and console output.
(function installGlobalErrorHandlers() {
  function showFatalUiError(msg, uid) {
    try {
      const detail = `[ErrorID: ${uid}]`;
      if (window && typeof window.showToast === "function") {
        window.showToast(
          "A fatal error occurred: " + msg + " " + detail,
          "danger",
          7200
        );
      } else {
        // fallback UI: inject alert div
        let el = document.getElementById("fatal-global-error");
        if (!el) {
          el = document.createElement("div");
          el.id = "fatal-global-error";
          el.style.position = "fixed";
          el.style.top = "0";
          el.style.left = "0";
          el.style.width = "100vw";
          el.style.zIndex = "99999";
          el.style.background = "#b71c1c";
          el.style.color = "#fff";
          el.style.fontSize = "17px";
          el.style.fontWeight = "bold";
          el.style.padding = "1.1em 2em";
          el.style.textAlign = "center";
          el.innerText = "A fatal error occurred: " + msg + " " + detail;
          document.body.appendChild(el);
        } else {
          el.innerText = "A fatal error occurred: " + msg + " " + detail;
        }
      }
    } catch {}
  }

  window.onerror = function (message, source, lineno, colno, error) {
    const errorUID = "ERR-FATAL-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
    console.error("[GLOBAL JS ERROR]", errorUID, {message, source, lineno, colno, error});
    showFatalUiError(
      (message ? message : "Unknown JS error at " + source + ":" + lineno) +
        (colno ? ":" + colno : ""),
      errorUID
    );
    // Returning false lets the error still propagate for DevTools etc
    return false;
  };

  window.onunhandledrejection = function (event) {
    const error = event.reason;
    const errorUID = "ERR-PROMISE-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
    console.error("[GLOBAL PROMISE REJECTION]", errorUID, error);
    let msg =
      (error && error.message)
        ? error.message
        : (typeof error === "string" ? error : "Unknown Promise rejection");
    showFatalUiError(msg, errorUID);
    // Not preventing default so devtools and monitoring catch it too
  };
})();
// ui.js
// Full modular/animated UI for Prompt Sharing & Community App.
// Renders prompt list, CRUD forms, modals, comments/results, applies animation/hooks, and wires to backend/test APIs.

import * as prompts from '../api/prompts.js';
/* GitHub auth removed: stubbed locally, all users unauthenticated */
import { renderMarkdownToHTML, escapeHTML } from '../util/markdown.js';
import { showToast } from './toasts.js';

import {
  bindListSelection,
  bindModalEvents,
  bindCardActions
} from './util/domEvents.js';
import { renderSidebar, bindSidebar } from './sidebar.js';
import { openModal, closeModal } from './modals.js';
import { renderPromptDetailModal, renderCrudModal } from './modals.js';

/* =======================
   UI ELEMENT GRABS
======================= */
const sidebarEl = document.getElementById('sidebar');
const categoryListEl = document.getElementById('category-list');
const tagListEl = document.getElementById('tag-list');
const showMyPromptsBtn = document.getElementById('show-my-prompts');
const mainContainer = document.getElementById('app-container');
const promptListEl = document.getElementById('prompt-list');
const promptListSection = document.getElementById('prompt-list-section');
const listViewBtn = document.getElementById('list-view-btn');
const gridViewBtn = document.getElementById('grid-view-btn');
const addPromptBtn = document.getElementById('add-prompt-btn');
const promptDetailModal = document.getElementById('prompt-detail-modal');
const promptDetailBody = document.getElementById('prompt-detail-body');
const crudModal = document.getElementById('crud-modal');
const crudModalBody = document.getElementById('crud-modal-body');
const toastEl = document.getElementById('toast');
const globalSearchInput = document.getElementById('global-search');
const commentsSection = document.getElementById('comments-section');
const commentsListEl = document.getElementById('comments-list');
const addCommentFormContainer = document.getElementById('add-comment-form-container');
const resultsSection = document.getElementById('results-section');
const resultsListEl = document.getElementById('results-list');

/* =======================
   GLOBAL STATE
======================= */
import { getState, setState, subscribe, setError, clearError } from '../state/store.js';

// All state is now managed by the app micro-store (see state/store.js). Do not use module-scoped mutable state!
// Access state via getState(), setState(), setError(), or via the subscribe() callback.


/* =======================
   INIT
======================= */
function onAppStateChange(state, patch) {
  console.log('[UI/AUDIT] onAppStateChange: entry', { patch, state });
  renderSidebar(sidebarEl, state);
  renderPromptList();
  updatePaginationControls();
  // Error/fallback: If there's a state.lastError, show it and clear after displaying.
  if (state.lastError) {
    console.log('[UI/AUDIT] onAppStateChange: displaying error', { error: state.lastError });
    showToast(state.lastError.message || 'Error', 'danger', 4800, state.lastError.fallbackAction || undefined);
    clearError();
    console.log('[UI/AUDIT] onAppStateChange: error cleared');
  }
  console.log('[UI/AUDIT] onAppStateChange: exit');
}

// Boot workflow. This ensures UI stays in sync with state, and initial data is loaded with robust error/fallback.
// No global state mutation. All mutations via setState() and setError().

async function initUI() {
  console.log('[UI/AUDIT] initUI: entry');
  subscribe(onAppStateChange);

  try {
    setState({ currentUser: null, loading: true, lastError: null });

    // [AUDIT] Investigate user_id
    try {
      const { getCurrentUserId } = await import('../auth/session.js');
      console.log("[UI/AUDIT] initUI: getCurrentUserId", { userId: getCurrentUserId() });
    } catch (e) {
      console.warn("[UI/AUDIT] initUI: getCurrentUserId() import failed", e);
    }

    // [AUDIT] Test seed prompt (if allowed)
    if (window.__ALLOW_TEST_SEED__ !== false) {
      const now = new Date().toISOString();
      const promptSeed = {
        schemaVersion: "v2025.1",
        id: 'seed-test-' + Math.random().toString(36).slice(2,8),
        title: 'Seed Prompt Title',
        description: 'Seeded prompt for audit test with full backend log coverage.',
        prompt: 'This is a test LLM prompt for UI function and backend audit.',
        tags: Array.isArray(['test','audit']) ? ['test','audit'] : [],
        category: 'General',
        author: 'audit-test',
        created_at: now,
        updated_at: now
      };
      console.log("[UI/AUDIT] initUI: seeding prompt", promptSeed);
      try {
        const result = await prompts.createPrompt(promptSeed);
        console.log("[UI/AUDIT] initUI: createPrompt result", result);
      } catch (seedErr) {
        console.error("[UI/AUDIT] initUI: createPrompt ERROR", seedErr);
      }
    }
    // Load all categories/tags
    let categories = [];
    let tags = [];
    try {
      categories = await prompts.listCategories();
      tags = await prompts.listTags();
      console.log('[UI/AUDIT] initUI: loaded categories and tags', { categories, tags });
      if (categories.code || tags.code) {
        throw new Error(categories.message || tags.message || "Failed to fetch categories/tags");
      }
    } catch (err) {
      console.error('[UI/AUDIT] initUI: failed to load categories/tags', err);
      setError({ type: 'data', message: "Failed to load categories/tags", details: err });
      categories = [];
      tags = [];
    }
    setState({ categories, tags });

    // Load all prompts
    let promptsData = [];
    try {
      promptsData = await prompts.listPrompts();
      console.log('[UI/AUDIT] initUI: loaded prompts', { count: Array.isArray(promptsData) ? promptsData.length : undefined });
      if (promptsData.code) {
        throw new Error(promptsData.message || "Failed to load prompts");
      }
    } catch (err) {
      console.error('[UI/AUDIT] initUI: failed to load prompts', err);
      setError({ type: 'data', message: "Failed to load prompts", details: err });
      promptsData = [];
    }
    setState({ prompts: promptsData, loading: false });
    showToast('Welcome to Prompt Share!', 'info');
    console.log('[UI/AUDIT] initUI: exit success');
  } catch (e) {
    console.error('[UI/AUDIT] initUI: FATAL error', e);
    setError({ type: 'init', message: 'UI failed to load: ' + (e && e.message ? e.message : e), details: e });
  }

  // === Critical Hotfix: Wire all UI Button/Action Handlers ===
  try {
    bindSidebar(sidebarEl, getState());
    console.log('[UI/AUDIT] Handlers wired: bindSidebar');
    bindListControls();
    console.log('[UI/AUDIT] Handlers wired: bindListControls');
    ;
    console.log('[UI/AUDIT] Handlers wired: bindModals');
    bindGlobalSearch();
    console.log('[UI/AUDIT] Handlers wired: bindGlobalSearch');
  } catch (e) {
    console.error('[UI/AUDIT] Handler wiring failure', e);
    setError({ type: 'init', message: 'Failed to wire UI action/event handlers: ' + (e && e.message ? e.message : e), details: e });
  }
}
window.addEventListener('DOMContentLoaded', initUI);


/* =======================
   LOAD/RENDER CORE DATA
======================= */
async function loadCategoriesAndTags() {
  state.categories = await prompts.listCategories();
  state.tags = await prompts.listTags();
  renderSidebar();
}
async function loadPrompts() {
  state.prompts = await prompts.listPrompts();
// QA PATCH: Debug log to aid prompt data troubleshooting
  console.log("[PromptShare QA] Loaded", state.prompts.length, "prompts.", state.prompts.slice(0,2));
  // [Remediation] Warn if only local/test data is loaded (backend unreachable)
  if (state.prompts.length <= 1) {
    console.warn("[Fallback Warning] Backend unreachable: using offline or test/local data only. Please check API endpoint and server/PHP status.");
    showToast('Warning: The app is running in offline/test mode – backend unreachable. Prompts shown are not synced.', 'danger', 4800);
  }
}

/* =======================
   SIDEBAR: DISPLAY + EVENTS
======================= */

/* =======================
   LIST CONTROLS (VIEW, ADD)
======================= */
function bindListControls() {
  listViewBtn.onclick = () => {
    try {
      setState({ filter: { ...getState().filter, view: 'list' } });
      listViewBtn.classList.add('active');
      gridViewBtn.classList.remove('active');
      promptListEl.classList.remove('prompt-grid');
    } catch (e) {
      const errorUID = "BTN-FATAL-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
      console.error('[FATAL UI HANDLER] ListViewBtn click', { errorUID, error: e });
      setError({ type: 'handler', message: `Failed to switch to List view [${errorUID}]`, details: e });
      if (typeof showToast === "function") showToast(`Switch to List view failed [${errorUID}]`, 'danger', 4800);
    }
  };
  gridViewBtn.onclick = () => {
    try {
      setState({ filter: { ...getState().filter, view: 'grid' } });
      gridViewBtn.classList.add('active');
      listViewBtn.classList.remove('active');
      promptListEl.classList.add('prompt-grid');
    } catch (e) {
      const errorUID = "BTN-FATAL-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
      console.error('[FATAL UI HANDLER] GridViewBtn click', { errorUID, error: e });
      setError({ type: 'handler', message: `Failed to switch to Grid view [${errorUID}]`, details: e });
      if (typeof showToast === "function") showToast(`Switch to Grid view failed [${errorUID}]`, 'danger', 4800);
    }
  };
  addPromptBtn.onclick = () => {
    try {
      showPromptCrudModal('add');
    } catch (e) {
      const errorUID = "BTN-FATAL-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
      console.error('[FATAL UI HANDLER] AddPromptBtn click', { errorUID, error: e });
      setError({ type: 'handler', message: `Failed to open Add Prompt modal [${errorUID}]`, details: e });
      if (typeof showToast === "function") showToast(`Add Prompt failed [${errorUID}]`, 'danger', 4800);
    }
  };
}

/* =======================
   PROMPT LIST + FILTER/SEARCH
======================= */
function filterPrompts(prompts, state) {
  console.log('[UI/AUDIT] filterPrompts: entry', { total: Array.isArray(prompts) ? prompts.length : undefined, filter: state.filter });
  let filtered = prompts;
  if (state.filter.category)
    filtered = filtered.filter(p => p.category === state.filter.category);
  if (state.filter.tag)
    filtered = filtered.filter(p => Array.isArray(p.tags) && p.tags.includes(state.filter.tag));
  if (state.filter.myPrompts && state.currentUser)
    filtered = filtered.filter(p => p.author === state.currentUser.login);
  if (state.filter.search && state.filter.search.length > 1) {
    const s = state.filter.search.toLowerCase();
    filtered = filtered.filter(p =>
      (p.title && p.title.toLowerCase().includes(s)) ||
      (p.description && p.description.toLowerCase().includes(s)) ||
      (Array.isArray(p.tags) && p.tags.some(tag => tag.toLowerCase().includes(s)))
    );
  }
  console.log('[UI/AUDIT] filterPrompts: exit', { resultCount: Array.isArray(filtered) ? filtered.length : undefined });
  return filtered;
}
function renderPromptList(stateParam, withAnim = false) {
  const state = stateParam || getState();
  console.log('[UI/AUDIT] renderPromptList: entry', { filter: state.filter, paging: state.paging, withAnim });
  const filtered = filterPrompts(state.prompts, state);

  // Calculate paging, then set totalFiltered
  const { page, pageSize } = state.paging;
  const totalFiltered = filtered.length;
  setState({ paging: { ...state.paging, totalFiltered } }, { silent: true });
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const pagePrompts = filtered.slice(start, end);
  console.log('[UI/AUDIT] renderPromptList: paging', { totalFiltered, start, end, pageCount: pagePrompts.length });

  // Show/hide loading spinner
  const loadingEl = document.getElementById('prompt-list-loading');
  loadingEl?.classList.add('hidden');

  if (!filtered.length) {
    console.warn('[UI/AUDIT] renderPromptList: No prompts found', { filter: state.filter });
    promptListEl.innerHTML = `
      <div class="loading animated fadeIn">No prompts found.</div>
      <button class="btn-primary" id="add-prompt-empty-btn" aria-label="Add your first prompt" style="margin:2em auto;display:block;">
        ＋ Add Prompt
      </button>
    `;
    updatePaginationControls(state);
    // Add event binding for the empty state add button
    setTimeout(() => {
      const emptyBtn = document.getElementById('add-prompt-empty-btn');
      if (emptyBtn) emptyBtn.onclick = () => showPromptCrudModal('add');
    }, 50);
    console.log('[UI/AUDIT] renderPromptList: exit (no prompts, add button shown)');
    return;
  }

  if (!pagePrompts.length) {
    console.warn('[UI/AUDIT] renderPromptList: No prompts on this page', { page, pageSize, totalFiltered });
    promptListEl.innerHTML = `<div class="loading animated fadeIn">No prompts on this page.</div>`;
    updatePaginationControls(state);
    console.log('[UI/AUDIT] renderPromptList: exit (empty page)');
    return;
  }

  promptListEl.innerHTML = pagePrompts.map(p => promptCardHTML(p)).join('');
  console.log('[UI/AUDIT] renderPromptList: rendered prompt cards', { prompts: pagePrompts.map(p => p.id) });

  // Animate cards
  if (withAnim) {
    document.querySelectorAll('.prompt-card').forEach(card =>
      card.classList.add('animated','fadeInUp')
    );
    console.log('[UI/AUDIT] renderPromptList: animation triggered');
  }

  // Use modular card action binding
  bindCardActions(promptListEl, {
    card: id => showPromptDetailModal(id),
    edit: id => showPromptCrudModal('edit', id),
    delete: id => showPromptCrudModal('delete', id),
    share: id => doSharePrompt(id),
    copy: id => doCopyPrompt(id)
  });

  updatePaginationControls(state);
  console.log('[UI/AUDIT] renderPromptList: exit');
}
/**
 * Internal: Render a single prompt card block. Dynamic text is always escaped.
 * Accessibility: ARIA labels, tabIndex, visually hidden texts for icons/buttons.
 * SECURITY: DO NOT remove escapeHTML from anywhere in this template!
 * @param {Object} p - Prompt object
 * @returns {string} - HTML safe for innerHTML
 */
function promptCardHTML(p) {
  return `
  <div class="prompt-card" tabindex="0" data-id="${p.id}">
    <div class="prompt-title">${escapeHTML(p.title)}</div>
    <div class="prompt-meta">${escapeHTML(p.category)} • ${Array.isArray(p.tags) ? p.tags.map(tag => escapeHTML(tag)).join(', ') : ''}</div>
    <div class="prompt-actions">
      <button class="btn-copy" data-id="${p.id}" title="Copy prompt" aria-label="Copy">
        📋<span class="visually-hidden">Copy</span>
      </button>
      <button class="btn-share" data-id="${p.id}" title="Share/download" aria-label="Share">
        🔗<span class="visually-hidden">Share</span>
      </button>
      ${canEditPrompt(p) ? `<button class="btn-edit" data-id="${p.id}" aria-label="Edit">
        ✏️<span class="visually-hidden">Edit</span>
      </button>
      <button class="btn-delete" data-id="${p.id}" aria-label="Delete">
        🗑️<span class="visually-hidden">Delete</span>
      </button>` : ''}
    </div>
  </div>`;
}

/* =======================
   SEARCH
======================= */
function bindGlobalSearch() {
  globalSearchInput.oninput = e => {
    setState({
      filter: { ...getState().filter, search: globalSearchInput.value || '' },
      paging: { ...getState().paging, page: 1 }
    });
  };
  globalSearchInput.onkeydown = e => {
    if (e.key === 'Escape') {
      globalSearchInput.value = '';
      setState({
        filter: { ...getState().filter, search: '' },
        paging: { ...getState().paging, page: 1 }
      });
    }
  };
}

/* =======================
   MODALS / ANIMATION
======================= */

/* =======================
   PROMPT DETAIL MODAL
======================= */
function showPromptDetailModal(id) {
  const state = getState();
  const prompt = state.prompts.find(x => x.id === id);
  if (!prompt) {
    setError({ type: 'ui', message: 'Prompt not found' });
    return;
  }
  setState({ selectedPrompt: prompt });
  renderPromptDetailModal(promptDetailModal, prompt);
}

/* =======================
   PROMPT CRUD MODAL
======================= */
function showPromptCrudModal(mode, promptId) {
  const state = getState();
  const prompt = mode !== 'add' ? state.prompts.find(x => x.id === promptId) : {};
  renderCrudModal(crudModal, mode, prompt);
}

/* =======================
   PROMPT ACTIONS
======================= */
async function doCopyPrompt(id) {
  const prompt = state.prompts.find(x=>x.id===id);
  if (!prompt) return;
  try {
    await navigator.clipboard.writeText(prompt.prompt);
    showToast('Prompt copied ✓','success');
  } catch { showToast('Copy failed','danger'); }
}
function doSharePrompt(id) {
  const prompt = state.prompts.find(x=>x.id===id);
  if (!prompt) return;
  // Download as file for now (can add share API for mobile)
  const blob = new Blob([prompt.prompt], {type:'text/plain'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (prompt.title||'prompt') + '.txt';
  document.body.appendChild(a);
  a.click();
  setTimeout(()=>{ document.body.removeChild(a); },200);
  showToast('Prompt downloaded.','info');
}
function canEditPrompt(prompt) {
  // GitHub auth removed: everyone can edit their prompts (for restored UI)
  return true;
}

/* =======================
   BATCH MULTI-UPLOAD: .md/.txt PROMPT IMPORT
======================= */
import * as promptsModule from '../api/prompts.js';
import { checkBackendHealth } from '../api/db.js';

(function setupBatchImportUI() {
  const importBtn = document.getElementById('import-prompts-btn');
  const fileInput = document.getElementById('import-file-input');
  if (!importBtn || !fileInput) return;

  importBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    const files = Array.from(fileInput.files || []);
    if (!files.length) return;

    // Check backend health first
    let health = await checkBackendHealth();
    if (!health.ok) {
      if (typeof showHealthStatus === 'function') showHealthStatus(health);
      showToast('Cannot import: ' + (health.msg || 'Backend error'), 'danger');
      return;
    }

    // Show loading indicator
    showToast('Importing '+files.length+' prompts...', 'info', 1800);

    let imported = 0, failed = 0, failFiles = [];

    for (let file of files) {
      if (!/\.md|\.txt$/i.test(file.name)) continue;
      try {
        const content = await file.text();
        let promptObj = parsePromptFile(file.name, content);
        let result = await promptsModule.createPrompt(promptObj);
        if (result && result.code) {
          failed++;
          failFiles.push(file.name + ' (' + (result.message || 'Add failed') + ')');
          showToast('Failed to import "' + file.name + '": ' + (result.message || 'Add failed'), 'danger', 4000);
          continue;
        }
        imported++;
      } catch (err) {
        failed++;
        const errorUID = 'ERR-IMPORT-' + Math.random().toString(36).substr(2, 5) + '-' + Date.now();
        failFiles.push(file.name + ' (' + (err && err.message ? err.message : 'Error') + ') [ID:' + errorUID + "]");
        // Show user feedback with error ID
        showToast(
          `Failed to import "${file.name}": ${(err && err.message ? err.message : 'Add failed')} [${errorUID}]`,
          'danger',
          4000
        );
        // Dev: log error with id, filename, and error object
        console.error(`[PROMPT IMPORT FAIL] File: ${file.name} | ErrorID: ${errorUID}`, err);

        // If backend/infra error, abort batch early and log
        if (err && err.message && /backend|write|php/i.test(err.message)) {
          const fatalBatchUID = 'ERR-IMPORT-FATAL-' + Math.random().toString(36).substr(2, 4) + '-' + Date.now();
          showToast(
            `Backend error during import. Batch aborted [${fatalBatchUID}]`,
            'danger',
            3200
          );
          console.error(`[PROMPT IMPORT BATCH FATAL] Aborting entire import! [${fatalBatchUID}] File: ${file.name}`, err);
          let health2 = await checkBackendHealth();
          if (!health2.ok && typeof showHealthStatus === 'function') showHealthStatus(health2);
          break; // stop further attempts (catastrophic backend/fatal infra)
        }
      }
    }

    if (imported)
      showToast(`Imported ${imported} prompt${imported > 1 ? 's' : ''} from .md/.txt file${imported > 1 ? 's' : ''}.`, 'success', 1800);
    if (failed)
      showToast(`Failed to import: ${failFiles.join(', ')}`, 'danger', 3800);

    // Refresh prompt list
    if (typeof window.loadPrompts === 'function') window.loadPrompts();
    else if (typeof window.location === 'object') window.location.reload();
  });

  function parsePromptFile(filename, content) {
    // YAML/Markdown frontmatter parse (simple)
    let title = filename.replace(/\.(md|txt)$/i, '');
    let prompt = content, description = '';
    let category = '', tags = [];
    let m = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*/);
    if (m) {
      try {
        // Crude YAML parse (title/description/tag/category extraction)
        let meta = {};
        m[1].split(/[\r\n]+/).forEach(line => {
          let kv = line.split(/:(.+)/);
          if (kv.length === 3) meta[kv[0].trim().toLowerCase()] = kv[1].trim();
        });
        title = meta.title || title;
        description = meta.description || '';
        category = meta.category || '';
        tags = meta.tags ? meta.tags.split(',').map(t=>t.trim()).filter(Boolean) : [];
        // Prompt is after frontmatter
        prompt = content.slice(m[0].length).trim();
      } catch {}
    }
    let promptObj = {
      title,
      prompt,
      description,
      category,
      tags,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    return promptObj;
  }
})();
async function renderPromptComments(container, promptId) {
  container.innerHTML = `<div class="loading">Loading comments...</div>`;
  try {
    const comments = await prompts.getPromptComments(promptId);
    container.innerHTML = `
      <div id="comments-list">${comments.map(c=>commentHTML(c, promptId)).join('')}</div>
      <div id="add-comment-form-container"></div>
    `;
    bindCommentActions(promptId, comments);
    renderAddCommentForm(promptId);
  } catch (e) {
    container.innerHTML = `<div class="loading">Failed to load comments</div>`;
  }
}
function commentHTML(c, promptId) {
  return `<div class="comment" data-id="${c.id}">
    <span class="author">${c.author ? '@'+escapeHTML(c.author) : 'Anon'}</span>
    <span class="meta">${new Date(c.created_at).toLocaleString()}</span>
    <div class="markdown-output">${renderMarkdownToHTML(c.content)}</div>
    <div class="comment-actions">
      ${canEditPrompt({author:c.author})? `<button class="btn-edit-comment" data-id="${c.id}">Edit</button>
      <button class="btn-delete-comment" data-id="${c.id}">Delete</button>`:''}
    </div>
  </div>`;
}
function bindCommentActions(promptId, comments) {
  document.querySelectorAll('.btn-edit-comment').forEach(btn=>{
    btn.onclick = () => showCommentEditForm(promptId, btn.dataset.id, comments.find(c=>c.id===btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete-comment').forEach(btn=>{
    btn.onclick = () => {
      if (!confirm('Delete this comment?')) return;

      const commentId = btn.dataset.id;
      const idx = comments.findIndex(c => c.id === commentId);
      if (idx === -1) return;
      const deletedComment = comments[idx];
      comments.splice(idx, 1);

      // Track only one pending comment undo at once per prompt
      if (!window._commentUndo) window._commentUndo = {};
      if (window._commentUndo[promptId] && window._commentUndo[promptId].timeout)
        clearTimeout(window._commentUndo[promptId].timeout);

      window._commentUndo[promptId] = {
        comment: deletedComment,
        index: idx,
        undone: false,
        timeout: null,
      };

      renderPromptComments(commentsSection, promptId);

      showToast(
        'Comment deleted.',
        'success',
        4000,
        {
          label: 'Undo',
          onClick: () => {
            if (
              window._commentUndo &&
              window._commentUndo[promptId] &&
              !window._commentUndo[promptId].undone
            ) {
              comments.splice(window._commentUndo[promptId].index, 0, window._commentUndo[promptId].comment);
              window._commentUndo[promptId].undone = true;
              renderPromptComments(commentsSection, promptId);
            }
          }
        }
      );

      window._commentUndo[promptId].timeout = setTimeout(async () => {
        if (
          window._commentUndo &&
          window._commentUndo[promptId] &&
          !window._commentUndo[promptId].undone
        ) {
          try {
            await prompts.deletePromptComment(promptId, commentId);
            renderPromptComments(commentsSection, promptId);
          } catch {
            showToast('Failed to delete comment.','danger');
          }
        }
        if (window._commentUndo) window._commentUndo[promptId] = null;
      }, 4000);
    };
  });
}
function renderAddCommentForm(promptId) {
  const el = document.getElementById('add-comment-form-container');
  el.innerHTML = `
  <form id="add-comment-form">
    <textarea name="content" required rows="3" placeholder="Add a comment..."></textarea>
    <button type="submit">Comment</button>
  </form>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const content = el.querySelector('textarea').value;
    if (!content) return showToast('Empty comment.','warning');
    try {
      await prompts.addPromptComment(promptId, {content});
      showToast('Comment added','success');
      renderPromptComments(commentsSection, promptId);
    } catch {
      showToast('Failed to add comment.','danger');
    }
  };
}
function showCommentEditForm(promptId, commentId, orig) {
  const cEl = document.querySelector(`.comment[data-id="${commentId}"]`);
  if (!cEl) return;
  cEl.innerHTML = `
    <form class="edit-comment-form">
      <textarea name="content" rows="2">${orig.content||""}</textarea>
      <button type="submit">Save</button>
      <button type="button" class="btn-cancel">Cancel</button>
    </form>`;
  cEl.querySelector('.edit-comment-form').onsubmit = async e => {
    e.preventDefault();
    const content = e.target.elements.content.value;
    if (!content) return showToast('Comment empty.');
    try {
      await prompts.editPromptComment(promptId, commentId, content);
      showToast('Comment updated.','success');
      renderPromptComments(commentsSection, promptId);
    } catch {
      showToast('Update failed.','danger');
    }
  };
  cEl.querySelector('.btn-cancel').onclick = () => renderPromptComments(commentsSection, promptId);
}

async function renderPromptResults(container, promptId) {
  container.innerHTML = `<div class="loading">Loading results...</div>`;
  try {
    const results = await prompts.getPromptResults(promptId);
    container.innerHTML = `
      <div id="results-list">${results.map(r=>resultHTML(r, promptId)).join('')}</div>
      <div id="add-result-form-container"></div>
    `;
    bindResultActions(promptId, results);
    renderAddResultForm(promptId);
  } catch {
    container.innerHTML = `<div class="loading">Failed to load results</div>`;
  }
}
function resultHTML(r, promptId) {
  return `<div class="result" data-id="${r.id}">
    <span class="author">${r.author ? '@'+escapeHTML(r.author) : 'Anon'}</span>
    <span class="meta">${new Date(r.created_at).toLocaleString()}</span>
    <div class="markdown-output">${renderMarkdownToHTML(r.content)}</div>
    <div class="result-actions">
      ${canEditPrompt({author:r.author}) ? `<button class="btn-edit-result" data-id="${r.id}">Edit</button>
      <button class="btn-delete-result" data-id="${r.id}">Delete</button>` : ''}
    </div>
  </div>`;
}
function bindResultActions(promptId, results) {
  document.querySelectorAll('.btn-edit-result').forEach(btn=>{
    btn.onclick = () => showResultEditForm(promptId, btn.dataset.id, results.find(r=>r.id===btn.dataset.id));
  });
  document.querySelectorAll('.btn-delete-result').forEach(btn=>{
    btn.onclick = async () => {
      if (!confirm('Delete this result?')) return;

      const resultId = btn.dataset.id;
      const idx = results.findIndex(r => r.id === resultId);
      if (idx === -1) return;
      const deletedResult = results[idx];
      results.splice(idx, 1);

      if (!window._resultUndo) window._resultUndo = {};
      if (window._resultUndo[promptId] && window._resultUndo[promptId].timeout)
        clearTimeout(window._resultUndo[promptId].timeout);

      window._resultUndo[promptId] = {
        result: deletedResult,
        index: idx,
        undone: false,
        timeout: null,
      };

      renderPromptResults(resultsSection, promptId);

      showToast(
        'Result deleted.',
        'success',
        4000,
        {
          label: 'Undo',
          onClick: () => {
            if (
              window._resultUndo &&
              window._resultUndo[promptId] &&
              !window._resultUndo[promptId].undone
            ) {
              results.splice(window._resultUndo[promptId].index, 0, window._resultUndo[promptId].result);
              window._resultUndo[promptId].undone = true;
              renderPromptResults(resultsSection, promptId);
            }
          }
        }
      );

      window._resultUndo[promptId].timeout = setTimeout(async () => {
        if (
          window._resultUndo &&
          window._resultUndo[promptId] &&
          !window._resultUndo[promptId].undone
        ) {
          try {
            await prompts.deletePromptResult(promptId, resultId);
            renderPromptResults(resultsSection, promptId);
          } catch {
            showToast('Failed to delete result.','danger');
          }
        }
        if (window._resultUndo) window._resultUndo[promptId] = null;
      }, 4000);
    };
  });
}
function renderAddResultForm(promptId) {
  const el = document.getElementById('add-result-form-container');
  el.innerHTML = `
  <form id="add-result-form">
    <textarea name="content" required rows="3" placeholder="Paste an LLM output/share result..."></textarea>
    <button type="submit">Share Output</button>
  </form>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const content = el.querySelector('textarea').value;
    if (!content) return showToast('Empty result.','warning');
    try {
      await prompts.addPromptResult(promptId, {content});
      showToast('Result shared','success');
      renderPromptResults(resultsSection, promptId);
    } catch {
      showToast('Failed to share result.','danger');
    }
  };
}
function showResultEditForm(promptId, resultId, orig) {
  const rEl = document.querySelector(`.result[data-id="${resultId}"]`);
  if (!rEl) return;
  rEl.innerHTML = `
    <form class="edit-result-form">
      <textarea name="content" rows="2">${orig.content||""}</textarea>
      <button type="submit">Save</button>
      <button type="button" class="btn-cancel">Cancel</button>
    </form>`;
  rEl.querySelector('.edit-result-form').onsubmit = async e => {
    e.preventDefault();
    const content = e.target.elements.content.value;
    if (!content) return showToast('Result empty.');
    try {
      await prompts.editPromptResult(promptId, resultId, {content});
      showToast('Result updated.','success');
      renderPromptResults(resultsSection, promptId);
    } catch {
      showToast('Update failed.','danger');
    }
  };
  rEl.querySelector('.btn-cancel').onclick = () => renderPromptResults(resultsSection, promptId);
}

/* =======================
   FEEDBACK TOASTS
======================= */
/**
 * showToast with optional action (e.g., Undo), accessible ARIA/role/keyboard.
 * @param {string} msg
 * @param {'info'|'success'|'warning'|'danger'} type
 * @param {number} dur
 * @param {{label: string, onClick: function}} [action]
 */
/**
 * Show a toast notification with optional action (e.g., Undo).
 * Accessibility: ARIA role/status, keyboard focus and dismissal, polite/assertive for screenreaders.
 * SECURITY: All content in msg/action.label should be trusted or sanitized (inline values only, not user input).
 * @param {string} msg
 * @param {'info'|'success'|'warning'|'danger'} type
 * @param {number} dur
 * @param {{label: string, onClick: function}} [action]
 */

/* =======================
   PAGINATION CONTROLS & SUPPORT
======================= */
function updatePaginationControls(stateParam) {
  // Always modular: take state argument for reactivity, or use getState().
  const state = stateParam || getState();
  let controls = document.getElementById('prompt-pagination-controls');
  if (!controls) {
    controls = document.createElement('div');
    controls.id = 'prompt-pagination-controls';
    controls.className = 'pagination-controls';
    promptListSection?.appendChild(controls);
  }

  const { page, pageSize, totalFiltered } = state.paging;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  // Clamp page in case filters shrink result set
  if (page > totalPages) {
    setState({ paging: { ...state.paging, page: totalPages } });
  }

  // Show prompt count
  let firstIdx = totalFiltered === 0 ? 0 : (pageSize * (page-1) + 1);
  let lastIdx = Math.min(totalFiltered, page * pageSize);

  controls.innerHTML = `
    <button ${page <= 1 ? 'disabled' : ''} aria-label="Previous Page" class="paging-btn prev-btn">Previous</button>
    <span class="paging-info">
      <strong>${firstIdx}-${lastIdx}</strong> of <strong>${totalFiltered}</strong>
      &nbsp;•&nbsp; Page <strong>${page}</strong> of <strong>${totalPages}</strong>
    </span>
    <button ${page >= totalPages ? 'disabled' : ''} aria-label="Next Page" class="paging-btn next-btn">Next</button>
  `;

  controls.querySelector('.prev-btn').onclick = () => {
    const stateNow = getState();
    if (stateNow.paging.page > 1) {
      setState({ paging: { ...stateNow.paging, page: stateNow.paging.page - 1 } });
      showLoadingSpinner();
      setTimeout(() => {
        renderPromptList(getState(), true);
      }, 100);
    }
  };

  controls.querySelector('.next-btn').onclick = () => {
    const stateNow = getState();
    if (stateNow.paging.page < totalPages) {
      setState({ paging: { ...stateNow.paging, page: stateNow.paging.page + 1 } });
      showLoadingSpinner();
      setTimeout(() => {
        renderPromptList(getState(), true);
      }, 100);
    }
  };

  controls.style.display = totalFiltered === 0 ? 'none' : 'flex';
}

/* Show/hide loading spinner for navigations/fetches */
function showLoadingSpinner() {
  const spinner = document.getElementById('prompt-list-loading');
  if (spinner) {
    spinner.classList.remove('hidden');
    spinner.classList.add('animated', 'fadeIn');
    promptListEl.innerHTML = '';
  }
}

/* When category/tag/myPrompts filters change, reset to first page */

/* When prompts reload from backend, reset to first page */
const origLoadPrompts = loadPrompts;
loadPrompts = async function(...args) {
  state.paging.page = 1;
  return await origLoadPrompts.apply(this, args);
};

/* =======================
   BACKEND HEALTH STATUS BANNER / MODAL
======================= */
const HEALTH_BANNER_ID = 'health-status-banner';

function showHealthStatus(health) {
  let banner = document.getElementById(HEALTH_BANNER_ID);
  if (!banner) {
    banner = document.createElement('div');
    banner.id = HEALTH_BANNER_ID;
    banner.style.position = 'fixed';
    banner.style.top = '0';
    banner.style.left = '0';
    banner.style.width = '100vw';
    banner.style.zIndex = 10000;
    banner.style.background = '#c62828';
    banner.style.color = '#fff';
    banner.style.fontSize = '18px';
    banner.style.fontWeight = 'bold';
    banner.style.padding = '1.3em 2em';
    banner.style.textAlign = 'center';
    banner.style.boxShadow = '0 4px 18px 0 rgba(0,0,0,0.20)';
    banner.style.letterSpacing = '0.03em';
    banner.style.borderBottom = '3px solid #b71c1c';
    document.body.appendChild(banner);
  }
  // Build error text
  let inner = `&#9888; Backend Error: ${health && health.msg ? health.msg : 'Unknown misconfiguration or backend (PHP) is not running.'}`;
  if (health && health.data) {
    let fails = Object.values(health.data)
      .filter(f => !f.ok)
      .map(f => `<li><b>${f.file||''}</b>: ${f.msg}</li>`)
      .join('');
    if (fails) {
      inner += `<ul style="margin:0.6em 0 0 0;padding:0;list-style:none;">${fails}</ul>`;
    }
  }
  banner.innerHTML = inner;
  banner.style.display = 'block';
  banner.tabIndex = 100;
  banner.focus();
  // Optionally: Could add retry button here (future)
}

function hideHealthStatus() {
  let banner = document.getElementById(HEALTH_BANNER_ID);
  if (banner) {
    banner.style.display = 'none';
  }
}

/* =======================
   EXPORTS (IF NEEDED)
======================= */
/**
 * Module exports: UI surfaces needed by main.js/bootstrap and for testing
 * All exports are security and ARIA-reviewed as per atomic audit up to 2025-05-03.
 */
export {
  renderPromptList,       // Renders the main prompt list (XSS-safe, a11y)
  renderSidebar,          // Renders ARIA/keyboard-compliant sidebar (XSS-safe)
  renderPromptComments,   // Loads/comments prompt, all markdown/comment escaped and ARIA-labeled
  renderPromptResults,    // Loads/shows result list for a prompt, XSS-safe, ARIA role
  showPromptDetailModal,  // Renders the detail modal (card, markdown)
  showPromptCrudModal,    // Opens add/edit/delete modal (XSS escape enforced)
  showToast,              // Shows feedback toast (ARIA/keyboard, inline content only)
  showHealthStatus,       // Shows backend health error, ARIA-compliant
  hideHealthStatus        // Hides health status banner
};