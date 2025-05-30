// === Critical Error/Promise Instrumentation for Full-Stability UI Audit [AUTOMATIC] ===
window.addEventListener('error', function(event) {
  console.error('[GLOBAL ERROR] Uncaught JS error:', event.message, event.error || event);
  try {
    if (window.showToast) showToast('A critical JavaScript error occurred. See console for details.', 'danger', 9000);
    let banner = document.createElement('div');
    banner.style = 'background:#b71c1c;color:#fff;padding:1.2em;text-align:center;font-size:1.3em;z-index:99999;position:fixed;top:0;width:100vw;left:0;';
    banner.innerText = 'A critical JavaScript error occurred. See browser dev console for details.';
    document.body.prepend(banner);
  } catch(_) {}
});
window.addEventListener('unhandledrejection', function(event) {
  console.error('[GLOBAL ERROR] Unhandled Promise rejection:', event.reason || event);
  try {
    if (window.showToast) showToast('A server/async error occurred. See console for details.', 'danger', 9000);
    let banner = document.createElement('div');
    banner.style = 'background:#b71c1c;color:#fff;padding:1.2em;text-align:center;font-size:1.3em;z-index:99999;position:fixed;top:0;width:100vw;left:0;';
    banner.innerText = 'A server/async error occurred. See browser dev console for details.';
    document.body.prepend(banner);
  } catch(_) {}
});
// DEBUG LOG: main.js loaded (top of file)
/**
 * main.js
 * Single entrypoint/coordinator for all UI, APIs, health check, feedback, and cross-module ARIA/dev hooks.
 * All high-level business logic is delegated; no inlined business rules here.
 * Best-Practice: Exports only proven, minimal globals; all state is function-local.
 * Accessibility: Ensures ARIA roles, keyboard support, live feedback, and a11y-compliant sidebar/modal grid.
 * @module main
 */

import CONFIG from './config.js';
import * as dbApi from './api/db.js';
import * as promptsApi from './api/prompts.js';
import * as markdownUtil from './util/markdown.js';
import * as Grid from './ui/grid.js';
import * as Sidebar from './ui/sidebar.js';
import * as Modals from './ui/modals.js';
import * as Banners from './ui/banners.js';
import * as Progress from './ui/progress.js';
import * as UI from './ui/ui.js';

console.log('[main.js] DOMContentLoaded fired');

// === CRITICAL: Elevate main DOM containers to top-scope ===
const gridContainer = document.getElementById('prompt-list');
const bannerContainer = document.getElementById('toast');
const modalContainer = document.getElementById('prompt-detail-modal');
window.addEventListener('DOMContentLoaded', () => {

    // === BEGIN CRITICAL UI BUTTON STABILIZATION PATCH ===

    // Diagnostic log to show patch is loaded in dev console
    console.log('[PATCH] Button stabilization patch loaded (DOM ready)');

    // --- STATE ---
    let gridViewMode = 'grid'; // Can be toggled by view buttons
    // Use existing filterState global (already in main.js), no need to redeclare

    // --- ELEMENTS ---
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const sidebarEl = document.getElementById('sidebar');
    const listViewBtn = document.getElementById('list-view-btn');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const addPromptBtn = document.getElementById('add-prompt-btn');
    const crudModalEl = document.getElementById('crud-modal');
    // Use global gridContainer, bannerContainer, modalContainer already declared elsewhere.
    const promptListLoading = document.getElementById('prompt-list-loading');

    // --- ERROR UI/STABILIZER UTILS ---
    // Show toast and log
    function showErrorUI(message, detail, alwaysBanner=false) {
      console.error('[UI/STABILIZER]', message, detail || '');
      try {
        if (UI && typeof UI.showToast === 'function')
          UI.showToast(message, 'danger', 5300);
        if (Banners && typeof Banners.showBanner === 'function')
          Banners.showBanner(bannerContainer, { ok: false, message, detail });
        if (alwaysBanner) return;
      } catch (e) {
        // fallback
        alert(message + (detail ? (': ' + detail) : ''));
      }
    }

    // --- SIDEBAR TOGGLE WORKFLOW ---
    if (sidebarToggleBtn && sidebarEl) {
      sidebarToggleBtn.addEventListener('click', () => {
        try {
          sidebarEl.classList.toggle('collapsed');
          const nowCollapsed = sidebarEl.classList.contains('collapsed');
          console.log('[UI/PATCH] Sidebar toggle', { nowCollapsed });
          if (UI && typeof UI.showToast === 'function') {
            UI.showToast(nowCollapsed ? 'Sidebar hidden' : 'Sidebar shown', 'info', 1300);
          }
        } catch (err) {
          showErrorUI('Sidebar failed to toggle', err.message || err);
        }
      });
    }

    // --- VIEW MODE (LIST/GRID) BUTTONS ---
    if (listViewBtn && gridViewBtn && gridContainer && typeof Grid.renderGrid === 'function') {
      listViewBtn.addEventListener('click', async () => {
        try {
          gridViewMode = 'list';
          listViewBtn.classList.add('active');
          gridViewBtn.classList.remove('active');
          await renderCurrentGridSafe();
          if (UI && typeof UI.showToast === 'function')
            UI.showToast('List view enabled', 'info');
          console.log('[UI/PATCH] Switched to list view');
        } catch (err) {
          showErrorUI('Could not switch to list view', err.message || err);
        }
      });

      gridViewBtn.addEventListener('click', async () => {
        try {
          gridViewMode = 'grid';
          gridViewBtn.classList.add('active');
          listViewBtn.classList.remove('active');
          await renderCurrentGridSafe();
          if (UI && typeof UI.showToast === 'function')
            UI.showToast('Grid view enabled', 'info');
          console.log('[UI/PATCH] Switched to grid view');
        } catch (err) {
          showErrorUI('Could not switch to grid view', err.message || err);
        }
      });
    }

    // --- ADD PROMPT BUTTON ---
    if (addPromptBtn && crudModalEl) {
      addPromptBtn.addEventListener('click', async () => {
        try {
          // Open CRUD modal in "add" mode.
          Modals.renderCrudModal(crudModalEl, 'add', {}, {
            onSave: async (newPrompt) => {
              try {
                promptListLoading?.classList.remove('hidden');
                const result = await promptsApi.createPrompt(newPrompt);
                if (result && !result.code) {
                  if (UI && typeof UI.showToast === 'function') UI.showToast('Prompt added!', 'success');
                  // Refetch and rerender
                  allData = await promptsApi.listPrompts();
                  await renderCurrentGridSafe();
                  await fetchSidebarDataAndRender();
                } else {
                  showErrorUI('Failed to save prompt', result?.message || JSON.stringify(result));
                }
              } catch (err) {
                showErrorUI('Prompt save failed', err.message || err);
              } finally {
                promptListLoading?.classList.add('hidden');
              }
            }
          });
          console.log('[UI/PATCH] Opened add prompt dialog');
        } catch (err) {
          showErrorUI('Could not open add prompt dialog', err.message || err);
        }
      });
    }

    // --- ENSURE MODAL CLOSE BUTTONS ALWAYS ATTACHED ---
    // Defensive: also patch modal close outside modal.js logic
    function wireModalCloseButtons() {
      document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = function() {
          try {
            const modal = btn.closest('.modal');
            if(modal && typeof Modals.closeModal === 'function') {
              Modals.closeModal(modal);
              if (UI && typeof UI.showToast === 'function') UI.showToast('Modal closed', 'info', 1000);
            }
          } catch (e) {
            showErrorUI('Failed to close modal window', e.message || e);
          }
        };
      });
    }
    wireModalCloseButtons();

    // --- REUSABLE UTILITY TO RENDER THE PROMPT GRID BASED ON ALL STATES ---
    async function renderCurrentGridSafe() {
      try {
        const viewMode = gridViewMode;
        if (!Array.isArray(allData)) {
          allData = await promptsApi.listPrompts();
        }
        Grid.renderGrid(
          gridContainer,
          allData,
          { view: viewMode, modalContainer }
        );
      } catch (err) {
        showErrorUI('Failed to render prompts', err.message || err);
      }
    }

    // --- GLOBAL ERROR HANDLING ---
    window.onerror = function (msg, src, line, col, err) {
      const detail = (err && err.stack) ? err.stack : (`${src}@${line}:${col}` || '');
      showErrorUI('[JS Fatal Error] ' + msg, detail, true);
      return false; // allow normal error flow too
    };
    window.onunhandledrejection = function(e) {
      let reason = (e && e.reason) || (typeof e === 'object' ? JSON.stringify(e) : String(e));
      showErrorUI('[Promise Error] ' + reason, '', true);
      return false;
    };

    // --- TEMP DEBUG LOGS FOR BUTTONS ---
    ['sidebar-toggle','show-my-prompts','list-view-btn','grid-view-btn','add-prompt-btn'].forEach(id=>{
      const btn = document.getElementById(id);
      if(btn) btn.addEventListener('click',()=>console.log(`[DIAG-CLICK] Button #${id} clicked`));
    });

    // === END CRITICAL UI BUTTON STABILIZATION PATCH ===

    // ========== THEME TOGGLE LOGIC ==========

    const THEME_KEY = 'theme-mode'; // 'auto'|'dark'|'light'
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle');
    const toggleIcon = document.getElementById('theme-toggle-icon');
    const themeModes = ['auto', 'dark', 'light'];
    const icons = { auto: '🌓', dark: '🌙', light: '☀️' };
    // Ensure toggleBtn is fully ARIA compliant.
    if (toggleBtn) {
        toggleBtn.setAttribute('type', 'button');
        toggleBtn.setAttribute('role', 'switch');
        toggleBtn.tabIndex = 0;
        // For screen readers: live region for announcements
        toggleBtn.setAttribute('aria-live', 'polite');
    }

    function getPreferredScheme() {
        console.log('[LOG] main.js:getPreferredScheme entry');
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            console.log('[LOG] main.js:getPreferredScheme found dark');
            return 'dark';
        }
        console.log('[LOG] main.js:getPreferredScheme found light');
        return 'light';
    }

    function loadThemeMode() {
        const stored = localStorage.getItem(THEME_KEY);
        const resolved = themeModes.includes(stored) ? stored : 'auto';
        console.log('[LOG] main.js:loadThemeMode', { stored, resolved });
        return resolved;
    }

    function applyTheme(mode) {
        console.log('[LOG] main.js:applyTheme entry', { mode });
        // Remove all theme classes first
        body.classList.remove('dark', 'light');
        if (mode === 'dark') {
            body.classList.add('dark');
            console.log('[LOG] main.js:applyTheme set dark');
        } else if (mode === 'light') {
            body.classList.add('light');
            console.log('[LOG] main.js:applyTheme set light');
        }
        // else: auto, no override (just .classList clean)
        setButtonState(mode);
        console.log('[LOG] main.js:applyTheme complete', { mode });
    }

    function setButtonState(mode) {
        if (!toggleBtn || !toggleIcon) {
            console.warn('[WARN] main.js:setButtonState: toggleBtn or toggleIcon missing!');
            return;
        }
        // ARIA-pressed is true for override, false for auto
        const isOverride = (mode === 'dark' || mode === 'light');
        toggleBtn.setAttribute('aria-pressed', String(isOverride));
        toggleBtn.setAttribute('aria-label', `Color theme: ${mode.charAt(0).toUpperCase() + mode.slice(1)}. Press to change`);
        toggleBtn.setAttribute('title', `Theme: ${mode.charAt(0).toUpperCase() + mode.slice(1)} (click or press space/enter to switch)`);
        toggleIcon.textContent = icons[mode] || '🌓';
        // Optionally: visually signal override vs. auto via style
        toggleBtn.classList.toggle('theme-override', isOverride);
        console.log('[LOG] main.js:setButtonState', { mode, isOverride });
    }

    function persistThemeMode(mode) {
        localStorage.setItem(THEME_KEY, mode);
    }

    function cycleThemeMode(current) {
        const idx = themeModes.indexOf(current);
        const next = themeModes[(idx + 1) % themeModes.length];
        console.log('[LOG] main.js:cycleThemeMode', { current, next });
        return next;
    }

    function handleThemeChange(mode) {
        console.log('[LOG] main.js:handleThemeChange entry', { mode });
        applyTheme(mode);
        persistThemeMode(mode);
        console.log('[LOG] main.js:handleThemeChange complete', { mode });
    }

    // Attach all theme events/listeners
    if (toggleBtn && toggleIcon) {
        let mode = loadThemeMode();
        applyTheme(mode);

        // System theme change (auto mode only)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (loadThemeMode() === 'auto') applyTheme('auto');
        });

        // Click handler: cycle, apply, persist
        toggleBtn.addEventListener('click', (e) => {
            let current = loadThemeMode();
            let next = cycleThemeMode(current);
            handleThemeChange(next);
        });

        // Keyboard accessibility: Space/Enter cycles
        toggleBtn.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                let current = loadThemeMode();
                let next = cycleThemeMode(current);
                handleThemeChange(next);
            }
        });
    }

    // ========== END THEME TOGGLE LOGIC ==========

    // ========== ARIA: Ensure live regions for feedback (toast/banner) ==========

    // [Remediation] Move DOM containers before their first usage to avoid TDZ/ReferenceError
    const sidebarContainer = document.getElementById('sidebar');
    const progressContainer = document.getElementById('prompt-list-loading');

    if (bannerContainer) bannerContainer.setAttribute('aria-live', 'polite');
    if (progressContainer) progressContainer.setAttribute('aria-live', 'polite');

    // === App State ===
    let filterState = { category: null, tag: null, myPrompts: false };
    let allData = [];
    let categories = [];
    let tags = [];

    // === Boot and fetch all needed data ===
    async function fetchSidebarDataAndRender() {
        console.log('[LOG] main.js:fetchSidebarDataAndRender entry');
        categories = await promptsApi.listCategories() || [];
        tags = await promptsApi.listTags() || [];
        renderSidebar();
        console.log('[LOG] main.js:fetchSidebarDataAndRender complete', { categories: categories.length, tags: tags.length });
    }

    function renderSidebar() {
        console.log('[LOG] main.js:renderSidebar entry', { categories, tags, filters: filterState });
        Sidebar.renderSidebar(sidebarContainer, {
            categories: Array.isArray(categories) ? categories : [],
            tags: Array.isArray(tags) ? tags : [],
            filters: { ...filterState }
        });
        Sidebar.bindSidebar(sidebarContainer, { filters: { ...filterState } }, handleSidebarFilterUpdate);
        console.log('[LOG] main.js:renderSidebar complete');
    }

    async function handleSidebarFilterUpdate(newFilters) {
        console.log('[LOG] main.js:handleSidebarFilterUpdate entry', { newFilters });
        filterState = { ...filterState, ...newFilters };
        // If a category is chosen, clear tag (vice versa)
        if (filterState.category) filterState.tag = null;
        if (filterState.tag) filterState.category = null;

        let filtered = allData;
        try {
            if (filterState.category) {
                filtered = await promptsApi.filterPromptsByCategory(filterState.category) || [];
            } else if (filterState.tag) {
                filtered = await promptsApi.filterPromptsByTag(filterState.tag) || [];
            }
            console.log('[LOG] main.js:handleSidebarFilterUpdate got filtered', { filteredLength: filtered?.length });
            Grid.renderGrid(gridContainer, filtered || [], { modalContainer });
            renderSidebar();
            console.log('[LOG] main.js:handleSidebarFilterUpdate complete');
        } catch (e) {
            console.error('[ERROR] main.js:handleSidebarFilterUpdate failed', e);
            Banners?.showBanner(bannerContainer, { ok: false, message: 'Sidebar filter failed', detail: String(e) });
            if (UI && typeof UI.showToast === 'function') UI.showToast('Network error: Failed to apply filter. Please try again.', 'danger');
        }
    }

    /**
     * Checks asset versioning for JS, CSS, images and reloads if changes detected.
     * Logs to console on error for easier debugging.
     */
    function checkAssetsAndMaybeReload() {
        console.log('[LOG] main.js:checkAssetsAndMaybeReload entry');
        try {
            const prev = JSON.parse(localStorage.getItem('assetVersions') || '{}');
            const latest = CONFIG.assetVersions || {};
            let stale = false;
            for (const key of Object.keys(latest)) {
                if (prev[key] && prev[key] !== latest[key]) stale = true;
            }
            localStorage.setItem('assetVersions', JSON.stringify(latest));
            if (stale) {
                UI.showToast?.('Assets updated, reloading...', 'info', 1900);
                setTimeout(() => location.reload(), 250);
                console.warn('[WARN] main.js: Asset version mismatch, scheduled reload.');
            }
            console.log('[LOG] main.js:checkAssetsAndMaybeReload complete', { stale });
        } catch (e) {
            console.error('[ERROR] main.js:checkAssetsAndMaybeReload failed:', e);
        }
    }

    let lastHealth = { ok: true };
    async function handleHealthUpdate() {
        console.log('[LOG] main.js:handleHealthUpdate entry');
        try {
            const health = await dbApi.checkBackendHealth();
            lastHealth = health;
            if (!health.ok) {
                Banners.showBanner(bannerContainer, health);
                UI.showHealthStatus?.(health);
                disableUiForHealth();
                console.warn('[WARN] main.js:handleHealthUpdate backend not ok', { health });
            } else {
                Banners.hideBanner?.(bannerContainer);
                UI.hideHealthStatus?.();
                enableUiIfHealthy();
                console.log('[LOG] main.js:handleHealthUpdate backend ok', { health });
            }
        } catch (e) {
            Banners.showBanner(bannerContainer, { ok: false, message: 'Backend error', detail: String(e) });
            if (UI && typeof UI.showToast === 'function') UI.showToast('Network error: Backend unavailable. Please try again.', 'danger');
            UI.showHealthStatus?.({ ok: false, message: 'Backend error' });
            disableUiForHealth();
            console.error('[ERROR] main.js:handleHealthUpdate failed', e);
        }
    }
    function disableUiForHealth() {
        console.log('[LOG] main.js:disableUiForHealth');
        Grid.destroyGrid?.(gridContainer);
        Sidebar.renderSidebar?.(sidebarContainer, { disabled: true });
        Modals.openModal?.(modalContainer, { error: 'Backend Unavailable', disableActions: true });
        Progress.renderProgress?.(progressContainer, { busy: false, disabled: true });
    }
    function enableUiIfHealthy() {
        console.log('[LOG] main.js:enableUiIfHealthy');
        renderSidebar();
        Progress.renderProgress?.(progressContainer, { busy: false, disabled: false });
    }
    /**
     * Polls backend health at interval constrained by config (>=5s).
     * Throws if pollRates.healthCheckMs < 5000 to prevent spam.
     */
    function startHealthPolling() {
        console.log('[LOG] main.js:startHealthPolling entry');
        if (CONFIG.pollRates.healthCheckMs < 5000) {
            throw new Error('healthCheckMs poll interval must be >= 5000ms');
        }
        setInterval(() => {
            console.log('[LOG] main.js:startHealthPolling -- triggering handleHealthUpdate');
            handleHealthUpdate();
        }, CONFIG.pollRates.healthCheckMs);
        handleHealthUpdate();
        console.log('[LOG] main.js:startHealthPolling scheduled every', CONFIG.pollRates.healthCheckMs, 'ms');
    }

    /**
     * Boots main app grid and sidebar, loads data, handles errors gracefully.
     * All mutations/side effects are contained.
     */
    async function bootGridAndSidebar() {
        console.log('[LOG] main.js:bootGridAndSidebar entry');
        if (!CONFIG.featureToggles.enableGrid) {
            console.log('[LOG] main.js:bootGridAndSidebar grid disabled');
            return;
        }
        try {
            allData = await promptsApi.listPrompts() || [];
            Grid.renderGrid(gridContainer, allData, { modalContainer });
            await fetchSidebarDataAndRender();
            console.log('[LOG] main.js:bootGridAndSidebar loaded', { allDataLength: allData.length });
        } catch (e) {
            console.error('[ERROR] main.js:bootGridAndSidebar failed:', e);
            Banners.showBanner(bannerContainer, { ok: false, message: 'Error loading data', detail: String(e) });
            UI.showToast?.('Grid failed to load', 'danger', 5400);
            Grid.destroyGrid?.(gridContainer);
        }
    }

    function wireModalsAndFeedback() {
        console.log('[LOG] main.js:wireModalsAndFeedback');
        Modals.renderPromptDetailModal?.(modalContainer, null, {
            onError: (err) => {
                console.error('[ERROR] main.js:wireModalsAndFeedback detail modal error', err);
                UI.showToast?.(err.message || 'Detail failed', 'danger');
                Banners.showBanner?.(bannerContainer, { ok: false, message: err.message });
            }
        });
        Modals.renderBatchImportModal?.(modalContainer, {
            onProgress: (progress) => {
                console.log('[LOG] main.js:renderBatchImportModal progress', progress);
                Progress.updateProgress?.(progressContainer, progress);
            },
            onError: (err) => {
                console.error('[ERROR] main.js:renderBatchImportModal error', err);
                UI.showToast?.(err.message || 'Import failed', 'danger');
                Banners.showBanner?.(bannerContainer, { ok: false, message: err.message });
            }
        });
    }

    function hookProgressModule() {
        console.log('[LOG] main.js:hookProgressModule');
        Progress.renderProgress(progressContainer, { busy: false });
    }

    function wireDevTestHooks() {
        if (window && window.location && window.location.search.includes('devhooks')) {
            console.log('[LOG] main.js:wireDevTestHooks: DEV HOOKS ENABLED');
            window.appDevTools = {
                simulateHealth: (s) => {
                    console.log('[LOG] appDevTools.simulateHealth', s);
                    Banners.devSimulateBannerState(bannerContainer, s);
                },
                simulateGrid: (s) => {
                    console.log('[LOG] appDevTools.simulateGrid', s);
                    Grid.devSimulateGridState(gridContainer, s);
                },
                simulateModals: (s) => {
                    console.log('[LOG] appDevTools.simulateModals', s);
                    Modals.devSimulateModalState(modalContainer, s);
                },
                simulateProgress: (s) => {
                    console.log('[LOG] appDevTools.simulateProgress', s);
                    Progress.devSimulateProgressState(progressContainer, s);
                },
                simulateSidebar: (s) => {
                    console.log('[LOG] appDevTools.simulateSidebar', s);
                    Sidebar.devSimulateSidebarState(sidebarContainer, s);
                },
                apiSimulateError: (opts) => {
                    console.log('[LOG] appDevTools.apiSimulateError', opts);
                    dbApi.devTestHook?.(opts);
                },
            };
        }
    }

    /**
     * Ensures global app accessibility: Escape closes modal, ARIA/keyboard hooks.
     */
    function accessibilityWiring() {
        console.log('[LOG] main.js:accessibilityWiring');
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modalContainer) {
                console.log('[LOG] main.js:accessibilityWiring Escape key pressed');
                Modals.closeModal?.(modalContainer);
                if (typeof modalContainer.blur === "function") modalContainer.blur();
            }
        });
    }

    /**
     * Main block orchestrator: boots all critical modules (idempotent).
     */
    (function main() {
        console.log('[LOG] main.js:main() entry');
        checkAssetsAndMaybeReload();
        startHealthPolling();
        if (CONFIG.featureToggles.enableGrid) {
            bootGridAndSidebar();
        }
        wireModalsAndFeedback();
        hookProgressModule();
        wireDevTestHooks();
        // [PATCH] Removed call to Sidebar.initSidebarToggle(); function does not exist after refactor.
        accessibilityWiring();
        if (CONFIG.featureToggles.enableAdminPanel) {
            UI.showToast?.('Admin panel enabled', 'info');
            console.log('[LOG] main.js:main() admin panel enabled');
        }
        console.log('[LOG] main.js:main() complete');
    })();
});