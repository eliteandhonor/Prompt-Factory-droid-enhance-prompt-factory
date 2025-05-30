// db.js - ES6 Module for App Database Operations (refactored)
// Handles CRUD via PHP API or local fallback; all config from config.js

import CONFIG from '../config.js';
import { uuidv4 } from '../util/helpers.js';

import { getCurrentUserId, canEdit, isAdmin } from '../auth/session.js'; // Attribution & RBAC groundwork
export { getCurrentUserId };

/**
 * Allowed entity types for DB operations.
 * TODO: Centralize to config.js if API expands.
 * SECURITY: Only those types are exposed to API calls.
 */
const DB_TYPES = ['prompts', 'comments', 'results'];

/** PHP endpoint is relative to apiEndpoint in CONFIG */
const DB_PHP = 'db.php';

/**
 * Utility function to build full API endpoint.
 * @param {string} path
 * @returns {string}
 */
function apiUrl(path) {
  // Ensure apiEndpoint always ends with /
  let base = CONFIG.apiEndpoint;
  if (!base.endsWith('/')) base += '/';
  return base + path;
}

/**
 * Validate type and action for API.
 * @param {string} type
 * @param {string} action
 */
function validateTypeAction(type, action) {
  if (!DB_TYPES.includes(type))
    throw new Error(`INVALID_TYPE: Type "${type}" not allowed. Allowed: ${DB_TYPES.join(', ')}`);
  if (typeof action !== 'string')
    throw new Error('INVALID_ACTION: Action must be a string');
}

/**
 * Wrap error for propagation.
 * @param {string} code 
 * @param {string} message 
 * @param {*} details 
 */
/**
 * Uniform error helper (returns Error with custom fields).
 * Ensures stack trace and async hygiene.
 */
function makeError(code, message, details) {
  const err = new Error(message || code || 'Unknown error');
  err.code = code;
  if (details) err.details = details;
  return err;
}

/**
 * Simulate error/latency/data in dev mode for automated/QA test.
 * Plug in more elaborate simulation as needed.
 */
export function devTestHook({ simulateError = false, simulateLatencyMs = 0, data = null } = {}) {
  return new Promise((resolve, reject) => {
    if (simulateLatencyMs > 0) {
      setTimeout(() => simulateError ? reject(makeError('DEV_TEST', 'Simulated error', data)) : resolve(data), simulateLatencyMs);
    } else {
      simulateError ? reject(makeError('DEV_TEST', 'Simulated error', data)) : resolve(data);
    }
  });
}

/**
 * General DB API operation (PHP backend or fallback to local).
 * All errors propagate with code/message/details.
 * @param {string} type - entity type ('prompts', etc.)
 * @param {string} action - CRUD action ('list', 'add', 'edit', 'delete')
 * @param {object|null} payload
 * @returns {Promise<*>}
 */
export async function apiReq(type, action, payload = null) {
  validateTypeAction(type, action);

  const opts = {
    method: action === 'list' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
  };
  let url = apiUrl(DB_PHP) + `?type=${encodeURIComponent(type)}&action=${encodeURIComponent(action)}`;
  if (opts.method === 'POST') opts.body = JSON.stringify({ ...(payload || {}), type, action });

  try {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      // Only fallback to local for GET/list actions (offline/test only)
      if (opts.method === 'GET') return _localApiReq(type, action, payload);
      throw makeError('HTTP_ERROR', `Server returned ${resp.status}`, { url, status: resp.status });
    }
    const js = await resp.json().catch(() =>
      ({ ok: false, msg: 'Bad JSON from server', code: 'BAD_JSON' })
    );
    if (!js.ok) {
      if (opts.method === 'GET') return _localApiReq(type, action, payload);
      throw makeError('API_FAIL', js.msg || 'API returned failure', js);
    }
    return js.data;
  } catch (e) {
    if (opts.method === 'GET') return _localApiReq(type, action, payload);
    // Surface network failure to user via toast/banner
    if (typeof window !== "undefined" && typeof window.showToast === "function") {
      window.showToast("Network error: Failed to complete your request. Please try again.", "danger");
    }
    throw makeError(
      e.code || 'NETWORK_FAIL',
      e.message || 'Could not reach backend',
      e.details || e
    );
  }
}

// ===== LOCAL fallback store (private) =====
const DB_NAME = 'prompts-db', STORE_NAME = 'prompts', DB_VERSION = 1;
let dbPromise = null;

/**
 * Open (and upgrade if needed) IndexedDB.
 * @returns {Promise<IDBDatabase|null>}
 */
function getDb() {
  if (!('indexedDB' in window)) return null;
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = event => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME))
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const LS_KEY = 'prompts:all';

/**
 * Fallback local API for offline/testing.
 * Only handles 'prompts' - extendable for other types.
 */
async function _localApiReq(type, action, payload) {
  if (type !== 'prompts') return [];
  // UUID util – migrate to util/ if reused elsewhere
  function loadAllLS() {
    const s = localStorage.getItem(LS_KEY);
    return s ? JSON.parse(s) : [];
  }
  try {
    switch (action) {
      case 'list': return loadAllLS();
      case 'add': {
        let o = { ...payload.entry }; o.id = o.id || uuidv4();
        const all = loadAllLS(); all.push(o); localStorage.setItem(LS_KEY, JSON.stringify(all)); return all;
      }
      case 'edit': {
        const all = loadAllLS();
        let idx = all.findIndex(p => p.id === payload.id);
        if (idx < 0) throw makeError('NOT_FOUND', 'Prompt not found', payload.id);
        all[idx] = { ...all[idx], ...payload.entry }; localStorage.setItem(LS_KEY, JSON.stringify(all)); return all;
      }
      case 'delete': {
        const all = loadAllLS().filter(p => p.id !== payload.id); localStorage.setItem(LS_KEY, JSON.stringify(all)); return all;
      }
      default: return [];
    }
  } catch (e) {
    throw makeError(e.code || 'LOCAL_FAIL', e.message || 'Local operation failed', e.details || e);
  }
}

// ===== PROMPT API (Surface: all exported functions for CRUD/lookup) =====

/**
 * Create a new prompt record.
 * @param {object} promptObj
 * @returns {Promise<object>} Created prompt
 */
/**
 * Create a new prompt record.
 * Enforces id, created_at, updated_at; returns the object on success.
 * Errors: { code, message, details }, throws on invalid input.
 */
/**
 * Create a new prompt record, with attribution/session assignment.
 * Attribution: user_id is always set using getCurrentUserId (see session.js).
 * 'author' is for future display/legacy only and optional; always set user_id.
 */
export async function createPrompt(promptObj) {
  if (!promptObj || typeof promptObj !== 'object')
    throw makeError('VALIDATION', 'Prompt must be an object', promptObj);

  // Begin stabilization patch: Ensure valid and full schema.
  const prompt = { ...promptObj };
  const now = new Date().toISOString();
  if (!prompt.id) prompt.id = uuidv4();
  if (!prompt.created_at) prompt.created_at = now;
  prompt.updated_at = now;

  // ENFORCE schemaVersion - required by backend, always present now
  if (!prompt.schemaVersion) prompt.schemaVersion = "v2025.1";

  // Enforce 'tags' array type
  if (!Array.isArray(prompt.tags)) prompt.tags = prompt.tags && typeof prompt.tags === "string" && prompt.tags.length ? [prompt.tags] : [];

  // Defensive: Guarantee required fields toast/fallbacks if missing
  if (!prompt.title || typeof prompt.title !== "string") prompt.title = "(Untitled)";
  if (!prompt.description || typeof prompt.description !== "string") prompt.description = "(No description)";
  if (!prompt.prompt || typeof prompt.prompt !== "string") prompt.prompt = "";

  // Attribution/session
  prompt.user_id = getCurrentUserId && typeof getCurrentUserId === "function" ? getCurrentUserId() : "anon";
  if (!prompt.author) prompt.author = prompt.user_id === 'anon' ? 'anonymous' : prompt.user_id;

  // Extra diagnostic logging, strict error feedback to UI+console during stabilization
  try {
    const result = await apiReq('prompts', 'add', { entry: prompt });
    // Diagnostic: log success for audit
    // eslint-disable-next-line no-console
    console.log("[DIAG] Prompt add successful (ID:", prompt.id, ")", result);
    return prompt;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[CRITICAL ERR] Failed to add prompt", prompt, err);
    // Always show in UI during stabilization (remove after bugfix audit)
    if (typeof window !== 'undefined' && window.alert) {
      window.alert("ERROR: Unable to add prompt (" + (err?.message || err) + ").\nCheck Console for details.");
    }
    // Consider future UI error banner here
    throw err;
  }
}

/**
 * Read a single prompt by ID.
 * @param {string} id
 * @returns {Promise<object|null>}
 */
export async function readPrompt(id) {
  if (!id) throw makeError('VALIDATION', 'ID is required', id);
  const all = await apiReq('prompts', 'list');
  return all.find(p => p.id === id) || null;
}

/**
 * Update an existing prompt.
 * @param {object} promptObj
 * @returns {Promise<object>} Updated prompt
 */
/**
 * Update a prompt by object (must contain id).
 * Ensures updated_at is refreshed; returns updated obj on success.
 * Throws { code, message, details } for validation errors.
 */
/**
 * Update a prompt record, always routing attribution through getCurrentUserId.
 */
export async function updatePrompt(promptObj) {
  if (!promptObj || typeof promptObj !== 'object')
    throw makeError('VALIDATION', 'Prompt must be an object', promptObj);
  if (!promptObj.id)
    throw makeError('VALIDATION', 'ID is required for update', promptObj);
  const updated = { ...promptObj, updated_at: new Date().toISOString() };
  updated.user_id = getCurrentUserId();
  if (!updated.author) updated.author = updated.user_id === 'anon' ? 'anonymous' : updated.user_id;
  // Optionally: check canEdit(updated) here for local UI access control (enforced server-side for real, RBAC stub now)
  await apiReq('prompts', 'edit', { id: updated.id, entry: updated });
  return updated;
}

/**
 * Delete a prompt by ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
/**
 * Delete a prompt by id.
 * Throws { code, message, details } for validation errors.
 */
export async function deletePrompt(id) {
  if (!id) throw makeError('VALIDATION', 'ID is required', id);
  await apiReq('prompts', 'delete', { id });
}

/**
 * List all prompts.
 * @returns {Promise<object[]>}
 */
/**
 * List all prompts (array of prompt objects).
 */
export async function listPrompts() {
  return await apiReq('prompts', 'list');
}

/**
 * Get all unique prompt categories.
 * @returns {Promise<string[]>}
 */
/**
 * Return all unique prompt categories (array of strings).
 */
export async function listCategories() {
  const all = await listPrompts();
  return [...new Set(all.map(p => p.category).filter(Boolean))];
}

/**
 * Get all unique prompt tags.
 * @returns {Promise<string[]>}
 */
/**
 * Return all unique prompt tags (array of strings).
 */
export async function listTags() {
  const all = await listPrompts();
  const tags = new Set();
  all.forEach(p => Array.isArray(p.tags) && p.tags.forEach(t => tags.add(t)));
  return [...tags];
}

/**
 * Filter prompts by category.
 * @param {string} category
 * @returns {Promise<object[]>}
 */
/**
 * Filter prompts by category (returns matching prompt objects).
 */
export async function filterPromptsByCategory(category) {
  if (!category) throw makeError('VALIDATION', 'Category is required', category);
  const all = await listPrompts();
  return all.filter(p => p.category === category);
}

/**
 * Filter prompts by tag.
 * @param {string} tag
 * @returns {Promise<object[]>}
 */
/**
 * Filter prompts by tag (returns matching prompt objects).
 */
export async function filterPromptsByTag(tag) {
  if (!tag) throw makeError('VALIDATION', 'Tag is required', tag);
  const all = await listPrompts();
  return all.filter(p => Array.isArray(p.tags) && p.tags.includes(tag));
}

// ===== Health Polling Stub for future usage =====

/**
 * Health polling for the backend API (FUTURE: expand for system-level checks).
 * Exposes a health check now for wiring by main.js.
 * @returns {Promise<{ok: boolean, msg?: string, data?: any}>}
 */
export async function checkBackendHealth() {
  try {
    // Use standard URL behaviour; in the future may call alternative endpoints.
    const resp = await fetch(apiUrl(DB_PHP) + '?action=health', { method: 'GET' });
    if (!resp.ok) throw makeError('HEALTH_HTTP', 'Healthcheck HTTP error', resp.status);
    const js = await resp.json();
    return js; // Shape: {ok, msg, data}
  } catch (e) {
    return { ok: false, msg: 'Backend unreachable', data: e };
  }
}