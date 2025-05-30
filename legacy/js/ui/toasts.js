/**
 * Toast notifications (ARIA, focus, action support) for the PromptShare UI.
 * export { showToast }
 */

/**
 * Show a toast notification with optional action (Undo, etc).
 * @param {string} msg
 * @param {'info'|'success'|'warning'|'danger'} type
 * @param {number} dur
 * @param {{label: string, onClick: function}} [action]
 */
export function showToast(msg, type = 'info', dur = 2900, action) {
  // Fallback for missing toastEl: always surface catastrophic UI errors!
  let te = window.toastEl || document.getElementById('toast');
  if (!te) {
    let fallback = document.getElementById('fatal-toast-fallback');
    if (!fallback) {
      fallback = document.createElement('div');
      fallback.id = 'fatal-toast-fallback';
      fallback.style.position = "fixed";
      fallback.style.top = "0";
      fallback.style.left = "0";
      fallback.style.width = "100vw";
      fallback.style.zIndex = "99999";
      fallback.style.background = type === 'danger' ? "#b71c1c" : (type === 'success' ? "#2e7d32" : "#01579b");
      fallback.style.color = "#fff";
      fallback.style.fontSize = "19px";
      fallback.style.fontWeight = "bold";
      fallback.style.padding = "1.1em 2em";
      fallback.style.textAlign = "center";
      fallback.innerText = msg;
      document.body.appendChild(fallback);
      setTimeout(() => {
        fallback && fallback.parentNode && fallback.parentNode.removeChild(fallback);
      }, dur);
    } else {
      fallback.innerText = msg;
      fallback.style.background = type === 'danger' ? "#b71c1c" : (type === 'success' ? "#2e7d32" : "#01579b");
      setTimeout(() => {
        fallback && fallback.parentNode && fallback.parentNode.removeChild(fallback);
      }, dur);
    }
    // Always log error, always exit
    console.error('[showToast fallback]', { type, msg });
    return;
  }
  // Regular toast logic
  if (te._timeout) clearTimeout(te._timeout);
  te.innerHTML =
    `<span class="toast-msg">${msg}</span>` +
    (action
      ? `<button class="toast-action" type="button" tabindex="0">${action.label}</button>`
      : '');
  te.className = `toast toast-${type}${action ? ' toast-actionable' : ''} animated fadeIn`;
  te.setAttribute('role', type === 'danger' ? 'alert' : 'status');
  te.setAttribute('aria-live', type === 'danger' ? 'assertive' : 'polite');
  te.hidden = false;
  // Make focusable for screen readers/keyboard
  te.tabIndex = 0;

  let dismissed = false;
  let cleanup = () => {
    if (dismissed) return;
    dismissed = true;
    te.classList.add('fadeOut');
    setTimeout(() => {
      te.hidden = true;
      te.className = 'toast hidden';
      te.tabIndex = -1;
      te.innerHTML = '';
    }, 330);
    if (action && typeof action.cleanup === 'function') action.cleanup();
  };
  te._timeout = setTimeout(cleanup, dur);

  // Focus for a11y, unless action present (focus Undo)
  setTimeout(() => {
    if (action) {
      const btn = te.querySelector('.toast-action');
      if (btn) btn.focus();
    } else {
      te.focus();
    }
  }, 30);

  if (action) {
    const btn = te.querySelector('.toast-action');
    let acted = false;
    btn.addEventListener('click', (e) => {
      if (acted) return;
      acted = true;
      if (typeof action.onClick === 'function') action.onClick();
      cleanup();
      e.preventDefault();
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        btn.click();
      } else if (e.key === 'Escape') {
        cleanup();
      }
    });
    // ESC on toast container closes toast
    te.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cleanup();
    });
  } else {
    // ESC always closes if no action
    te.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cleanup();
    });
  }
}