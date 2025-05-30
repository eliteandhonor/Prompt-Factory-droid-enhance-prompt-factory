// store.js - Minimal observable app state micro-store for PromptShare
// Pattern: Vanilla JS, no framework, supports modular subscribe/dispatch, undo, error/fallback state.
// All UI and data modules can import/use this as the central state mechanism.

let state = {
  prompts: [],
  categories: [],
  tags: [],
  filter: { category: null, tag: null, search: '', myPrompts: false, view: 'grid' },
  selectedPrompt: null,
  currentUser: null,
  paging: { page: 1, pageSize: 24, totalFiltered: 0 },
  // UI meta
  loading: false,
  lastError: null    // { type, message, details, fallbackAction }
};

// Subscribers: fn(state, patch) => void
const subscribers = new Set();

// Get current state (shallow clone)
export function getState() {
  return { ...state };
}

// Subscribe to state changes (returns unsubscribe)
export function subscribe(fn) {
  subscribers.add(fn);
  // Immediately call with the current state, so UI is always in sync.
  fn(getState(), {});
  return () => subscribers.delete(fn);
}

// Set (patch) state with partial update. Notifies all subscribers. Accepts a shallow patch object.
export function setState(patch, options = {}) {
  const prev = { ...state };
  state = { ...state, ...patch };
  // Special merge for nested filter/paging if present in patch:
  if (patch.filter) state.filter = { ...prev.filter, ...patch.filter };
  if (patch.paging) state.paging = { ...prev.paging, ...patch.paging };
  // Optionally emit only if state changed
  if (options.silent) return;
  for (let fn of subscribers) fn(getState(), patch);
}

// Reset the entire state (for dev/test, etc.)
export function resetState(next = {}) {
  state = { ...state, ...next };
  for (let fn of subscribers) fn(getState(), {});
}

// Report an error, update error state, and notify subscribers
export function setError({ type = '', message = '', details = null, fallbackAction = null }) {
  state.lastError = { type, message, details, fallbackAction };
  for (let fn of subscribers) fn(getState(), { lastError: state.lastError });
}

// Clear error/fallback state
export function clearError() {
  state.lastError = null;
  for (let fn of subscribers) fn(getState(), { lastError: null });
}

/**
 * Usage (in modules):
 *   import { getState, subscribe, setState, setError, clearError } from './state/store.js';
 *   subscribe((newState, patch) => { ... }) // called whenever state updates
 *   setState({ prompts: [] }); // to mutate part of state
 *   setError({ type: 'load', message: 'Failed to fetch', details: ... });
 */

// For reactivity/extensibility, modules may define their own selectors/effects