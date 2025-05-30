// overlayManager.js - KISS Overlay/Spinner Manager with Debug Logging

const overlays = {};

function log(...args) {
  // Simple debug logger for overlay events
  console.debug('[OverlayManager]', ...args);
}

export function showOverlay(type = 'global', options = {}) {
  log('showOverlay called', { type, options });
  if (overlays[type]) {
    log('Overlay already active, skipping', type);
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = `overlay-manager overlay-${type}`;
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(255,255,255,0.8)';
  overlay.style.zIndex = 9999;
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.pointerEvents = 'all';
  overlay.innerHTML = options.message
    ? `<div style="padding:2em;background:#fff;border-radius:8px;box-shadow:0 2px 8px #0002;display:flex;flex-direction:column;align-items:center;">
        <div class="spinner" style="margin-bottom:1em;width:32px;height:32px;border:4px solid #ccc;border-top:4px solid #333;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <span style="font-size:1.2em;">${options.message}</span>
      </div>`
    : `<div class="spinner" style="width:32px;height:32px;border:4px solid #ccc;border-top:4px solid #333;border-radius:50%;animation:spin 1s linear infinite;"></div>`;
  overlay.setAttribute('data-overlay-type', type);
  document.body.appendChild(overlay);
  overlays[type] = overlay;
  log('Overlay shown', type, overlay);
}

export function hideOverlay(type = 'global') {
  log('hideOverlay called', type);
  const overlay = overlays[type];
  if (overlay) {
    overlay.remove();
    delete overlays[type];
    log('Overlay removed', type);
  } else {
    log('No overlay to remove', type);
  }
}

export function hideAllOverlays() {
  log('hideAllOverlays called');
  Object.keys(overlays).forEach(type => hideOverlay(type));
}

export function isOverlayActive(type = 'global') {
  return !!overlays[type];
}

// Failsafe: always remove overlays on load/error
window.addEventListener('load', hideAllOverlays);
window.addEventListener('error', hideAllOverlays);

log('OverlayManager initialized');