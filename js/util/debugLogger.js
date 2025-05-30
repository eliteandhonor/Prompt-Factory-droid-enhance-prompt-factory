// debugLogger.js
// Unified debug logging utility: logs to console, localStorage, and POSTs critical errors to backend
// Enforces strict schema and size limits for backend compatibility

const STORAGE_KEY = 'app_debug_log';
const CRITICAL_ENDPOINT = '/api/log.php'; // fallback to /Logger.php if not present

const ALLOWED_LEVELS = ['info', 'warn', 'error', 'debug'];
const MAX_MESSAGE_LENGTH = 500;
const MAX_CONTEXT_SIZE = 2048; // bytes (2KB)

function saveToLocalStorage(entry) {
  try {
    const log = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    log.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
  } catch (e) {
    // Fails silently
  }
}

export function debugLog(...args) {
  if (window && window.console) {
    console.debug('[DEBUG]', ...args);
  }
}

export function logError(message, context = '') {
  const entry = {
    type: 'error',
    message,
    context,
    time: new Date().toISOString()
  };
  if (window && window.console) {
    console.error('[ERROR]', message, context);
  }
  saveToLocalStorage(entry);
}

export function logCriticalError(message, context = '', extra = {}) {
  // Map type to level and enforce allowed levels
  let level = 'error';
  if (extra && typeof extra.level === 'string' && ALLOWED_LEVELS.includes(extra.level.toLowerCase())) {
    level = extra.level.toLowerCase();
  }
  // Enforce message length
  if (typeof message !== 'string' || message.length > MAX_MESSAGE_LENGTH) {
    if (window && window.console) {
      console.warn(`[CRITICAL] Log message too long (max ${MAX_MESSAGE_LENGTH} chars). Log not sent.`);
    }
    if (window && window.showToast) {
      window.showToast(`Log message too long (max ${MAX_MESSAGE_LENGTH} chars).`, 'warning');
    }
    return;
  }
  // Enforce context size
  let safeContext = context;
  let contextJson = '';
  if (typeof context !== 'undefined') {
    try {
      contextJson = JSON.stringify(context);
      if (contextJson.length > MAX_CONTEXT_SIZE) {
        if (window && window.console) {
          console.warn(`[CRITICAL] Log context too large (max ${MAX_CONTEXT_SIZE} bytes). Log not sent.`);
        }
        if (window && window.showToast) {
          window.showToast(`Log context too large (max ${MAX_CONTEXT_SIZE} bytes).`, 'warning');
        }
        return;
      }
    } catch {
      contextJson = '';
      safeContext = null;
    }
  }
  const entry = {
    level,
    message,
    context: safeContext,
    time: new Date().toISOString()
  };
  if (window && window.console) {
    console.error('[CRITICAL]', message, safeContext, extra);
  }
  saveToLocalStorage(entry);

  // POST to backend for aggregation
  fetch(CRITICAL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry)
  }).catch(() => {
    // Fails silently
  });
}

export function getDebugLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function clearDebugLog() {
  localStorage.removeItem(STORAGE_KEY);
}