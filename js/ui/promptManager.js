/**
 * Prompt Manager Module
 * Handles prompt CRUD, rendering, filtering, and pagination.
 * Extracted from main.js for modularity and maintainability.
 */
import { escapeHtml, renderMarkdownToHTML } from '../util/helpers.js';
import { debugLog, logCriticalError } from '../util/debugLogger.js';
import { getCategories, getTags, getPrompts, setPrompts, subscribe } from '../state/appState.js';
import { trackEvent } from '../util/analytics.js';

export function initPromptManager({
  promptList,
  loadMoreBtn,
  filterCategory,
  filterTag,
  clearFiltersBtn,
  categories,
  tags,
  PAGE_SIZE = 5,
  showToast
}) {
  console.log('[initPromptManager] function called');
  let shownCount = 0;
  let searchQuery = '';
  let filterCategoryValue = '';
  let filterTagName = '';

  // --- Accessibility: Live region for prompt list updates ---
  let liveRegion = document.getElementById('prompt-list-live-region');
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = 'prompt-list-live-region';
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('role', 'status');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-9999px';
    liveRegion.style.height = '1px';
    liveRegion.style.width = '1px';
    liveRegion.style.overflow = 'hidden';
    promptList.parentNode.insertBefore(liveRegion, promptList);
  }

  // --- Loading indicator state ---
  let isFiltering = false;


  async function fetchPrompts() {
    debugLog('Entered fetchPrompts');
    promptList.innerHTML = 'Loading...';
    try {
      debugLog('Fetching prompts from /api/prompts.php');
      const res = await fetch('/api/prompts.php');
      const data = await res.json();
      if (data.ok && Array.isArray(data.prompts)) {
        setPrompts(data.prompts);
        shownCount = 0;
        debugLog('Prompts loaded:', data.prompts.length);
        renderPrompts();
        debugLog('fetchPrompts completed successfully');
      } else {
        promptList.innerHTML = 'Failed to load prompts.';
        debugLog('Failed to load prompts: bad response', data);
        debugLog('fetchPrompts completed with bad response');
      }
    } catch (err) {
      promptList.innerHTML = 'Error loading prompts.';
      if (showToast) showToast('Error loading prompts');
      debugLog('Error loading prompts:', err);
      console.error(err);
      debugLog('fetchPrompts encountered an error');
      logCriticalError('Failed to fetch prompts', err && err.stack ? err.stack : String(err));
    }
    debugLog('Exiting fetchPrompts');
  }

  // --- Helper: Filter prompts based on current state ---
  function filterPrompts(allPrompts, categories, tags) {
    let filtered = allPrompts;
    if (!searchQuery && !filterCategoryValue && !filterTagName) {
      console.log('[DIAG][AllPrompts] No filters applied, returning all prompts. allPrompts.length:', allPrompts.length);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        p => {
          // Search in title, content, prompt, category name, and tag names
          const titleMatch = p.title && p.title.toLowerCase().includes(q);
          const contentMatch = p.content && p.content.toLowerCase().includes(q);
          const promptMatch = p.prompt && p.prompt.toLowerCase().includes(q);
          // Category name match
          let categoryMatch = false;
          if (p.category && Array.isArray(categories) && categories.length) {
            const cat = categories.find(c => c.id === p.category);
            if (cat && cat.name && cat.name.toLowerCase().includes(q)) categoryMatch = true;
          }
          // Tag name match
          let tagMatch = false;
          if (Array.isArray(p.tags) && p.tags.length && Array.isArray(tags) && tags.length) {
            tagMatch = p.tags.some(tid => {
              const tag = tags.find(t => t.id === tid);
              return tag && tag.name && tag.name.toLowerCase().includes(q);
            });
          }
          return titleMatch || contentMatch || promptMatch || categoryMatch || tagMatch;
        }
      );
    }
    if (filterCategoryValue) {
      filtered = filtered.filter(p => {
        // Always log for diagnosis
        console.log('[DIAG][CategoryFilter] p.id:', p.id, 'p.category:', p.category, typeof p.category, 'filterCategoryValue:', filterCategoryValue, typeof filterCategoryValue, 'match:', p.category === filterCategoryValue, 'looseMatch:', p.category == filterCategoryValue);
        return p.category === filterCategoryValue;
      });
    }
    if (filterTagName) {
      filtered = filtered.filter(p =>
        Array.isArray(p.tags) && Array.isArray(tags) &&
        p.tags.some(tid => {
          const tag = tags.find(t => t.id === tid);
          // Always log for diagnosis
          console.log('[DIAG][TagFilter] p.id:', p.id, 'tid:', tid, typeof tid, 'filterTagName:', filterTagName, typeof filterTagName, 'tag.name:', tag && tag.name, typeof (tag && tag.name), 'matchName:', tag && tag.name === filterTagName, 'matchId:', tid === filterTagName, 'looseMatchId:', tid == filterTagName);
          // Match by tag name or fallback to tag ID
          return (tag && tag.name === filterTagName) || tid === filterTagName;
        })
      );
    }
    return filtered;
  }

  // --- Helper: Render prompt list and bind events ---
  function renderPromptList(toShow, categories, tags) {
    promptList.setAttribute('data-testid', 'prompt-list');
    promptList.innerHTML = toShow.map((p, idx) => {
      // Render tags as clickable elements
      let tagHtml = '';
      if (Array.isArray(p.tags) && p.tags.length && Array.isArray(tags)) {
        tagHtml = `<span style="margin-left:1em;"><strong>Tags:</strong> ` +
          p.tags.map(tid => {
            const tag = tags.find(t => t.id === tid);
            const tagName = tag ? tag.name : tid;
            return `<button type="button" class="tag-pill tag-link" data-tag="${escapeHtml(tagName)}" title="${escapeHtml(tagName)}" aria-label="Filter by tag ${escapeHtml(tagName)}" role="button" aria-pressed="false" tabindex="0">${escapeHtml(tagName)}</button>`;
          }).join('') +
          `</span>`;
      }
      // Title fallback and safety
      let safeTitle = (p.title || '').trim();
      if (!safeTitle || safeTitle.length < 2 || ['s', '1', 'as'].includes(safeTitle.toLowerCase())) {
        safeTitle = '<span style="font-style:italic;color:#888;">Untitled</span>';
      } else if (safeTitle.length > 48) {
        safeTitle = escapeHtml(safeTitle.slice(0, 45)) + '…';
      } else {
        safeTitle = escapeHtml(safeTitle);
      }
      // Category display
      let catName = '';
      if (p.category && Array.isArray(categories) && categories.length) {
        const cat = categories.find(c => c.id === p.category);
        catName = cat && cat.name ? cat.name : '';
      }
      if (!catName) catName = '<span style="font-style:italic;color:#aaa;">Uncategorized</span>';
      // Tag display
      let tagBlock = tagHtml;
      if (!Array.isArray(p.tags) || !p.tags.length) {
        tagBlock = `<span class="tag-pill" style="font-style:italic;color:#aaa;">No tags</span>`;
      }
      return `
        <div class="prompt" data-idx="${idx}" data-testid="prompt-block" data-id="${p.id}" tabindex="0" aria-label="Prompt: ${safeTitle.replace(/<[^>]+>/g, '')}">
          <div class="prompt-title" data-testid="prompt-title" data-id="${p.id}">${safeTitle}</div>
          <div class="prompt-content">${renderMarkdownToHTML(p.content || p.prompt || '')}</div>
          <div class="prompt-meta" style="font-size:0.9em;color:#555;">
            <span><strong>Category:</strong> ${catName}</span>
            ${tagBlock}
          </div>
        </div>
      `;
    }).join('');
    // Add click listeners for tag links
    Array.from(promptList.getElementsByClassName('tag-link')).forEach(el => {
      el.addEventListener('click', e => {
        debugLog('Entered tag pill click event handler');
        try {
          e.preventDefault();
          filterTag.value = el.getAttribute('data-tag');
          filterTagName = el.getAttribute('data-tag');
          debugLog('Tag pill clicked:', filterTagName);
          trackEvent('filter_by_tag', { tag: filterTagName });
          renderPrompts();
          debugLog('tag pill click event handler completed successfully');
        } catch (err) {
          debugLog('Error handling tag pill click:', err);
          if (showToast) showToast('Error filtering by tag.');
          debugLog('tag pill click event handler encountered an error');
        }
        debugLog('Exiting tag pill click event handler');
      });
      // Keyboard accessibility: support Enter/Space
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          el.click();
        }
      });
      // Focus/active/hover styles for accessibility
      el.addEventListener('focus', () => {
        el.style.outline = '2px solid #1976d2';
        el.style.background = '#b3e5fc';
      });
      el.addEventListener('blur', () => {
        el.style.outline = '';
        el.style.background = '#e0e0e0';
      });
      el.addEventListener('mouseover', () => { el.style.background = '#d0eaff'; });
      el.addEventListener('mouseout', () => { el.style.background = '#e0e0e0'; });
    });
  }

  // --- Main renderPrompts function (now orchestrates helpers, handles loading, live region, analytics) ---
  function renderPrompts() {
    debugLog('Entered renderPrompts');
    try {
      isFiltering = true;
      promptList.innerHTML = '<span class="loading-indicator" aria-live="polite">Filtering...</span>';
      if (liveRegion) liveRegion.textContent = 'Filtering prompts...';
      setTimeout(() => {
        debugLog('Rendering prompts');
        // Use appState for categories, tags, prompts
        const allPrompts = getPrompts();
        const categories = Array.isArray(getCategories()) ? getCategories() : [];
        const tags = Array.isArray(getTags()) ? getTags() : [];

        // Filter prompts by search, category, and tag
        const filtered = filterPrompts(allPrompts, categories, tags);

        // --- Filter summary UI ---
        const filterSummary = document.getElementById('filter-summary');
        let summaryText = 'Showing all prompts';
        if (filterCategoryValue || filterTagName) {
          let catText = '';
          let tagText = '';
          if (filterCategoryValue && Array.isArray(categories)) {
            const cat = categories.find(c => c.id === filterCategoryValue);
            catText = cat ? `Category: ${escapeHtml(cat.name)}` : '';
          }
          if (filterTagName) {
            tagText = `Tag: ${escapeHtml(filterTagName)}`;
          }
          summaryText = 'Showing prompts';
          if (catText) summaryText += ` in ${catText}`;
          if (tagText) summaryText += (catText ? ', ' : ' ') + tagText;
        }
        if (filterSummary) filterSummary.textContent = summaryText;

        const toShow = filtered.slice(0, shownCount + PAGE_SIZE);
        shownCount = toShow.length;
        if (!toShow.length) {
          promptList.innerHTML = '<em>No prompts found.</em>';
          loadMoreBtn.style.display = 'none';
          if (liveRegion) liveRegion.textContent = 'No prompts found.';
          debugLog('No prompts found for current filters');
          trackEvent('filter_no_results', {
            search: searchQuery,
            category: filterCategoryValue,
            tag: filterTagName
          });
          isFiltering = false;
          return;
        }
        renderPromptList(toShow, categories, tags);
        if (shownCount < filtered.length) {
          loadMoreBtn.style.display = '';
        } else {
          loadMoreBtn.style.display = 'none';
        }
        if (liveRegion) liveRegion.textContent = `Showing ${toShow.length} prompts.`;
        trackEvent('filter_results', {
          search: searchQuery,
          category: filterCategoryValue,
          tag: filterTagName,
          count: toShow.length
        });
        debugLog(`Rendered ${toShow.length} prompts (of ${filtered.length} filtered)`);
        debugLog('renderPrompts completed successfully');
        isFiltering = false;
      }, 150); // Simulate async for loading indicator
    } catch (err) {
      debugLog('Error rendering prompts:', err);
      if (showToast) showToast('Error rendering prompts.');
      if (liveRegion) liveRegion.textContent = 'Error rendering prompts.';
      debugLog('renderPrompts encountered an error');
      isFiltering = false;
    }
    debugLog('Exiting renderPrompts');
  }

  // --- Filter event listeners ---
  if (filterCategory) {
    filterCategory.addEventListener('change', () => {
      debugLog('Entered filterCategory change event handler');
      try {
        filterCategoryValue = filterCategory.value;
        debugLog('Filter category changed:', filterCategoryValue);
        trackEvent('filter_category', { category: filterCategoryValue });
        renderPrompts();
        debugLog('filterCategory change event handler completed successfully');
      } catch (err) {
        debugLog('Error handling filter category change:', err);
        if (showToast) showToast('Error filtering by category.');
        debugLog('filterCategory change event handler encountered an error');
      }
      debugLog('Exiting filterCategory change event handler');
    });
  }
  if (filterTag) {
    filterTag.addEventListener('change', () => {
      debugLog('Entered filterTag change event handler');
      try {
        filterTagName = filterTag.value;
        debugLog('Filter tag changed:', filterTagName);
        trackEvent('filter_tag', { tag: filterTagName });
        renderPrompts();
        debugLog('filterTag change event handler completed successfully');
      } catch (err) {
        debugLog('Error handling filter tag change:', err);
        if (showToast) showToast('Error filtering by tag.');
        debugLog('filterTag change event handler encountered an error');
      }
      debugLog('Exiting filterTag change event handler');
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      debugLog('Entered clearFiltersBtn click event handler');
      try {
        console.log('[DIAG][ClearFilters] User clicked "all prompts" (clear filters) button');
        // 1. Dispatch global filterPrompts event with empty detail to reset all filters everywhere
        window.dispatchEvent(new CustomEvent('filterPrompts', { detail: {} }));
        debugLog('[DIAG][ClearFilters] Dispatched global filterPrompts event with empty detail');
        // 2. Reset local filter state and UI controls
        filterCategoryValue = '';
        filterTagName = '';
        if (filterCategory) filterCategory.value = '';
        if (filterTag) filterTag.value = '';
        debugLog('Local filters cleared');
        // 3. Force backend refresh
        fetchPrompts();
        debugLog('Called fetchPrompts to reload prompts from backend');
        trackEvent('clear_filters', {});
        debugLog('clearFiltersBtn click event handler completed successfully');
      } catch (err) {
        debugLog('Error clearing filters:', err);
        if (showToast) showToast('Error clearing filters.');
        debugLog('clearFiltersBtn click event handler encountered an error');
      }
      debugLog('Exiting clearFiltersBtn click event handler');
    });
  }

  // --- Undo for destructive actions: stub for future destructive actions ---
  // If destructive actions (e.g., delete prompt) are added here, implement undo logic as in modals.js/tagCategoryManager.js.
  // Example: showToast('Prompt deleted. Undo?', { action: () => restorePrompt(deletedPrompt) });
  // See AUDITFIX.MD for rationale.

  // --- Public API ---
  // Subscribe to appState changes to re-render prompts
  subscribe(() => renderPrompts());

  return {
    fetchPrompts,
    renderPrompts,
    setSearchQuery: (q) => {
      debugLog('Entered setSearchQuery');
      try {
        searchQuery = q;
        shownCount = 0;
        debugLog('Search query set:', q);
        trackEvent('search', { query: q });
        renderPrompts();
        debugLog('setSearchQuery completed successfully');
      } catch (err) {
        debugLog('Error setting search query:', err);
        if (showToast) showToast('Error searching prompts.');
        debugLog('setSearchQuery encountered an error');
      }
      debugLog('Exiting setSearchQuery');
    },
    getAllPrompts: () => getPrompts(),
    setCategories: () => {}, // No-op, use appState
    setTags: () => {},       // No-op, use appState

    // --- Modal openers for add/edit/import ---
  };
}
