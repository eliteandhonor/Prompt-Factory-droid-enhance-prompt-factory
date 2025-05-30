// progress.js - KISS global loading indicator using OverlayManager with debug logging

import { showOverlay, hideOverlay } from './overlayManager.js';

export function showLoading(message = 'Loading...') {
  console.debug('[progress.js] showLoading called', { message });
  showOverlay('global', { message });
}

export function hideLoading() {
  console.debug('[progress.js] hideLoading called');
  hideOverlay('global');
}