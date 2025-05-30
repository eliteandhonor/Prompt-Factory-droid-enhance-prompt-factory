/**
 * showConfirmModal - Show a modal confirmation dialog.
 * @param {string} message - The confirmation message.
 * @param {Object} [options] - Optional config (title, confirmText, cancelText).
 * @returns {Promise<boolean>} Resolves true if confirmed, false if cancelled.
 */
export function showConfirmModal(
  message,
  options = {}
) {
  return new Promise((resolve) => {
    // Remove any existing confirm modal
    let modal = document.getElementById('confirm-modal');
    if (modal) modal.remove();

    // Create modal container
    modal = document.createElement('div');
    modal.id = 'confirm-modal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-content modal-narrow">
        <h2 id="confirm-modal-title">${options.title || 'Confirm'}</h2>
        <p id="confirm-modal-message">${message}</p>
        <div style="display:flex;gap:1em;justify-content:flex-end;margin-top:1em;">
          <button type="button" id="confirm-modal-cancel" class="secondary">${options.cancelText || 'Cancel'}</button>
          <button type="button" id="confirm-modal-confirm" class="success">${options.confirmText || 'OK'}</button>
        </div>
      </div>
    `;

    // Trap focus inside modal
    function trapFocus(e) {
      const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        cleanup(false);
      }
    }

    function cleanup(result) {
      modal.remove();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', trapFocus, true);
      resolve(result);
    }

    // Button event handlers
    modal.querySelector('#confirm-modal-cancel').onclick = () => cleanup(false);
    modal.querySelector('#confirm-modal-confirm').onclick = () => cleanup(true);

    // Keyboard accessibility
    document.addEventListener('keydown', trapFocus, true);

    // Add modal to DOM and focus
    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    setTimeout(() => {
      modal.querySelector('#confirm-modal-confirm').focus();
    }, 0);
  });
}

/**
 * closeIsolatedModal - Closes and removes a modal dialog from the DOM.
 * @param {HTMLElement} modal - The modal element to close.
 */
export function closeIsolatedModal(modal) {
  if (modal && modal.parentNode) {
    modal.parentNode.removeChild(modal);
  }
  // Remove modal-open class if no other modals are present
  if (!document.querySelector('.modal')) {
    document.body.classList.remove('modal-open');
  }
}

/**
 * openIsolatedModal - Appends a modal to the DOM and focuses the first focusable element.
 * @param {HTMLElement} modal - The modal element to open.
 */
export function openIsolatedModal(modal) {
  if (!modal) return;
  // Remove d-none if present to ensure modal is visible
  if (modal.classList.contains('d-none')) {
    modal.classList.remove('d-none');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  }
  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  console.log('[DIAG][modals] openIsolatedModal: modal appended to DOM', modal, modal.outerHTML);
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(modal);
    console.log('[DIAG][modals] openIsolatedModal: modal computed style', computedStyle.display, computedStyle.visibility, computedStyle.opacity);
    const focusable = modal.querySelector('button, [tabindex]:not([tabindex="-1"])');
    if (focusable) focusable.focus();
  }, 0);
}

/**
 * showPromptModal - Show a modal with a text input and OK/Cancel buttons.
 * @param {string} message - The prompt message.
 * @param {Object} [options] - Optional config (title, placeholder, confirmText, cancelText, defaultValue).
 * @returns {Promise<string|null>} Resolves with input value if confirmed, or null if cancelled.
 */
export function showPromptModal(
  message,
  options = {}
) {
  return new Promise((resolve) => {
    // Remove any existing prompt modal
    let modal = document.getElementById('prompt-modal');
    if (modal) modal.remove();

    // Create modal container
    modal = document.createElement('div');
    modal.id = 'prompt-modal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('tabindex', '-1');
    modal.innerHTML = `
      <div class="modal-content modal-narrow">
        <h2 id="prompt-modal-title">${options.title || 'Prompt'}</h2>
        <label for="prompt-modal-input" style="display:block;margin-bottom:0.5em;">${message}</label>
        <input id="prompt-modal-input" type="text" class="input" placeholder="${options.placeholder || ''}" value="${options.defaultValue || ''}" style="width:100%;margin-bottom:1em;" />
        <div style="display:flex;gap:1em;justify-content:flex-end;">
          <button type="button" id="prompt-modal-cancel" class="secondary">${options.cancelText || 'Cancel'}</button>
          <button type="button" id="prompt-modal-confirm" class="success">${options.confirmText || 'OK'}</button>
        </div>
      </div>
    `;

    const input = modal.querySelector('#prompt-modal-input');

    function trapFocus(e) {
      const focusable = modal.querySelectorAll('input, button, [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
      if (e.key === 'Escape') {
        cleanup(null);
      }
      if (e.key === 'Enter' && document.activeElement === input) {
        cleanup(input.value);
      }
    }

    function cleanup(result) {
      modal.remove();
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', trapFocus, true);
      resolve(result && result.trim() ? result.trim() : null);
    }

    modal.querySelector('#prompt-modal-cancel').onclick = () => cleanup(null);
    modal.querySelector('#prompt-modal-confirm').onclick = () => cleanup(input.value);

    document.addEventListener('keydown', trapFocus, true);

    document.body.appendChild(modal);
    document.body.classList.add('modal-open');
    setTimeout(() => {
      input.focus();
      input.select();
    }, 0);
  });
}

/**
 * showFullPromptModal - Show a modal displaying full prompt details.
 * @param {Object} prompt - The prompt object to display.
 */
export function showFullPromptModal(prompt) {
  // Remove any existing full prompt modal
  let modal = document.getElementById('full-prompt-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'full-prompt-modal';
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('tabindex', '-1');
  modal.innerHTML = `
    <div class="modal-content modal-wide">
      <button id="close-full-prompt-modal-btn" class="close-btn" aria-label="Close" style="position:absolute;top:12px;right:12px;font-size:1.5em;">&times;</button>
      <h2 style="margin-top:0;">${prompt.title ? escapeHtml(prompt.title) : 'Prompt Details'}</h2>
      <pre style="white-space:pre-wrap;word-break:break-word;font-size:15px;color:#F3EFFF;background:#1C1433;border-radius:8px;padding:16px;max-height:60vh;overflow:auto;">${prompt.content ? escapeHtml(prompt.content) : ''}</pre>
      ${prompt.tags && prompt.tags.length ? `<div style="margin-top:1em;"><strong>Tags:</strong> ${prompt.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(', ')}</div>` : ''}
      ${prompt.category ? `<div style="margin-top:1em;"><strong>Category:</strong> ${escapeHtml(prompt.category)}</div>` : ''}
    </div>
  `;

  function trapFocus(e) {
    const focusable = modal.querySelectorAll('button, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    if (e.key === 'Escape') {
      cleanup();
    }
  }

  function cleanup() {
    modal.remove();
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', trapFocus, true);
  }

  modal.querySelector('#close-full-prompt-modal-btn').onclick = cleanup;
  document.addEventListener('keydown', trapFocus, true);

  document.body.appendChild(modal);
  document.body.classList.add('modal-open');
  setTimeout(() => {
    modal.querySelector('#close-full-prompt-modal-btn').focus();
  }, 0);
}

// Helper to escape HTML (if not already in scope)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
