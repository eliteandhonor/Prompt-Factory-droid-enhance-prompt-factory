<?php
/**
 * Attribution & Access Control Helpers
 * Extracted from db.php for modularization.
 */

/**
 * Returns the current user's unique ID (or session stub). Extend for real auth in future.
 * @return string
 */
function getCurrentUserId() {
    if (!empty($_SERVER['HTTP_X_SESSION_USER'])) {
        // Optionally allow an override for dev/test. Strip on prod deploy!
        return preg_replace('/[^a-zA-Z0-9_\-]/','',$_SERVER['HTTP_X_SESSION_USER']);
    }
    // TODO: For true sessions/OAuth, map PHP session/cookie or bearer token to user.
    return 'anon';
}

/**
 * Returns true iff the user is site admin (stub always false for now).
 */
function isAdmin($user_id) {
    // Replace with active admin check (RBAC, group lookup, etc).
    // FUTURE/SSO: Check user/session for admin role/flag.
    return false;
}

/**
 * Returns true iff given user can edit the entity (stub always true except for RBAC demo).
 */
function canEdit($user_id, $entity) {
    // Allow edit if user owns entity or is admin
    // Future: e.g. return ($entity['user_id'] === $user_id) || isAdmin($user_id);
    return true;
}