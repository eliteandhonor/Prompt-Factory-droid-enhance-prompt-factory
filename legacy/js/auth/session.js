// session.js: Attribution & Authentication Groundwork for Mutations, Roles, and Ownership
//
// Provides minimal, extensible hooks for attribution/session assignment
// and role-based access checks across all mutating entity actions.
//
// All prompt/comment/result creations and edits MUST route user attribution through getCurrentUserId().
// This file is the SINGLE SOURCE for session/user assignment logic.
//
// By default, all flows are "anonymous" (returns 'anon') until real session/OAuth/local login is added.
//
// To extend: plug in cookie/session/JWT logic into getCurrentUserId, and RBAC logic in canEdit/isAdmin,
// as documented below.

/**
 * Returns current session/user id for attribution.
 * 
 * - For now, always returns "anon". 
 * - Extend later for OAuth/session/cookie/JWT:
 *    - Example: parse cookie/token, or expose method to set active user in micro-store.
 *    - See backend getCurrentUserId for reference.
 * 
 * @returns {string}
 */
export function getCurrentUserId() {
  // TODO: Session/cookie/jwt/OAuth extension point (keep 'anon' as default for fallback/v2)
  // You may check window.localStorage, global store, or any appropriate source here.
  return 'anon';
}

/**
 * Returns true if current user/session is admin (stub always false). 
 * Extend for real roles logic (e.g., compare getCurrentUserId() to a known admin/userlist).
 * @returns {boolean}
 */
export function isAdmin() {
  // TODO: Replace with RBAC/roles check as soon as any account system lands.
  return false;
}

/**
 * Returns true if current user/session can edit the given entity (stub: always true).
 * Extend for RBAC/ownership soon.
 * @param {Object} entity - Any object with user_id field.
 * @returns {boolean}
 */
export function canEdit(entity) {
  // Example (for future):
  //   return (entity.user_id === getCurrentUserId()) || isAdmin();
  return true;
}

// --- All modules must import & use getCurrentUserId instead of directly using "anonymous"/"user" anywhere! ---
//
// Example usage:
//   import { getCurrentUserId, canEdit } from '../auth/session.js';
//   const user_id = getCurrentUserId();
//   prompt.user_id = user_id;
//   if (!canEdit(prompt)) throw Error('Permission denied');