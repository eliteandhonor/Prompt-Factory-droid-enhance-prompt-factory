// domEvents.js - Modular UI event utilities for DRY, maintainable UI logic.

//
// Event delegation: binds a handler to parent for all descendant matches
// Usage: bindClick(listEl, 'li[data-category]', handler)
//
export function bindClick(parentEl, selector, handler) {
  if (!parentEl) return;
  parentEl.addEventListener('click', function(e) {
    const match = e.target.closest(selector);
    if (match && parentEl.contains(match)) {
      handler(e, match);
    }
  });
}

//
// List selection for categories/tags (filters)
// Usage: bindListSelection(categoryListEl, 'data-category', (li) => { ... })
//
export function bindListSelection(listEl, attr, handler) {
  bindClick(listEl, `li[${attr}]`, (e, li) => handler(li));
}

//
// Binds modal close/escape/click-outside with a callback; handles animation/focus
// Usage: bindModalEvents(modalEl, onClose)
//
export function bindModalEvents(modalEl, onClose) {
  if (!modalEl) return;
  const closeBtn = modalEl.querySelector('.close-modal');
  if (closeBtn) {
    closeBtn.onclick = () => onClose(modalEl);
  }
  // Click-outside
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) onClose(modalEl);
  });
  // Escape key
  modalEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') onClose(modalEl);
  });
  // Focus for accessibility
  modalEl.setAttribute('tabindex', '-1');
}

//
// Binds all card action button events in a standardized DRY way
// handlers: { card: fn, edit: fn, delete: fn, share: fn, copy: fn }
// Usage: bindCardActions(promptListEl, {card, edit, delete, share, copy})
//
export function bindCardActions(containerEl, handlers={}) {
  if (!containerEl) return;
  // Card click (detail)
  containerEl.querySelectorAll('.prompt-card').forEach(cardEl => {
    if (handlers.card)
      cardEl.onclick = () => {
        try {
          handlers.card(cardEl.dataset.id, cardEl);
        } catch (e) {
          const errorUID = "CARD-HANDLER-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now();
          console.error('[FATAL UI HANDLER] Card click', { id: cardEl.dataset.id, errorUID, error: e });
          if (typeof window.setError === "function") window.setError({ type: 'handler', message: `Prompt card click failed [${errorUID}]`, details: e });
          if (typeof window.showToast === "function") window.showToast(`Card click failed [${errorUID}]`, 'danger', 4800);
        }
      };
  });
  // Each button type
  [
    ['.btn-edit', 'edit'],
    ['.btn-delete', 'delete'],
    ['.btn-share', 'share'],
    ['.btn-copy', 'copy'],
  ].forEach(([sel, key]) => {
    containerEl.querySelectorAll(sel).forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (handlers[key]) {
          try {
            handlers[key](btn.dataset.id, btn);
          } catch (e) {
            const errorUID = (`BTN-HANDLER-` + key + "-" + Math.random().toString(36).substr(2, 6) + "-" + Date.now());
            console.error(`[FATAL UI HANDLER] ${key} button click`, { key, id: btn.dataset.id, errorUID, error: e });
            if (typeof window.setError === "function") window.setError({ type: 'handler', message: `Button [${key}] failed [${errorUID}]`, details: e });
            if (typeof window.showToast === "function") window.showToast(`Button [${key}] failed [${errorUID}]`, 'danger', 4800);
          }
        }
      };
    });
  });
}