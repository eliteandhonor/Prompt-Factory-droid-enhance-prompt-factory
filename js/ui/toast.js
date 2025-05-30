/**
 * ui/toast.js - Toast/feedback notifications (2025 Rebuild)
 * Provides accessible, modular toast notifications with full debug logging.
 * All debug output uses debugLog from helpers.js for consistency.
 */

import { debugLog } from '../util/helpers.js';

/** @type {number|null} */
let hideTimeoutId = null;

/**
 * Get the toast element from the DOM.
 * @returns {HTMLElement|null}
 */
function getToastElement() {
  const toast = document.getElementById('toast');
  if (!toast) {
    debugLog('[TOAST] getToastElement: toast element not found in DOM');
    return null;
  }
  return toast;
}

/**
 * Hide the toast element and log the action.
 * @param {HTMLElement} toast
 */
function hideToast(toast) {
  if (!toast) return;
  toast.classList.add('hidden');
  debugLog('[TOAST] visible: false, class:', toast.className);
}

/**
 * Show a toast notification with the given message and options.
 * @param {string} message - The message to display.
 * @param {Object} [options]
 * @param {string} [options.type='info'] - Toast type: 'info', 'success', 'danger', 'error', etc.
 * @param {number} [options.duration=2500] - Duration in ms.
 */
export function showToast(message, { type = 'info', duration = 2500 } = {}) {
  debugLog('[TOAST] showToast called', { message, type, duration });
  const toast = getToastElement();
  if (!toast) {
    debugLog('[TOAST] showToast: aborting, toast element missing');
    return;
  }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');

  // Accessibility: Use role="alert" and aria-live="assertive" for errors, else status/polite
  if (type === 'danger' || type === 'error') {
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'assertive');
    // Optionally, focus the toast for screen readers
    toast.setAttribute('tabindex', '-1');
    toast.focus();
  } else {
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.removeAttribute('tabindex');
  }

  debugLog('[TOAST] visible: true, role:', toast.getAttribute('role'), 'class:', toast.className);

  // Ensure toast is always visible for at least 1200ms for test reliability
  const minVisible = Math.max(duration, 1200);

  if (hideTimeoutId !== null) clearTimeout(hideTimeoutId);
  hideTimeoutId = setTimeout(() => {
    hideToast(toast);
  }, minVisible);
}

/**
 * Listen for custom 'showToast' events to show toast from anywhere.
 */
window.addEventListener('showToast', (e) => {
  debugLog('[TOAST] showToast event handler fired', e);
  const { message, type, duration } = e.detail || {};
  showToast(message, { type, duration });
});