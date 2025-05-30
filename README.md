# LLM Prompt Sharing & Community App

## Project Structure

- `public_html/`
  Main application code (frontend, backend, assets, config, tests).
- `public_html/js/`
  Modular JavaScript source (UI, API, state, utilities).
- `public_html/db_parts/`
  Backend PHP modules and config.
- `public_html/test/`
  Unit and integration tests (QUnit, Playwright).
- `public_html/legacy/`
  **Legacy code** (unused, for reference only; see `legacy/README.md`).
- `AUDIT_LOG.md`
  Accessibility, compliance, and audit policies.

## Modular Architecture Overview

This project is architected for maintainability, security, and rapid feature extension. Its modular design centers around three pillars:

- **Single Markdown Handling Source (js/util/markdown.js):**  
  All markdown parsing, sanitization, and output filtering is centralized in a single, robust utility. This eliminates legacy duplication and guarantees consistent, secure user content rendering across the entire UI.

- **Core Helpers Module (js/util/helpers.js):**  
  General-purpose, stateless helpers are consolidated in one module, providing formatting, validation, token management, and other utility functions consumed by UI and API logic.

- **Modular UI Event & Rendering Pipeline (js/ui/util/domEvents.js & js/ui/):**  
  UI event binding, dispatch, and DOM update logic are now strictly modular—no global event listeners or ad hoc query/select spaghetti. All event-driven UI flows (including prompt CRUD, theme toggling, modal handling) are composed from discreet, testable modules.

### Security/XSS Pipeline

- **Centralized & Defensive:**  
  All user-generated content is filtered through a single security pipeline, leveraging escape and sanitize routines in `js/util/markdown.js` and core helpers. UI modules never insert raw user input; backend flows re-validate as an extra safety net. No dynamic HTML is injected without passing the sanitize pipeline.

- **Pipeline Highlights:**
  - Only a strict subset of markdown/HTML is supported.
  - XSS vectors are neutered with both frontend and backend escapes.
  - All comments/results/prompts use consistent security logic (no divergent/legacy flows remain).
  - Robust cross-module auditability: any output-to-DOM path is secured at source.

## Frontend State Management & Error Handling (2025 refactor)

Robust, scalable app state and error handling are now managed via a modular, observable micro-store (`js/state/store.js`).  
All core UI and logic modules interact only with this store—no global state mutation remains. This pattern eliminates hidden side effects and makes all state changes explicit, debuggable, and testable.

### Key Principles

- **Single Source of Truth:**  
  App-wide UI state (prompts, filters, selection, pagination, error/fallback, loading) is managed in `js/state/store.js`.
- **Observability:**  
  All components subscribe to store changes using `subscribe(fn)`, which triggers re-renders and fallback logic automatically on every state update.
- **Immutable Pattern:**  
  State updates use `setState(patch)`, merging and diffing only the necessary parts for clarity and reliability.  
  No direct mutation of any state objects is allowed.
- **Robust Error and Fallbacks:**  
  Asynchronous operations always call `setError({ message, type, ... })` on failure; UI and modules subscribe and react accordingly, ensuring obvious, actionable feedback for users and developers.
- **Undo & Recovery:**  
  Destructive actions (e.g. prompt delete) use temporary local state with undo, only committing backend changes after the undo window expires.  
  State is resynced from backend on finalization or recoverable failure.

### Store API (js/state/store.js)

```js
import { getState, subscribe, setState, setError, clearError } from './state/store.js';

subscribe((newState, patch) => { ... }) // React to state changes anywhere
setState({ prompts: [...] }) // Update state immutably
setError({ type, message }) // Register recoverable or fatal application errors and triggers fallback UI
clearError() // Remove displayed error after handled
```

### Example: Using/Extending State in UI Modules

```js
// In any UI module:
import { getState, setState, subscribe } from '../state/store.js';
const state = getState();
setState({ filter: { ...state.filter, category: "Chatbot" } });

subscribe((state) => { renderSidebarUI(state); });
```

### Patterns and Extensibility

- All new UI logic should use this observable pattern for reading/updating app state.
- Asynchronous backend errors and UI validation errors must always go through setError. Never silently swallow or log errors—each is shown to the user and can be recovered or debugged.
- Any new features can add fields to the store’s state object; use subscribe to update UI as needed.
- Undo/redo logic is implemented by patching temporary keys in state and finalizing/aborting on user action or timeout.

See code comments in `js/state/store.js` and `js/ui/ui.js` for in-depth examples and extension best practices.

## Primary Modules and Their Roles

| Module                                         | Responsibility                                                    |
|------------------------------------------------|-------------------------------------------------------------------|
| `js/util/markdown.js`                          | Markdown parsing, XSS filtering, HTML sanitization, output rules  |
| `js/util/helpers.js`                           | Utility functions: formatting, ID generation, token ops, validation|
| `js/ui/util/domEvents.js`                      | UI global/dom event mapping and handler registration              |
| `js/ui/ui.js`                                 | Main UI orchestrator: overall state and cross-component flows     |
| `js/ui/renderPromptBlock.js`                   | Rendering reusable prompt grid items/blocks                       |
| `js/ui/grid.js`, `js/ui/sidebar.js`, `js/ui/banners.js`, `js/ui/modals.js`, `js/ui/progress.js` | Modular UI: each handles a single facet of user interaction or feedback |
| `js/api/db.js`, `js/api/prompts.js`            | Backend API communication; persistence abstraction                |
| `js/config.js`                                 | Environment and deployment config                                 |

## Best Practices In Effect

- **Modular, Single-Source Logic:** Duplications removed; all common logic in dedicated modules.
- **Explicit DOM Event Management:** Handlers modularized, not inlined or global.
- **Centralized Security:** All content passed through a single, auditable pipeline.
- **Legacy/Obsolete Files Clearly Marked:** Previous files (`js/markdown.js`, `js/db.js`, etc.) are deleted; no split logic remains.
  The `public_html/legacy/` directory contains unused legacy code, retained for reference only and not part of the active application.
- **Strict Separation of Concerns:** API, UI, and utility layers communicate via clear, minimal interfaces.
- **Accessibility First:** Full keyboard/ARIA support, animation and focus management tested across devices.
- **Atomic, Testable Functions:** Critical logic is stateless and easily unit-tested.
- **Up-to-date Documentation:** README and AUDIT_LOG.md reflect current codebase and workflows.

## Automated Testing, CI/Linting, and Reliability

### Frontend & Core Logic Automated Tests

- **Location:** All critical modules (`js/util/helpers.js`, `js/util/markdown.js`, `js/state/store.js`, `js/auth/session.js`, `js/api/db.js`, `js/api/prompts.js`) have unit and API contract tests in `/test/`.
- **How to Run:** Open [`/test/index.html`](./test/index.html) in any modern browser to execute the full QUnit-based test suite.
- **Coverage:** All stateless logic and API boundaries must be covered by tests for PR acceptance. Integration with backend is tested with smoke tests.

### Code Quality and Linting

- **Linting:** All JavaScript code must pass ESLint checks before commit. Use `npx eslint .` (Node required) or any editor/browser-integrated lint tool.
- **Style:** Follow code patterns and formatting of the existing modules. Contributions must not add new lint errors.

### Continuous Integration (CI) / Workflow

- **Manual Local Workflow:** Before submitting PRs or merging changes, contributors must:
  1. Run all tests in `/test/index.html` and ensure 100% pass rate.
  2. Run `npx eslint .` and resolve any code style or error flags.
  3. Confirm backend and frontend are healthy (see below).
- **GitHub Actions:** For projects using GitHub, consider adding `.github/workflows/ci.yml` to automatically run these checks on push/PR.

### Health and Liveness Checks

- **Backend Endpoint:** `db.php?action=health` and `db.php?action=selftest` — returns JSON health status for API, file system, and logger.
- **Frontend Smoke:** Test suite `/test/index.html` and application status banner surface live status to end-users/admins.

### Coverage and Reliability Requirements

- All business-critical logic must have associated unit or contract tests.
- All PRs must maintain or improve test and lint pass rates—no regressions allowed.
- New endpoints/features should include new or extended tests.

## Features & Usage

- **Navigation:** Navbar (search/login), collapsible sidebar (category/tag), animated grid/list with live search and filters.
- **Prompt Details:** Modal view, comments (threaded, markdown-safe), and output results.
- **Actions (CRUD):** Add/edit/delete for prompts/comments, gated by auth where required; animated feedback.
- **Theming & Accessibility:** Modular CSS (including dark theme), custom animations, mobile-friendly/responsive.
- **Extensible Core:** New modules/UI extensions can be added without modifying legacy files or global state.

## Setup, Running & Deployment

### Prerequisites

- Node.js (for linting and development tools)
- PHP 7.4+ (for backend API)
- Modern browser (for running and testing frontend)
- (Optional) Python 3 or VS Code Live Server for local HTTP server

### Install & Run (Development)

1. Clone or download the repository.
2. Ensure `public_html/db.php`, `prompts.json`, `comments.json`, and `results.json` exist and are writeable (see permissions below).
3. Start a local HTTP server in `public_html/`:
   - `php -S localhost:8000 -t public_html`
   - or `python3 -m http.server` (in `public_html/`)
   - or use VS Code Live Server
4. Visit [http://localhost:8000](http://localhost:8000) in your browser.

### Linting & Testing

- Run all tests: open [`/test/index.html`](./test/index.html) in your browser.
- Lint JS: `npx eslint .`
- (Optional) Run Playwright tests: see `/test/playwright/`

### Production

- Upload `/public_html` to your web host’s `public_html`, overwriting if updating.

---

## API Contracts

### General Notes

- All endpoints return JSON.
- All error responses have the form:  
  `{ "ok": false, "error": "Error message" }`
- All successful responses have `"ok": true` and relevant data.
- All endpoints support CORS and preflight OPTIONS.

### Endpoints

#### Prompts (`api/prompts.php`)

- **GET** `/api/prompts`  
  List all prompts (with attached results/comments).
  - Response:  
    ```json
    {
      "ok": true,
      "prompts": [ { ...promptObject, "results": [...], "comments": [...] }, ... ]
    }
    ```
- **GET** `/api/prompts?id=...`  
  Get a single prompt by ID.
  - Response:  
    ```json
    {
      "ok": true,
      "prompt": { ...promptObject, "results": [...], "comments": [...] }
    }
    ```
- **POST** `/api/prompts`  
  Create, update, delete, or import prompts (action-based).
  - Create:  
    ```json
    { "title": "...", "content": "...", "category": "...", "tags": [...] }
    ```
    Response:  
    ```json
    { "ok": true, "prompt": { ... } }
    ```
  - Update:  
    ```json
    { "action": "update", "id": "...", "title": "...", "content": "...", "category": "...", "tags": [...] }
    ```
    Response:  
    `{ "ok": true }`
  - Delete:  
    ```json
    { "action": "delete", "id": "..." }
    ```
    Response:  
    `{ "ok": true }`
  - Import/Batch Import:  
    ```json
    { "action": "import"|"batch_import", "prompts": [ ... ] }
    ```
    Response:  
    `{ "ok": true, "imported_count": n, "skipped_count": m, ... }`
- **PUT** `/api/prompts?id=...`  
  Update a prompt.
  - Request body:  
    `{ "title": "...", "content": "...", ... }`
  - Response:  
    `{ "ok": true }`
- **DELETE** `/api/prompts?id=...`  
  Delete a prompt.
  - Response:  
    `{ "ok": true }`

- **Prompt Object Example:**
  ```json
  {
    "id": "prompt_...",
    "title": "...",
    "content": "...",
    "description": "...",
    "category": "...",
    "tags": ["..."],
    "created_at": "...",
    "updated_at": "..."
  }
  ```

#### Categories (`api/categories.php`)

- **GET** `/api/categories`  
  List all categories.
  - Response:  
    `{ "ok": true, "categories": [ { "id": "...", "name": "...", "created_at": "...", "updated_at": "..." }, ... ] }`
- **POST** `/api/categories`  
  Create a category.
  - Request: `{ "name": "..." }`
  - Response: `{ "ok": true, "category": { ... } }`
- **PUT** `/api/categories?id=...`  
  Update a category.
  - Request: `{ "name": "..." }`
  - Response: `{ "ok": true }`
- **DELETE** `/api/categories?id=...`  
  Delete a category.
  - Response: `{ "ok": true }`

#### Tags (`api/tags.php`)

- **GET** `/api/tags`  
  List all tags.
  - Response:  
    `{ "ok": true, "tags": [ { "id": "...", "name": "...", "created_at": "...", "updated_at": "..." }, ... ] }`
- **POST** `/api/tags`  
  Create a tag.
  - Request: `{ "name": "..." }`
  - Response: `{ "ok": true, "tag": { ... } }`
- **PUT** `/api/tags?id=...`  
  Update a tag.
  - Request: `{ "name": "..." }`
  - Response: `{ "ok": true }`
- **DELETE** `/api/tags?id=...`  
  Delete a tag.
  - Response: `{ "ok": true }`

#### Results (`api/results.php`)

- **GET** `/api/results[?prompt_id=...]`  
  List all results, optionally filtered by prompt_id.
  - Response:  
    `{ "ok": true, "results": [ { ... }, ... ] }`
- **POST** `/api/results`  
  Create a result.
  - Request: `{ "prompt_id": "...", "content": "...", "author": "..." }`
  - Response: `{ "ok": true, "result": { ... } }`
- **PUT** `/api/results?id=...`  
  Update a result.
  - Request: `{ "content": "...", "author": "..." }`
  - Response: `{ "ok": true }`
- **DELETE** `/api/results?id=...`  
  Delete a result.
  - Response: `{ "ok": true }`

#### Comments (`api/comments.php`)

- **GET** `/api/comments[?prompt_id=...]`  
  List all comments, optionally filtered by prompt_id.
  - Response:  
    `{ "ok": true, "comments": [ { ... }, ... ] }`
- **POST** `/api/comments`  
  Create a comment.
  - Request: `{ "prompt_id": "...", "content": "...", "author": "..." }`
  - Response: `{ "ok": true, "comment": { ... } }`
- **PUT** `/api/comments?id=...`  
  Update a comment.
  - Request: `{ "content": "...", "author": "..." }`
  - Response: `{ "ok": true }`
- **DELETE** `/api/comments?id=...`  
  Delete a comment.
  - Response: `{ "ok": true }`

---

## Event/Data Flow & Diagrams

### Modal Data Flow

```mermaid
flowchart TD
  A[User clicks prompt] --> B[Open modal]
  B --> C[Fetch prompt details via API]
  C --> D[Update app state]
  D --> E[Render modal with prompt, comments, results]
  E --> F[User interacts (add comment/result)]
  F --> G[POST to API]
  G --> H[Update state & re-render modal]
```

### API Fetch Flow

```mermaid
sequenceDiagram
  participant UI
  participant Store
  participant API
  UI->>Store: Dispatch fetch action
  Store->>API: Send HTTP request
  API-->>Store: JSON response
  Store->>UI: Update state, trigger re-render
  UI->>User: Show data or error
```

### Error Handling Flow

```mermaid
flowchart TD
  A[API call fails] --> B[setError in store]
  B --> C[UI subscribes to error state]
  C --> D[Show error banner/modal]
  D --> E[User retries or dismisses]
  E --> F[clearError in store]
```

---

## Error & Logging Standards

### Frontend

- Use `debugLog`, `logError`, and `logCriticalError` from [`js/util/debugLogger.js`](js/util/debugLogger.js) for all logging.
- `logError` logs to console and localStorage.
- `logCriticalError` logs to console, localStorage, and POSTs to backend for aggregation.
- All errors shown to users must be registered via `setError` in the state store.

### Backend

- All API endpoints use [`Logger.php`](Logger.php) for structured logging (level, event, context).
- All errors, warnings, and info are logged with context.
- Log files are rotated daily and retained for 14 days.
- Critical errors are logged and surfaced in API responses as `{ "ok": false, "error": "..." }`.

---

## Changelog

See [`CHANGELOG.md`](CHANGELOG.md) for a list of all major changes and remediation history.

---

## Backend/Permissions

- Editing/saving (backend features) requires `db.php`, `prompts.json`, `comments.json`, and `results.json` to exist and be writeable (set `666` for dev, restrict for prod).
- Backend API/config/logging is described in inline file comments and AUDIT_LOG.md.
- **Never** commit secrets/logs; configure tokens/paths in `Logger.php`.

## Attribution, Access Control & Authentication Groundwork (2025)

### Attribution Model and Session Assignment

- All mutable entities (prompts, comments, results) are attributed using a required `user_id` at save/edit time. This is the authoritative source for user/session ownership and access checks.
- The optional `author` field is strictly for display/UI/legacy; it may be filled with a username for display, but MUST NOT be relied upon for any privilege checks.
- JS and backend (PHP) each provide a single “session/user assigner” function:
  - **Backend:** `getCurrentUserId()` in `db.php` (see code/TODOs)
  - **Frontend:** `getCurrentUserId()` in `js/auth/session.js` (import and use for all CRUD/muting actions)
- These assigners currently always return "anon", preserving anonymous flows, but are engineered for easy plug-in of real session/cookie/OAuth or SSO logic later.

### Authentication & RBAC Extension Points

- All entity mutations must assign `user_id` via the above assigner (never hardcode or set "anon" elsewhere; this guarantees future audit and plug-in of authentication mechanisms).
- There are stub functions for role/access checks (`canEdit(entity)`, `isAdmin()`), used for access checks and RBAC enforcement in the future. See `js/auth/session.js` and `db.php`.
- Contributors should extend only in these locations, never in scattered legacy code. Privilege enforcement is centralized and documented.

### Contributor Guidance

- To enable sign-in, OAuth, SSO, or privilege logic, expand the single assigner function on both backend and frontend. Use the stubs and TODOs to hook up external session or identity APIs.
- All flows and modules must consume attribution/session assignment through these helpers for correct access tracking, privilege checks, and audit.
- See `data/prompts-template.json` for canonical entity shapes and attribution comments for onboarding.

## Accessibility & Compliance Strategy (2025 Update)

### Principles and Practices

- **Keyboard Navigability:** All major actions (theme, sidebar, grid, modals, CRUD) are reachable via Tab/Shift+Tab, with visible focus for all interactive elements.
- **ARIA & Semantics:** All navigation/landmark elements (`nav`, `main`, `aside`, dialogs) use ARIA labels/roles. Modals enforce `role=dialog` and `aria-modal`, live regions have `aria-live`.
- **Focus Management:** Opening modals traps focus within dialog, restores to previous element after closing. ESC and Cancel close modals. Visible focus styles are enforced CSS-wide using `:focus-visible`.
- **Screen Reader Support:** Critical feedback areas (banner, loading, toasts) include `aria-live="polite"`. Visually hidden helpers (`.visually-hidden`) ensure screen reader exclusivity without visual clutter.
- **No JavaScript Fallback:** A `<noscript>` warning is displayed if JS is disabled.
- **Error Surfaces:** All API and validation errors use prominent, assertive alerts in modals and banners.
- **Documentation:** All accessibility, compliance, audit, onboarding, and policy standards are now documented solely in [AUDIT_LOG.md](../AUDIT_LOG.md) as the canonical source.

For all onboarding, accessibility, compliance, audit, and contributor or review policies and checklists, see [AUDIT_LOG.md](../AUDIT_LOG.md). That file is now the sole canonical source for these requirements. Summary: All UI, security, and access control compliance is implemented in accordance with those procedures. The codebase and workflow always enforce accessibility, audit, a11y, and review standards as described in AUDIT_LOG.md. Refer to AUDIT_LOG.md to understand policies, requirements, and the review/extension process.

## Known Limitations

- The legacy codebase is present in `public_html/legacy/` for reference only and is not maintained.
- Authentication is stubbed; all users are anonymous by default.
- No rate limiting or advanced anti-abuse in production mode.
- File-based backend may not scale for high-concurrency or large datasets.
- API endpoints are not versioned.
- No built-in email or notification system.
- Accessibility and compliance are enforced per [AUDIT_LOG.md](../AUDIT_LOG.md), but further review may be required for specific deployments.

## Troubleshooting

- “Cannot use import statement outside a module”? Run via HTTP, not file://.
- Save/edit errors: Check JSON file permissions/logs on the server.
