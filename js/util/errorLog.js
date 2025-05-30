// errorLog.js
// [AUDITFIX] Persistent error log utility using localStorage

const STORAGE_KEY = 'app_error_log';

export function logError(message, context = '') {
  const entry = {
    message,
    context,
    time: new Date().toISOString()
  };
  const log = getErrorLog();
  log.push(entry);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

export function getErrorLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function clearErrorLog() {
  localStorage.removeItem(STORAGE_KEY);
}