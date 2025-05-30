// analytics.js
// [AUDITFIX] Minimal event tracking utility

const ANALYTICS_KEY = 'app_analytics_events';

export function trackEvent(event, details = {}) {
  const entry = {
    event,
    details,
    time: new Date().toISOString()
  };
  const log = getAnalyticsLog();
  log.push(entry);
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(log));
}

export function getAnalyticsLog() {
  try {
    return JSON.parse(localStorage.getItem(ANALYTICS_KEY)) || [];
  } catch {
    return [];
  }
}

export function clearAnalyticsLog() {
  localStorage.removeItem(ANALYTICS_KEY);
}