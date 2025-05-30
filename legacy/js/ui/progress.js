/**
 * progress.js
 * Progress bar/indicator component for long-running imports and operations.
 * Exports pure functions; stateless except for passed-in state/context.
 * SECURITY: All user content (label) should be sanitized or trusted—current direct injection is only safe if label is never user-supplied.
 * ACCESSIBILITY: Fully ARIA-compliant; role/progress structure and screenreader live regions implemented.
 *
 * @module progress
 */

/**
 * Render the progress bar/component.
 * @param {HTMLElement} container
 * @param {Object} state - { current: number, total: number, label?: string, running?: boolean }
 */
/**
 * Render the ARIA-compliant progress bar/component.
 * Accessibility: Uses role="progressbar", aria-valuenow/min/max, and live region for updates.
 * SECURITY: The label param should not be set to untrusted user input (not escaped).
 * @param {HTMLElement} container
 * @param {Object} state - { current: number, total: number, label?: string, running?: boolean }
 */
export function renderProgress(container, state = {}) {
  if (!container) return;
  const { current = 0, total = 0, label = '', running = false } = state;
  // ARIA-compliant progressbar
  container.innerHTML = `
    <div class="progressbar-wrapper" role="progressbar"
         aria-valuenow="${current}"
         aria-valuemin="0"
         aria-valuemax="${total}"
         tabindex="0"
         aria-live="assertive"
         aria-label="${label || (running ? 'Loading...' : 'Idle')} ${total > 0 ? `(${current} of ${total})` : ''}">
      <div class="progressbar-track">
        <div class="progressbar-bar" style="width:${total > 0 ? ((current/total)*100).toFixed(2) : 0}%;"></div>
      </div>
      <span class="progressbar-label">
        ${label || (running ? 'Loading...' : 'Idle')}
        ${total > 0 ? ` (${current} / ${total})` : ''}
      </span>
    </div>
  `;
  container.classList.remove('hidden');
}

/**
 * Update the progress state/view.
 * @param {HTMLElement} container
 * @param {Object} state
 */
/**
 * Update the current progress bar to the latest state/step.
 * @param {HTMLElement} container
 * @param {Object} state
 */
export function updateProgress(container, state = {}) {
  renderProgress(container, state);
}

/**
 * Destroy/remove the progress component from UI.
 * @param {HTMLElement} container
 */
/**
 * Destroy/remove the progress component from the UI.
 * @param {HTMLElement} container
 */
export function destroyProgress(container) {
  if (!container) return;
  container.innerHTML = '';
  container.classList.add('hidden');
}

/**
 * Dev/test helper to simulate progress for UX testing.
 * @param {HTMLElement} container
 * @param {string} scenario - 'importing'|'error'|'complete'
 */
/**
 * DEV/TEST ONLY: helper to simulate progress scenarios for UX/unit testing.
 * Not for use in production.
 * @param {HTMLElement} container
 * @param {string} scenario - 'importing'|'error'|'complete'
 */
export function devSimulateProgressState(container, scenario) {
  if (!container) return;
  if (scenario === 'importing') {
    renderProgress(container, { current: 2, total: 10, label: 'Importing...', running: true });
  } else if (scenario === 'complete') {
    renderProgress(container, { current: 10, total: 10, label: 'Import complete', running: false });
  } else if (scenario === 'error') {
    container.innerHTML = '<div class="progress-error" role="alert">Progress bar error:</div>';
  }
}