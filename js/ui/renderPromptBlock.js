// renderPromptBlock.js - Modular Prompt Block Renderer with Full Debug Logging and Accessibility (2025 Audit Overhaul)

import { escapeHtml } from '../util/helpers.js';
import { fetchComments, addComment, deleteComment } from '../api/comments.js';
import { fetchResults, addResult, deleteResult } from '../api/results.js';
import { debugLog } from '../util/debugLogger.js';

/**
 * Render a single prompt block as a DOM element.
 * @param {Object} prompt - The prompt object.
 * @param {Array} categories - Array of category objects.
 * @param {Array} tags - Array of tag objects.
 * @param {Object} [options] - Optional settings.
 * @param {boolean} [options.debug] - Enable debug logging.
 * @returns {HTMLElement} The prompt block element.
 */
export function renderPromptBlock(prompt, categories = [], tags = [], options = {}) {
  const DEBUG = options.debug ?? (typeof window !== 'undefined' && window.DEBUG_MODE);
  const viewMode = options.viewMode || (typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem('promptViewMode') : 'grid');
  function debugLog(...args) {
    if (DEBUG) console.log('[renderPromptBlock]', ...args);
  }
  debugLog('PARAMS', { prompt, categories, tags, options, viewMode });

  // Explicit debug logging for author and description fields
  if (prompt) {
    debugLog('[renderPromptBlock] Prompt object author:', prompt.author);
    debugLog('[renderPromptBlock] Prompt object description:', prompt.description);
  } else {
    debugLog('[renderPromptBlock] Prompt object is missing or invalid:', prompt);
  }

  // DEBUG: Log if this is being called for modal or card
  debugLog('RENDER CONTEXT', { isModal: options.isModal, promptId: prompt.id });

  debugLog('START', { prompt, categories, tags, options });

  // Defensive: Validate input
  if (!prompt || typeof prompt !== 'object') {
    debugLog('Invalid prompt object', prompt);
    throw new Error('renderPromptBlock: prompt must be an object');
  }

  // Format timestamp if available
  let created = '';
  if (prompt.created_at) {
    const d = new Date(prompt.created_at);
    created = !isNaN(d) ? d.toLocaleString() : escapeHtml(prompt.created_at);
  }

  // Map category ID to name
  let categoryName = '';
  let categoryId = '';
  let categoryDeleted = false;
  if (prompt.category && Array.isArray(categories)) {
    debugLog('CATEGORY SEARCH', { promptCategory: prompt.category, categories });
    const cat = categories.find(c => c.id === prompt.category);
    if (cat && cat.name) {
      categoryName = cat.name;
      categoryId = cat.id;
      debugLog('CATEGORY FOUND', { categoryName, categoryId });
    } else {
      debugLog('CATEGORY NOT FOUND', { promptCategory: prompt.category });
      categoryDeleted = true;
    }
  }
  if (!categoryName) {
    if (categoryDeleted) {
      categoryName = 'Deleted Category';
    } else {
      categoryName = 'No category';
    }
  }

  // Map tag IDs to names
  let tagObjs = [];
  let missingTagIds = [];
  if (Array.isArray(prompt.tags) && Array.isArray(tags)) {
    debugLog('TAGS SEARCH', { promptTags: prompt.tags, tags });
    tagObjs = prompt.tags.map(tid => {
      const tag = tags.find(t => t.id === tid);
      if (tag && tag.name) {
        debugLog('TAG FOUND', { tid, tagName: tag.name });
        return tag;
      } else {
        debugLog('TAG NOT FOUND', { tid });
        missingTagIds.push(tid);
        // Mark as deleted tag
        return { id: tid, name: 'Deleted Tag', _deleted: true };
      }
    });
  }

  // Title: fallback and truncation
  let title = (prompt.title || '').trim();
  if (!title || title.length < 2 || ['s', '1', 'as'].includes(title.toLowerCase())) {
    debugLog('TITLE FALLBACK', { original: prompt.title });
    title = 'Untitled';
  } else if (title.length > 48) {
    title = escapeHtml(title.slice(0, 45)) + '…';
  } else {
    title = escapeHtml(title);
  }
  debugLog('TITLE FINAL', { title, original: prompt.title });

  // DEBUG: Log if title contains HTML tags
  if (/<[a-z][\s\S]*>/i.test(prompt.title || '')) {
    debugLog('TITLE CONTAINS HTML', { original: prompt.title });
  }

  // Content preview: 1–2 lines, fallback if empty
  let contentPreview = (prompt.content || '').trim();
  if (!contentPreview) contentPreview = '<span style="color:#bbb;">No content added</span>';
  else if (contentPreview.length > 120) contentPreview = escapeHtml(contentPreview.slice(0, 117)) + '…';
  else contentPreview = escapeHtml(contentPreview);

  // Description: fallback for missing fields, truncate for card
  let description = (prompt.description || '').trim();
  if (description.length > 80) {
    console.log('[DIAG][PROMPT CARD] Description truncated:', { original: prompt.description, truncated: description.slice(0, 77) + '…', promptId: prompt.id });
    description = escapeHtml(description.slice(0, 77)) + '…';
  } else {
    if (!description) {
      console.log('[DIAG][PROMPT CARD] Description missing or empty, using fallback.', { promptId: prompt.id });
    }
    description = escapeHtml(description);
  }

  if (!prompt.author) {
    console.log('[DIAG][PROMPT CARD] Author missing, using fallback "Unknown".', { promptId: prompt.id });
  }
  const author = escapeHtml(prompt.author || 'Unknown');

  // Create the prompt block element
  const block = document.createElement('div');
  // Set class based on view mode
  block.className = `prompt-block hoverable ${viewMode === 'list' ? 'prompt-block-list' : 'prompt-block-grid'}`;
  block.setAttribute('data-testid', 'prompt-block');
  block.setAttribute('data-id', escapeHtml(prompt.id));
  block.setAttribute('tabindex', '0');
  block.setAttribute('aria-label', `Prompt: ${title}`);
  block.setAttribute('role', 'region');
  debugLog('[DIAG] renderPromptBlock: block className', block.className, 'viewMode', viewMode);

  // Header
  const header = document.createElement('div');
  header.className = 'prompt-header';
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';
  header.style.gap = '0.5em';

  // Title
  const h3 = document.createElement('h3');
  h3.className = 'prompt-title';
  h3.setAttribute('data-testid', 'prompt-title');
  h3.setAttribute('data-id', escapeHtml(prompt.id));
  h3.setAttribute('title', title);
  h3.textContent = title;

  // Actions
  const actions = document.createElement('div');
  actions.className = 'prompt-actions';
  actions.style.display = 'flex';
  actions.style.gap = '0.5em';

  // Edit button
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'edit-btn';
  editBtn.setAttribute('data-testid', `edit-prompt-btn-${escapeHtml(prompt.id)}`);
  editBtn.setAttribute('aria-label', `Edit prompt: ${title}`);
  editBtn.setAttribute('tabindex', '0');
  editBtn.innerText = '✏️';

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'delete-btn';
  deleteBtn.setAttribute('data-testid', `delete-prompt-btn-${escapeHtml(prompt.id)}`);
  deleteBtn.setAttribute('aria-label', `Delete prompt: ${title}`);
  deleteBtn.setAttribute('tabindex', '0');
  deleteBtn.innerText = '🗑️';
  // DELETE: Real handler with debug log and confirmation
  // No direct event handlers attached for virtualization/event delegation compatibility

  // COPY: No direct event handler for virtualization/event delegation compatibility
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'copy-btn';
  copyBtn.setAttribute('data-testid', `copy-prompt-btn-${escapeHtml(prompt.id)}`);
  copyBtn.setAttribute('aria-label', `Copy prompt: ${title}`);
  copyBtn.setAttribute('tabindex', '0');
  copyBtn.innerText = '📋';

  // Full View button (no direct event handler for virtualization/event delegation compatibility)
  const fullViewBtn = document.createElement('button');
  fullViewBtn.type = 'button';
  fullViewBtn.className = 'fullview-btn';
  fullViewBtn.setAttribute('data-testid', `fullview-prompt-btn-${escapeHtml(prompt.id)}`);
  fullViewBtn.setAttribute('aria-label', `Expand full view for prompt: ${title}`);
  fullViewBtn.setAttribute('tabindex', '0');
  fullViewBtn.innerText = '⛶';

  actions.append(editBtn, deleteBtn, copyBtn, fullViewBtn);
  header.append(h3, actions);

  // Content preview
  const contentDiv = document.createElement('div');
  contentDiv.className = 'prompt-content-preview';
  contentDiv.setAttribute('data-testid', 'prompt-content-preview');
  contentDiv.style.marginBottom = '0.5em';
  // Removed all line clamp, overflow, and display styles for accessibility and wrapping
  contentDiv.innerHTML = contentPreview;

  // Description
  const descP = document.createElement('p');
  descP.className = 'prompt-description';
  descP.setAttribute('data-testid', 'prompt-description');
  descP.style.marginBottom = '0.7em';
  // Removed all line clamp, overflow, and display styles for accessibility and wrapping
  descP.innerHTML = description;

  // Meta info
  const metaDiv = document.createElement('div');
  metaDiv.className = 'prompt-meta';
  metaDiv.style.display = 'flex';
  metaDiv.style.flexWrap = 'wrap';
  metaDiv.style.gap = '0.7em';
  metaDiv.style.fontSize = '0.98em';
  metaDiv.style.color = 'var(--color-text-muted)';
  metaDiv.style.marginBottom = '0.5em';
  metaDiv.innerHTML = `
    <span>ID: <code>${escapeHtml(prompt.id)}</code></span>
    ${created ? `<span>Created: ${created}</span>` : ''}
    <span>By: ${author}</span>
  `;

  // Tags and category
  const tagsDiv = document.createElement('div');
  tagsDiv.className = 'prompt-tags-cats';
  tagsDiv.style.display = 'flex';
  tagsDiv.style.flexWrap = 'wrap';
  tagsDiv.style.gap = '0.5em';
  tagsDiv.style.marginBottom = '0.2em';

  // Category pill
  const catPill = document.createElement('span');
  catPill.className = 'tag-pill category-pill';
  catPill.setAttribute('data-testid', `category-pill-${escapeHtml(prompt.id)}`);
  catPill.setAttribute('aria-label', `Category: ${escapeHtml(categoryName)}`);
  // Add robust data-category-id for event delegation and filtering
  if (categoryId) {
    catPill.setAttribute('data-category-id', categoryId);
  } else if (prompt.category) {
    catPill.setAttribute('data-category-id', prompt.category);
  } else {
    catPill.setAttribute('data-category-id', '');
  }
  if (categoryName === 'Deleted Category') {
    catPill.setAttribute('title', 'This prompt references a category that no longer exists. The category was deleted.');
    catPill.style.background = '#f8d7da';
    catPill.style.color = '#721c24';
    catPill.style.border = '1px solid #f5c6cb';
    catPill.style.position = 'relative';
    // Add info icon
    const infoIcon = document.createElement('span');
    infoIcon.textContent = ' ℹ️';
    infoIcon.style.cursor = 'pointer';
    infoIcon.title = 'This category was deleted. The prompt is still shown for reference.';
    catPill.appendChild(infoIcon);
  } else {
    catPill.setAttribute('title', `Category: ${escapeHtml(categoryName)}`);
  }
  catPill.textContent = categoryName;
  if (categoryName === 'Deleted Category') {
    // Add info icon after text
    const infoIcon = document.createElement('span');
    infoIcon.textContent = ' ℹ️';
    infoIcon.style.cursor = 'pointer';
    infoIcon.title = 'This category was deleted. The prompt is still shown for reference.';
    catPill.appendChild(infoIcon);
  }
  tagsDiv.appendChild(catPill);

  // Tag pills
  if (tagObjs.length === 0) {
    const noTags = document.createElement('span');
    noTags.className = 'tag-pill';
    noTags.style.fontStyle = 'italic';
    noTags.style.color = '#aaa';
    noTags.textContent = 'No tags';
    tagsDiv.appendChild(noTags);
  } else {
    tagObjs.forEach(tag => {
      // If this is a deleted tag, show special styling and tooltip
      if (tag._deleted) {
        const tagPill = document.createElement('span');
        tagPill.className = 'tag-pill';
        tagPill.setAttribute('data-testid', `tag-pill-${escapeHtml(prompt.id)}-${escapeHtml(tag.id)}-deleted`);
        tagPill.setAttribute('aria-label', 'Deleted Tag');
        tagPill.setAttribute('title', 'This prompt references a tag that no longer exists. The tag was deleted.');
        tagPill.textContent = 'Deleted Tag';
        tagPill.style.background = '#f8d7da';
        tagPill.style.color = '#721c24';
        tagPill.style.border = '1px solid #f5c6cb';
        tagPill.style.position = 'relative';
        // Add info icon
        const infoIcon = document.createElement('span');
        infoIcon.textContent = ' ℹ️';
        infoIcon.style.cursor = 'pointer';
        infoIcon.title = 'This tag was deleted. The prompt is still shown for reference.';
        tagPill.appendChild(infoIcon);
        tagsDiv.appendChild(tagPill);
        debugLog('TAG DISPLAY (deleted)', { tagName: 'Deleted Tag' });
      } else {
        // Support comma-separated tags as fallback
        let tagNames = typeof tag.name === 'string' ? tag.name.split(',').map(t => t.trim()).filter(Boolean) : [tag.name];
        tagNames.forEach(name => {
          const tagPill = document.createElement('span');
          tagPill.className = 'tag-pill';
          tagPill.setAttribute('data-testid', `tag-pill-${escapeHtml(prompt.id)}-${escapeHtml(tag.id)}-${escapeHtml(name)}`);
          tagPill.setAttribute('aria-label', `Tag: ${escapeHtml(name)}`);
          tagPill.setAttribute('title', `Tag: ${escapeHtml(name)}`);
          tagPill.textContent = name;
          tagPill.style.cursor = 'pointer';
          // Accessibility: make tag pill keyboard focusable and act as a button
          tagPill.setAttribute('tabindex', '0');
          tagPill.setAttribute('role', 'button');
          // DIAG: Add tag ID as data attribute for debugging
          tagPill.setAttribute('data-tag-id', tag.id);
          // No direct event handler for tag pill (handled via event delegation)
          tagsDiv.appendChild(tagPill);
          // DEBUG: Log tag pill details before display
          console.log('[DIAG][TagPill] Rendered tag pill', {
            tagName: name,
            tagId: tag.id,
            promptId: prompt.id,
            tagPillText: tagPill.textContent,
            attributes: Array.from(tagPill.attributes).map(a => ({ name: a.name, value: a.value }))
          });
          debugLog('TAG DISPLAY', { tagName: name });
        });
      }
    });
  }

  // Assemble block
  block.append(header, contentDiv, descP, metaDiv, tagsDiv);

  // --- INLINE RESULTS & COMMENTS UI/UX ---
  // Container for ARIA live feedback
  const liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('role', 'status');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-9999px';
  block.appendChild(liveRegion);

  // Results/comments containers
  const resultsSection = document.createElement('div');
  resultsSection.className = 'prompt-results-section';
  resultsSection.style.margin = '0.5em 0';
  resultsSection.style.padding = '0.5em 0';
  resultsSection.style.borderTop = '1px solid #2a1a40';
  resultsSection.style.borderBottom = '1px solid #2a1a40';
  resultsSection.style.maxHeight = '220px';
  resultsSection.style.overflowY = 'auto';
  resultsSection.style.background = '#1C1433';

  const commentsSection = document.createElement('div');
  commentsSection.className = 'prompt-comments-section';
  commentsSection.style.margin = '0.5em 0';
  commentsSection.style.padding = '0.5em 0';
  commentsSection.style.borderTop = '1px solid #2a1a40';
  commentsSection.style.borderBottom = '1px solid #2a1a40';
  commentsSection.style.maxHeight = '180px';
  commentsSection.style.overflowY = 'auto';
  commentsSection.style.background = '#1C1433';

  // Add forms
  const addResultForm = document.createElement('form');
  addResultForm.className = 'add-result-form';
  addResultForm.style.display = 'flex';
  addResultForm.style.gap = '8px';
  addResultForm.style.marginTop = '8px';
  addResultForm.innerHTML = `
    <textarea name="value" placeholder="Add a result (no length limit)..." required
      style="flex:1;min-height:60px;max-height:120px;padding:8px;background:#261A40;border-radius:8px;color:#F3EFFF;border:none;font-size:15px;resize:vertical;"></textarea>
    <button type="submit"
      style="background:linear-gradient(90deg,#7B3FE4 60%,#4F9CFF 100%);color:#fff;padding:8px 16px;border-radius:9999px;font-weight:500;font-size:15px;">Add Result</button>
  `;

  const addCommentForm = document.createElement('form');
  addCommentForm.className = 'add-comment-form';
  addCommentForm.style.display = 'flex';
  addCommentForm.style.gap = '8px';
  addCommentForm.style.marginTop = '8px';
  addCommentForm.innerHTML = `
    <input name="author" type="text" maxlength="100" placeholder="Your name (optional)" style="width:120px;padding:8px;border-radius:8px;border:none;background:#261A40;color:#F3EFFF;font-size:14px;">
    <input name="text" type="text" maxlength="5000" placeholder="Add a comment (max 5000 chars)..." required
      style="flex:1;height:38px;padding:8px;background:#261A40;border-radius:8px;color:#F3EFFF;border:none;font-size:15px;">
    <button type="submit"
      style="background:linear-gradient(90deg,#7B3FE4 60%,#4F9CFF 100%);color:#fff;padding:8px 16px;border-radius:9999px;font-weight:500;font-size:15px;">Add Comment</button>
  `;

  // State
  let results = [];
  let comments = [];

  // Renderers
  function renderResults() {
    resultsSection.innerHTML = `<div style="font-weight:600;font-size:0.98em;margin-bottom:0.3em;">Results:</div>`;
    if (results.length === 0) {
      resultsSection.innerHTML += `<div style="color:#aaa;font-size:0.95em;">No results yet.</div>`;
    } else {
      results.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = 'prompt-result-row';
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '0.5em';
        row.style.marginBottom = '0.2em';

        const content = document.createElement('span');
        content.className = 'result-content';
        content.innerHTML = escapeHtml(r.content || '');
        content.style.flex = '1';
        content.style.fontSize = '0.97em';
        content.style.color = '#E0D0FF';
        content.style.whiteSpace = 'pre-wrap';
        content.style.wordBreak = 'break-word';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'delete-result-btn';
        delBtn.setAttribute('aria-label', `Delete result ${idx + 1}`);
        delBtn.setAttribute('tabindex', '0');
        delBtn.innerText = '🗑️';
        delBtn.onclick = async () => {
          delBtn.disabled = true;
          try {
            await deleteResult(r.id);
            results = results.filter(res => res.id !== r.id);
            renderResults();
            liveRegion.textContent = 'Result deleted.';
          } catch (err) {
            liveRegion.textContent = 'Failed to delete result.';
          }
          delBtn.disabled = false;
        };

        row.append(content, delBtn);
        resultsSection.appendChild(row);
      });
    }
    resultsSection.appendChild(addResultForm);
  }

  function renderComments() {
    commentsSection.innerHTML = `<div style="font-weight:600;font-size:0.98em;margin-bottom:0.3em;">Comments:</div>`;
    if (comments.length === 0) {
      commentsSection.innerHTML += `<div style="color:#aaa;font-size:0.95em;">No comments yet.</div>`;
    } else {
      comments.forEach((c, idx) => {
        const row = document.createElement('div');
        row.className = 'prompt-comment-row';
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '0.5em';
        row.style.marginBottom = '0.2em';

        const author = document.createElement('span');
        author.style.fontWeight = '600';
        author.style.color = '#BFAEF5';
        author.style.fontSize = '13px';
        author.textContent = c.author ? escapeHtml(c.author) + ': ' : '';

        const content = document.createElement('span');
        content.innerHTML = escapeHtml(c.content || '');
        content.style.flex = '1';
        content.style.fontSize = '0.97em';
        content.style.color = '#E0D0FF';
        content.style.whiteSpace = 'pre-wrap';
        content.style.wordBreak = 'break-word';
        content.style.maxHeight = '80px';
        content.style.overflowY = 'auto';

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'delete-comment-btn';
        delBtn.setAttribute('aria-label', `Delete comment ${idx + 1}`);
        delBtn.setAttribute('tabindex', '0');
        delBtn.innerText = '🗑️';
        delBtn.onclick = async () => {
          delBtn.disabled = true;
          try {
            await deleteComment(c.id);
            comments = comments.filter(com => com.id !== c.id);
            renderComments();
            liveRegion.textContent = 'Comment deleted.';
          } catch (err) {
            liveRegion.textContent = 'Failed to delete comment.';
          }
          delBtn.disabled = false;
        };

        row.append(author, content, delBtn);
        commentsSection.appendChild(row);
      });
    }
    commentsSection.appendChild(addCommentForm);
  }

  // Add result handler
  addResultForm.onsubmit = async (e) => {
    e.preventDefault();
    const content = addResultForm.value.value.trim();
    if (!content) {
      liveRegion.textContent = 'Result cannot be empty.';
      return;
    }
    addResultForm.querySelector('button[type="submit"]').disabled = true;
    try {
      const res = await addResult(prompt.id, { content });
      if (res && res.result) {
        results.push(res.result);
        renderResults();
        liveRegion.textContent = 'Result added.';
        addResultForm.value.value = '';
        if (typeof window.renderPrompts === 'function') {
          window.renderPrompts();
        }
      } else {
        liveRegion.textContent = 'Failed to add result.';
      }
    } catch (err) {
      liveRegion.textContent = 'Failed to add result.';
    }
    addResultForm.querySelector('button[type="submit"]').disabled = false;
  };

  // Add comment handler
  addCommentForm.onsubmit = async (e) => {
    e.preventDefault();
    const content = addCommentForm.text.value.trim();
    const author = addCommentForm.author.value.trim();
    if (!content) {
      liveRegion.textContent = 'Comment cannot be empty.';
      return;
    }
    if (content.length > 5000) {
      liveRegion.textContent = 'Comment too long (max 5000 characters).';
      return;
    }
    if (author.length > 100) {
      liveRegion.textContent = 'Author name too long (max 100 characters).';
      return;
    }
    addCommentForm.querySelector('button[type="submit"]').disabled = true;
    try {
      const res = await addComment(prompt.id, { content, author });
      if (res && res.comment) {
        comments.push(res.comment);
        renderComments();
        liveRegion.textContent = 'Comment added.';
        addCommentForm.text.value = '';
        addCommentForm.author.value = '';
      } else {
        liveRegion.textContent = 'Failed to add comment.';
      }
    } catch (err) {
      liveRegion.textContent = 'Failed to add comment.';
    }
    addCommentForm.querySelector('button[type="submit"]').disabled = false;
  };

  // Initial fetch and render
  // --- RACE CONDITION SAFETY: Assign a unique request token to the block for async fetches ---
  if (!window.__promptBlockRequestId) window.__promptBlockRequestId = 1;
  const requestId = ++window.__promptBlockRequestId;
  block.__promptBlockRequestId = requestId;

  (async () => {
    let localResults = [];
    let localComments = [];
    try {
      const resResults = await fetchResults(prompt.id);
      localResults = Array.isArray(resResults.results) ? resResults.results : [];
    } catch {
      localResults = [];
    }
    try {
      const resComments = await fetchComments(prompt.id);
      localComments = Array.isArray(resComments.comments) ? resComments.comments : [];
    } catch {
      localComments = [];
    }
    // Only update UI if this is still the latest request for this block
    if (block.__promptBlockRequestId !== requestId) {
      debugLog('[renderPromptBlock] Stale fetch, skipping UI update for promptId:', prompt.id);
      return;
    }
    results = localResults;
    comments = localComments;
    renderResults();
    renderComments();
  })();

  // Add divider between results and comments for visual separation
  const divider = document.createElement('div');
  divider.className = 'results-comments-divider';
  divider.setAttribute('aria-hidden', 'true');
  block.append(resultsSection, divider, commentsSection);
  debugLog('[DIAG] Comments/Results UI appended', {
    promptId: prompt.id,
    resultsSectionExists: !!resultsSection,
    commentsSectionExists: !!commentsSection,
    blockHtml: block.outerHTML
  });

  // DEBUG: Log if action buttons exist and if listeners are attached
  debugLog('ACTION BUTTONS', {
    editBtnExists: !!editBtn,
    deleteBtnExists: !!deleteBtn,
    copyBtnExists: !!copyBtn,
    context: options.isModal ? 'modal' : 'card'
  });

  // Accessibility: keyboard focus/activation
  // No direct event handlers for block activation (handled via event delegation)

  // DEBUG: Log final block structure for inspection
  debugLog('END', { block, html: block.outerHTML });
  return block;
}