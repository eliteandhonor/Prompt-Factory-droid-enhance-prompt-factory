/**
 * Helper functions used throughout PromptShare.
 * Centralizes UUID generation, date formatting, and text truncation with safe/consistent logic.
 * @module helpers
 */

/**
 * RFC4122-compliant UUID v4 generator.
 * Uses `crypto.randomUUID` if available, falls back to crafted random string.
 * @returns {string}
 */
export function uuidv4() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback based on common implementation
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (
      c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> (c/4)
    ).toString(16)
  );
}

/**
 * Format a date (string or Date object) as 'YYYY Mon DD' (e.g. '2025 May 03').
 * Falls back to the input string if parsing fails.
 * @param {string|Date} date
 * @returns {string}
 */
export function formatDate(date) {
  if (!date) return '';
  let d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d)) return String(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getFullYear()} ${months[d.getMonth()]} ${(`0${d.getDate()}`).slice(-2)}`;
}

/**
 * Truncate a string to length N, using "..." if truncation occurs.
 * Returns the original string if length is <= N.
 * Always returns a string of length <= N.
 * @param {string} txt
 * @param {number} n
 * @returns {string}
 */
export function truncateText(txt, n) {
  if (!txt || typeof txt !== 'string' || !n || n < 4) return '';
  return txt.length <= n ? txt : txt.slice(0, n - 3) + '...';
}