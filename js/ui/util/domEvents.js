/**
 * domEvents.js - Centralized DOM event utilities for UI (2025 Audit Overhaul)
 * Provides robust, accessible, and debuggable event handling for all UI modules.
 * All debug output uses debugLog from helpers.js for consistency.
 * Follows best practices for maintainability, modularity, and accessibility.
 */

import { debugLog } from '../../util/helpers.js';

/**
 * Attach an event listener with debug logging.
 * @param {EventTarget} target - The target element or window.
 * @param {string} type - Event type (e.g., 'click').
 * @param {Function} handler - Event handler function.
 * @param {Object|boolean} [options] - Listener options.
 */
export function addEvent(target, type, handler, options) {
  if (!target || !type || !handler) {
    debugLog('[domEvents] addEvent: missing parameter', { target, type, handler });
    return;
  }
  target.addEventListener(type, handler, options);
  debugLog(`[domEvents] addEvent: attached '${type}'`, { target, handler, options });
}

/**
 * Remove an event listener with debug logging.
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 * @param {Object|boolean} [options]
 */
export function removeEvent(target, type, handler, options) {
  if (!target || !type || !handler) {
    debugLog('[domEvents] removeEvent: missing parameter', { target, type, handler });
    return;
  }
  target.removeEventListener(type, handler, options);
  debugLog(`[domEvents] removeEvent: detached '${type}'`, { target, handler, options });
}

/**
 * Attach an event handler that runs only once (idempotent).
 * Removes any previous identical handler before adding.
 * @param {EventTarget} target
 * @param {string} type
 * @param {Function} handler
 * @param {Object|boolean} [options]
 */
export function addEventOnce(target, type, handler, options) {
  if (!target || !type || !handler) {
    debugLog('[domEvents] addEventOnce: missing parameter', { target, type, handler });
    return;
  }
  target.removeEventListener(type, handler, options);
  target.addEventListener(type, handler, options);
  debugLog(`[domEvents] addEventOnce: attached '${type}' (idempotent)`, { target, handler, options });
}

/**
 * Event delegation utility.
 * @param {Element} parent - Parent element to delegate from.
 * @param {string} selector - CSS selector for matching children.
 * @param {string} type - Event type.
 * @param {Function} handler - Handler receives (event, matchedElement).
 * @param {Object|boolean} [options]
 */
export function delegate(parent, selector, type, handler, options) {
  if (!parent || !selector || !type || !handler) {
    debugLog('[domEvents] delegate: missing parameter', { parent, selector, type, handler });
    return;
  }
  const delegatedHandler = (event) => {
    const target = event.target.closest(selector);
    if (target && parent.contains(target)) {
      debugLog(`[domEvents] delegate: '${type}' on`, target);
      handler(event, target);
    }
  };
  parent.addEventListener(type, delegatedHandler, options);
  debugLog(`[domEvents] delegate: attached '${type}' for selector '${selector}'`, { parent, handler, options });
  return delegatedHandler; // For possible removal
}

/**
 * Debounce utility for event handlers.
 * @param {Function} fn - Function to debounce.
 * @param {number} delay - Delay in ms.
 * @returns {Function}
 */
export function debounce(fn, delay = 150) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      debugLog('[domEvents] debounce: function fired', { fn, args });
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * Throttle utility for event handlers.
 * @param {Function} fn - Function to throttle.
 * @param {number} limit - Minimum time between calls in ms.
 * @returns {Function}
 */
export function throttle(fn, limit = 100) {
  let inThrottle;
  return function (...args) {
    if (!inThrottle) {
      debugLog('[domEvents] throttle: function fired', { fn, args });
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Utility for keyboard accessibility: triggers handler on Enter/Space.
 * @param {Function} handler - Receives (event, element)
 * @returns {Function}
 */
export function handleKeyActivation(handler) {
  return function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      debugLog('[domEvents] handleKeyActivation: key pressed', { key: e.key, element: e.target });
      handler(e, e.target);
    }
  };
}

/**
 * Accessibility note:
 * All event utilities are designed to support ARIA and keyboard navigation.
 * Use handleKeyActivation for custom buttons/links to ensure full keyboard support.
 * Always provide aria-labels and roles where appropriate.
 */

debugLog('[domEvents] domEvents.js loaded');