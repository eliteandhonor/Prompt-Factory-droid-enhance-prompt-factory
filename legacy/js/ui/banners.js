/**
 * banners.js
 * Persistent banner UI for error/health/backend status (XSS-safe: all content injected via escapeHTML).
 * All UI/exported functions are pure and stateless, using passed context only.
 * SECURE: All dynamic banner content is escaped; no direct HTML interpolation.
 * Accessibility: ARIA role/keyboard support for dismiss.
 * Internal _cleanupBanner prop is implementation detail, not part of public API.
 *
 * @module banners
 */

import { escapeHTML } from '../util/markdown.js';

/**
 * Show a persistent error/health banner in the toast/alert/banner container.
 * Renders with ARIA roles, keyboard (ESC) dismiss, and all content XSS-escaped.
 * @param {HTMLElement} container - Banner container DOM node (e.g. #toast).
 * @param {Object} health - { ok: boolean, message?: string, detail?: string }
 * @param {Object} options - Display options. Reserved for future (type, icons, duration).
 */
export function showBanner(container, health = {}, options = {}) {
  if (!container) return;

  // Clean up previous listeners if present
  if (container._cleanupBanner) {
    container._cleanupBanner();
    container._cleanupBanner = null;
  }

  // Use role=alert for error, role=status for info
  const isError = health.ok === false;
  const role = isError ? "alert" : "status";
  const live = isError ? "assertive" : "polite";

  container.innerHTML = `
    <div class="banner${isError ? ' banner-error' : ' banner-info'}" role="${role}" aria-live="${live}" tabindex="0">
      <span class="banner-icon">${isError ? '⚠️' : 'ℹ️'}</span>
      <span class="banner-msg">${escapeHTML(health.message || 'Status update')}</span>
      ${health.detail ? `<div class="banner-detail">${escapeHTML(health.detail)}</div>` : ''}
      <button class="banner-dismiss" aria-label="Dismiss">&times;</button>
    </div>
  `;
  container.classList.remove('hidden');

  const dismissBtn = container.querySelector('.banner-dismiss');
  const bannerDiv = container.querySelector('.banner');

  // Click to dismiss
  const clickHandler = () => hideBanner(container);
  if (dismissBtn) dismissBtn.addEventListener('click', clickHandler);

  // ESC dismisses banner when banner (or button) is focused
  const keyHandler = (e) => {
    if (e.key === "Escape") {
      hideBanner(container);
    }
  };
  if (bannerDiv) bannerDiv.addEventListener('keydown', keyHandler);

  // Focus the banner for accessibility
  setTimeout(() => {
    if (bannerDiv) bannerDiv.focus();
  }, 20);

  // Clean up all event listeners on next show/hide
  container._cleanupBanner = () => {
    if (dismissBtn) dismissBtn.removeEventListener('click', clickHandler);
    if (bannerDiv) bannerDiv.removeEventListener('keydown', keyHandler);
    container._cleanupBanner = null;
  };
}

/**
 * Hide/remove the persistent banner.
 * Cleans up all keyboard and click handlers.
 * @param {HTMLElement} container
 */
export function hideBanner(container) {
  if (!container) return;
  if (container._cleanupBanner) {
    container._cleanupBanner();
    container._cleanupBanner = null;
  }
  container.innerHTML = '';
  container.classList.add('hidden');
}

/**
 * Update banner content/state.
 * Calls showBanner with new data.
 * @param {HTMLElement} container
 * @param {Object} health
 */
export function updateBanner(container, health) {
  showBanner(container, health);
}

/**
 * DEV/TEST simulation: force banner into common error/info scenarios ("backend-down", "ok", "warning").
 * Not for production use.
 * @param {HTMLElement} container
 * @param {string} scenario - 'backend-down'|'ok'|'warning'
 */
export function devSimulateBannerState(container, scenario) {
  if (!container) return;
  if (scenario === 'backend-down') {
    showBanner(container, { ok: false, message: 'Backend offline', detail: 'Cannot reach database.' });
  } else if (scenario === 'warning') {
    showBanner(container, { ok: false, message: 'Warning', detail: 'Partial feature degraded' });
  } else if (scenario === 'ok') {
    showBanner(container, { ok: true, message: 'All systems normal' });
  }
}

// Helper: escapeHTML to prevent XSS