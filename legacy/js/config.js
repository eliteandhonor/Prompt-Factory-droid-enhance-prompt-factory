// config.js
/**
 * Centralized application configuration module.
 * - All config edits must be via source control: never modified at runtime.
 * - apiEndpoint must be a string: absolute or relative URL (e.g. "/api/v1/").
 * - assetVersions: JS/CSS/images version hashes (cache busting).
 * - pollRates (ms): Constraints: healthCheckMs >= 5000, gridUpdateMs >= 1000.
 * - featureToggles: Enable/disable named features for admin, deployment, or preview.
 * - All feature toggles must be annotated for audience/scope.
 * - This object is frozen (Object.freeze) for runtime immutability.
 * - For large/critical deployments, add JSON schema/checker here for CI validation.
 */

const CONFIG = {
    // [Remediation] DEV NOTE: For local/dev use, apiEndpoint must match the actual location where db.php is reachable.
    // When using static dev servers (e.g., python -m http.server), PHP backend will NOT run! Use "/" for local (if db.php at root).
    // For production/deployments where /api/v1/ is routed to PHP, set accordingly.
    apiEndpoint: "/", // REST API root endpoint; must match backend route.
    assetVersions: {
        js: "1.0.0",
        css: "1.0.0",
        images: "1.0.0",
    },
    pollRates: {
        healthCheckMs: 10000, // Minimum 5000ms. How often the app checks backend health.
        gridUpdateMs: 2500,   // Minimum 1000ms. How often UI updates main grid.
    },
    featureToggles: {
        enableGrid: true,          // Core: Main grid rendering (always required for app use)
        enableAdminPanel: false,   // Admin: Show/hide admin panel (deployment, not for regular users)
        // add new toggles below with clear comments and intended audience
    }
};

Object.freeze(CONFIG);

export default CONFIG;