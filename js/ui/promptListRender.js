// promptListRender.js - Rendering logic for Prompt List (virtualized list/grid, event delegation, a11y)

import { renderPromptBlock } from './renderPromptBlock.js';

// Main render function (virtualized, client-side filtering)
export function renderPrompts() {
  const currentParams = window.currentParams || {};
  const promptList = document.getElementById('prompt-list');
  const loading = document.getElementById('prompt-list-loading');
  if (loading) loading.classList.remove('hidden');
  if (!promptList) return;
  // --- UI/UX Safety: Ensure only one view class is present ---
  promptList.classList.remove('prompt-list', 'prompt-grid');
  const savedView = localStorage.getItem('promptViewMode') || 'grid';
  if (savedView === 'list') {
    promptList.classList.add('prompt-list');
  } else {
    promptList.classList.add('prompt-grid');
  }
  promptList.innerHTML = '';
  const viewMode = promptList.classList.contains('prompt-list') ? 'list' : (promptList.classList.contains('prompt-grid') ? 'grid' : 'unknown');

  // Fetch all prompts, categories, and tags in parallel
  Promise.all([
    window.fetchPrompts ? window.fetchPrompts({}) : import('../api/prompts.js').then(mod => mod.fetchPrompts({})),
    import('../api/categories.js').then(mod => mod.fetchCategories()),
    import('../api/tags.js').then(mod => mod.fetchTags())
  ])
  .then(([allPrompts, categories, tags]) => {
    // Filtering logic
    let filteredPrompts = allPrompts;
    if (currentParams.search && currentParams.search.trim() !== "") {
      const q = currentParams.search.trim().toLowerCase();
      filteredPrompts = filteredPrompts.filter(
        p =>
          (p.title && p.title.toLowerCase().includes(q)) ||
          (p.content && p.content.toLowerCase().includes(q))
      );
    }
    if (currentParams.userId && currentParams.userId === 'me' && window.session && window.session.user) {
      filteredPrompts = filteredPrompts.filter(p => p.author === window.session.user);
    }
    if (currentParams.category) {
      filteredPrompts = filteredPrompts.filter(p => p.category === currentParams.category);
    }
    if (currentParams.tag) {
      filteredPrompts = filteredPrompts.filter(p => Array.isArray(p.tags) && p.tags.includes(currentParams.tag));
    }
    if (window.app) {
      window.app.allPrompts = allPrompts;
      window.app.filteredPrompts = filteredPrompts;
    } else {
      window.app = { allPrompts, filteredPrompts };
    }

    // Handle empty state
    if (!Array.isArray(filteredPrompts) || filteredPrompts.length === 0) {
      let contextMsg = '';
      if (currentParams.search && currentParams.search.trim() !== "") {
        contextMsg = ` for: <strong>${currentParams.search}</strong>`;
      } else if (currentParams.category) {
        contextMsg = ` in category: <strong>${currentParams.category}</strong>`;
      } else if (currentParams.tag) {
        contextMsg = ` with tag: <strong>${currentParams.tag}</strong>`;
      }
      promptList.innerHTML = `
        <div style="
          display: flex;
          justify-content: center;
          align-items: center;
          height: 200px;
          background: rgba(255,255,255,0.02);
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          margin: 2em 0;
          font-size: 1.2em;
          color: #6c63ff;
          flex-direction: column;
        ">
          <div>
            <span style="font-weight: 600;">No prompts found${contextMsg}.</span>
          </div>
          <div style="margin-top: 0.5em; color: #888; font-size: 0.95em;">
            Try adjusting your search or filter criteria.
          </div>
        </div>
      `;
      if (loading) loading.classList.add('hidden');
      return;
    }
    if (loading) loading.classList.add('hidden');

    // --- Virtualization Parameters ---
    const ITEM_HEIGHT = viewMode === 'list' ? 140 : 260;
    const BUFFER = 6;
    let containerHeight = promptList.clientHeight || 600;
    let scrollTop = 0;
    let total = filteredPrompts.length;

    promptList.style.overflowY = 'auto';
    promptList.style.position = 'relative';
    promptList.tabIndex = 0;

    // --- KISS Debounce Utility ---
    function debounce(fn, delay) {
      let timer = null;
      return function (...args) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    }

    function updateContainerHeight() {
      containerHeight = promptList.clientHeight || 600;
    }
    // Debounced resize for performance
    const debouncedUpdateContainerHeight = debounce(updateContainerHeight, 50);
    window.addEventListener('resize', debouncedUpdateContainerHeight);
    updateContainerHeight();

    let topSpacer = document.createElement('div');
    let bottomSpacer = document.createElement('div');
    topSpacer.style.height = '0px';
    bottomSpacer.style.height = '0px';
    promptList.appendChild(topSpacer);
    promptList.appendChild(bottomSpacer);

    let renderedBlocks = [];

    // KISS/UI-SAFE: Only update DOM when visible range changes, minimize flicker
    let lastStartIdx = null;
    let lastEndIdx = null;
    function renderVisible() {
      const startIdx = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
      const endIdx = Math.min(total, Math.ceil((scrollTop + containerHeight) / ITEM_HEIGHT) + BUFFER);

      // Only update if range changed
      if (startIdx === lastStartIdx && endIdx === lastEndIdx) return;
      lastStartIdx = startIdx;
      lastEndIdx = endIdx;

      // Remove prompt blocks outside new range
      Array.from(promptList.children).forEach(child => {
        if (child !== topSpacer && child !== bottomSpacer) {
          const idx = parseInt(child.getAttribute('data-virtual-idx'), 10);
          if (isNaN(idx) || idx < startIdx || idx >= endIdx) {
            promptList.removeChild(child);
          }
        }
      });

      // Track currently rendered indices
      const existingBlocks = {};
      Array.from(promptList.children).forEach(child => {
        if (child !== topSpacer && child !== bottomSpacer) {
          const idx = parseInt(child.getAttribute('data-virtual-idx'), 10);
          if (!isNaN(idx)) existingBlocks[idx] = child;
        }
      });

      // Insert new prompt blocks for indices not already rendered
      let insertBeforeNode = bottomSpacer;
      const frag = document.createDocumentFragment();
      for (let i = endIdx - 1; i >= startIdx; i--) {
        if (!existingBlocks[i]) {
          const prompt = filteredPrompts[i];
          const block = renderPromptBlock(prompt, categories, tags, { debug: false, viewMode });
          block.style.position = 'absolute';
          block.style.top = `${i * ITEM_HEIGHT}px`;
          block.style.left = '0';
          block.style.right = '0';
          block.style.width = '100%';
          block.setAttribute('data-virtual-idx', i);
          if (viewMode === 'grid') {
            const colCount = Math.max(1, Math.floor(promptList.offsetWidth / 340));
            const col = i % colCount;
            const row = Math.floor(i / colCount);
            block.style.top = `${row * ITEM_HEIGHT}px`;
            block.style.left = `calc(${(col * 100) / colCount}% + ${col * 12}px)`;
            block.style.width = `calc(${100 / colCount}% - 12px)`;
          }
          frag.insertBefore(block, frag.firstChild);
        }
      }
      promptList.insertBefore(frag, insertBeforeNode);

      // Update spacers
      topSpacer.style.height = `${startIdx * ITEM_HEIGHT}px`;
      bottomSpacer.style.height = `${(total - endIdx) * ITEM_HEIGHT}px`;
    }

    function updateContainerMinHeight() {
      if (viewMode === 'grid') {
        const colCount = Math.max(1, Math.floor(promptList.offsetWidth / 340));
        const rowCount = Math.ceil(total / colCount);
        promptList.style.minHeight = `${rowCount * ITEM_HEIGHT}px`;
      } else {
        promptList.style.minHeight = `${total * ITEM_HEIGHT}px`;
      }
    }
    updateContainerMinHeight();

    function onScroll() {
      scrollTop = promptList.scrollTop;
      renderVisible();
    }
    // Debounced scroll for performance
    const debouncedOnScroll = debounce(onScroll, 16);
    promptList.addEventListener('scroll', debouncedOnScroll);

    renderVisible();

    // Debounced resize for all updates
    const debouncedResizeHandler = debounce(() => {
      updateContainerHeight();
      updateContainerMinHeight();
      renderVisible();
    }, 50);
    window.addEventListener('resize', debouncedResizeHandler);

    // --- Event Delegation for Prompt Block Actions ---
    promptList.addEventListener('click', (e) => {
      let block = e.target.closest('.prompt-block');
      if (!block) return;
      const idx = block.getAttribute('data-virtual-idx');
      const prompt = filteredPrompts[idx];
      if (!prompt) return;
      if (
        e.target === block ||
        e.target.classList.contains('prompt-content-preview') ||
        e.target.classList.contains('prompt-title')
      ) {
        window.dispatchEvent(new CustomEvent('openPromptModal', { detail: { prompt } }));
        return;
      }
      if (e.target.classList.contains('edit-btn')) {
        window.dispatchEvent(new CustomEvent('prompt:edit', { detail: { prompt } }));
        return;
      }
      if (e.target.classList.contains('delete-btn')) {
        window.dispatchEvent(new CustomEvent('prompt:delete', { detail: { promptId: prompt.id, prompt } }));
        return;
      }
      if (e.target.classList.contains('copy-btn')) {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(prompt.content || '').then(() => {
            if (window.showToast) window.showToast('Prompt copied to clipboard!');
          });
        }
        return;
      }
      if (e.target.classList.contains('fullview-btn')) {
        window.dispatchEvent(new CustomEvent('openFullPromptModal', { detail: { prompt } }));
        return;
      }
    });

    // Tag/category pill click (delegated)
    promptList.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-pill')) {
        const tagId = e.target.getAttribute('data-tag-id');
        if (tagId) {
          window.dispatchEvent(new CustomEvent('filterPrompts', { detail: { tag: tagId } }));
        }
      }
      if (e.target.classList.contains('category-pill')) {
        const categoryId = e.target.getAttribute('data-category-id');
        if (categoryId) {
          window.dispatchEvent(new CustomEvent('filterPrompts', { detail: { category: categoryId } }));
        }
      }
    });

    // Keyboard accessibility for tag/category pills
    promptList.addEventListener('keydown', (e) => {
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        e.target.classList.contains('tag-pill')
      ) {
        const tagId = e.target.getAttribute('data-tag-id');
        if (tagId) {
          window.dispatchEvent(new CustomEvent('filterPrompts', { detail: { tag: tagId } }));
          e.preventDefault();
        }
      }
      if (
        (e.key === 'Enter' || e.key === ' ') &&
        e.target.classList.contains('category-pill')
      ) {
        const categoryId = e.target.getAttribute('data-category-id');
        if (categoryId) {
          window.dispatchEvent(new CustomEvent('filterPrompts', { detail: { category: categoryId } }));
          e.preventDefault();
        }
      }
    });

    // Accessibility: keyboard navigation for prompt blocks
    promptList.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('prompt-block')) {
        const idx = e.target.getAttribute('data-virtual-idx');
        const prompt = filteredPrompts[idx];
        if (prompt) {
          window.dispatchEvent(new CustomEvent('openPromptModal', { detail: { prompt } }));
        }
      }
    });
  })
  .catch((err) => {
    if (loading) loading.classList.add('hidden');
    promptList.innerHTML = '<div style="padding:1em;color:red;">Error loading prompts.</div>';
  });
}

// Export for main entry
window.renderPrompts = renderPrompts;