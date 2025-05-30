/**
 * ui/commentsResults.js - Comments and Results UI (2025 Rebuild, "stupid simple")
 * [AUDITFIX] Refactored for debug logging, modularity, accessibility, and maintainability.
 */

import { fetchComments, addComment, deleteComment } from '../api/comments.js';
import { fetchResults, addResult, deleteResult } from '../api/results.js';
import { escapeHtml, debugLog, validateContentLength, validateAuthor } from '../util/helpers.js';
import { showToast } from '../ui/toast.js';
import { showConfirmModal } from './modals.js';

/**
 * Helper to optimistically remove a list item and restore on error.
 */
function handleListItemOptimisticRemove(li, action, restoreCallback) {
  if (li) {
    li.style.opacity = '0.5';
    li.style.pointerEvents = 'none';
  }
  return action()
    .catch((err) => {
      debugLog("[DEBUG] Optimistic remove failed, restoring item.", err);
      if (li) {
        li.style.opacity = '';
        li.style.pointerEvents = '';
      }
      if (restoreCallback) restoreCallback();
      throw err;
    });
}

/**
 * Accessibility: Focus trap for modal.
 */
function trapFocus(modal) {
  if (!modal) return;
  const focusableSelectors = [
    'a[href]', 'button:not([disabled])', 'textarea:not([disabled])',
    'input[type="text"]:not([disabled])', 'input[type="submit"]:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];
  const focusableEls = modal.querySelectorAll(focusableSelectors.join(','));
  if (focusableEls.length === 0) return;
  const firstEl = focusableEls[0];
  const lastEl = focusableEls[focusableEls.length - 1];

  modal.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
    if (e.key === 'Escape') {
      modal.style.display = 'none';
      modal.classList.remove('active');
      modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      debugLog("[DEBUG] Result modal closed via Escape");
    }
  });
}

export async function renderCommentsResults(promptId, container) {
  debugLog("[DEBUG] renderCommentsResults called with promptId:", promptId, "container:", container);

  // --- RACE CONDITION SAFETY: Assign a unique request token to the container ---
  if (!container) {
    debugLog("[DEBUG] renderCommentsResults: container is null/undefined");
    return;
  }
  if (!window.__commentsResultsRequestId) window.__commentsResultsRequestId = 1;
  const requestId = ++window.__commentsResultsRequestId;
  container.__commentsResultsRequestId = requestId;

  // Add ARIA-live region for dynamic updates
  container.innerHTML = `
    <div id="comments-results-live" aria-live="polite" style="position:absolute;left:-9999px;top:auto;width:1px;height:1px;overflow:hidden;"></div>
    <div>Loading comments and results...</div>
  `;

  try {
    debugLog("[DEBUG] Fetching comments and results for promptId:", promptId, "at", new Date().toISOString());
    const [{ comments = [] }, { results = [] }] = await Promise.all([
      fetchComments(promptId),
      fetchResults(promptId)
    ]);
    // --- Only update UI if this is still the latest request for this container ---
    if (container.__commentsResultsRequestId !== requestId) {
      debugLog("[DEBUG] Stale commentsResults fetch, skipping UI update for promptId:", promptId);
      return;
    }
    debugLog("[DEBUG] Comments fetched:", comments, "promptId:", promptId, "at", new Date().toISOString());
    debugLog("[DEBUG] Results fetched:", results, "promptId:", promptId, "at", new Date().toISOString());

    // Extra: log all comment/result IDs for cross-pollution detection
    debugLog("[DIAG] All comment IDs:", comments.map(c => c.id), "All result IDs:", results.map(r => r.id), "promptId:", promptId);

    // Render comments
    const commentsHtml = `
      <section style="margin-bottom:24px;">
        <h4 style="font-size:16px;font-weight:600;color:#E0D0FF;margin-bottom:8px;">Comments</h4>
        <ul id="comments-list" style="display:flex;flex-direction:column;gap:12px;padding:0;margin:0;">
          ${(comments || []).map(c => `
            <li style="display:flex;align-items:flex-start;gap:12px;background:#261A40;border-radius:10px;padding:12px 12px 12px 16px;margin-bottom:0;">
              <div style="flex:1;">
                <div style="color:#BFAEF5;font-size:13px;font-weight:600;margin-bottom:2px;">
                  User: ${c.author ? escapeHtml(c.author) : "Guest"}
                </div>
                <div style="font-size:15px;color:#F3EFFF;word-break:break-word;white-space:pre-line;">${escapeHtml(c.content || "")}</div>
              </div>
              <button class="delete-comment-btn" data-id="${c.id}" aria-label="Delete comment"
                style="margin-left:auto;background:#F44336;color:#fff;padding:4px 10px;border-radius:9999px;font-size:13px;font-weight:500;box-shadow:0 1px 4px #0002;">Delete</button>
            </li>
          `).join('')}
        </ul>
        <form id="add-comment-form" style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <input name="author" type="text" maxlength="100" placeholder="Your name" required
            aria-label="Comment author"
            style="width:160px;min-width:120px;max-width:200px;height:44px;padding:10px 12px;background:#1C1433;border-radius:8px;color:#F3EFFF;border:none;font-size:15px;"/>
          <input name="text" type="text" maxlength="5000" placeholder="Add a comment..." required
            aria-label="Comment content"
            style="flex:1;height:44px;padding:10px 12px;background:#1C1433;border-radius:8px;color:#F3EFFF;border:none;font-size:15px;"/>
          <button type="submit"
            style="background:linear-gradient(90deg,#7B3FE4 60%,#4F9CFF 100%);color:#fff;padding:8px 16px;border-radius:9999px;font-weight:500;font-size:15px;">Add</button>
          <div id="add-comment-feedback" aria-live="polite" style="width:100%;min-height:20px;color:#ffb3b3;font-size:0.98em;margin-top:2px;"></div>
        </form>
      </section>
    `;

    // Render results
    const resultsHtml = `
      <section>
        <h4 style="font-size:16px;font-weight:600;color:#E0D0FF;margin-bottom:8px;">Results</h4>
        <ul id="results-list" style="display:flex;flex-direction:column;gap:12px;padding:0;margin:0;">
          ${(results || []).map(r => `
            <li style="display:flex;align-items:flex-start;gap:12px;background:#261A40;border-radius:10px;padding:12px 12px 12px 16px;margin-bottom:0;">
              <div style="flex:1;max-width:100%;">
                <div style="color:#BFAEF5;font-size:13px;font-weight:600;margin-bottom:2px;">
                  User: ${r.author ? escapeHtml(r.author) : "Guest"}
                </div>
                <div style="font-size:15px;color:#F3EFFF;word-break:break-word;white-space:pre-line;max-height:220px;overflow:auto;padding:4px 0 2px 0;background:#1C1433;border-radius:6px;">
                  ${escapeHtml(r.content || "")}
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                <button class="view-result-btn" data-content="${escapeHtml(r.content || '')}" aria-label="View result"
                  style="background:linear-gradient(90deg,#7B3FE4 60%,#4F9CFF 100%);color:#fff;padding:4px 10px;border-radius:9999px;font-size:13px;font-weight:500;box-shadow:0 1px 4px #0002;margin-bottom:4px;">View</button>
                <button class="delete-result-btn" data-id="${r.id}" aria-label="Delete result"
                  style="background:#F44336;color:#fff;padding:4px 10px;border-radius:9999px;font-size:13px;font-weight:500;box-shadow:0 1px 4px #0002;">Delete</button>
              </div>
            </li>
          `).join('')}
        </ul>
        <form id="add-result-form" style="margin-top:8px;display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;">
          <input name="author" type="text" maxlength="100" placeholder="Your name" required
            aria-label="Result author"
            style="width:160px;min-width:120px;max-width:200px;height:44px;padding:10px 12px;background:#1C1433;border-radius:8px;color:#F3EFFF;border:none;font-size:15px;"/>
          <textarea name="value" placeholder="Add a result (long text supported)..." required
            aria-label="Result content"
            style="flex:1;min-height:80px;max-height:220px;padding:12px;background:#1C1433;border-radius:10px;color:#F3EFFF;border:none;font-size:15px;resize:vertical;"></textarea>
          <button type="submit"
            style="background:linear-gradient(90deg,#7B3FE4 60%,#4F9CFF 100%);color:#fff;padding:8px 16px;border-radius:9999px;font-weight:500;font-size:15px;">Add</button>
          <div id="add-result-feedback" aria-live="polite" style="width:100%;min-height:20px;color:#ffb3b3;font-size:0.98em;margin-top:2px;"></div>
        </form>
      </section>
    `;

    container.innerHTML = commentsHtml + resultsHtml;
    debugLog("[DEBUG] Comments and results rendered in DOM. Comments count:", comments.length, "Results count:", results.length, "promptId:", promptId, "at", new Date().toISOString());
    debugLog("[DIAG] renderCommentsResults END for promptId:", promptId, "comments:", comments, "results:", results, "container:", container);
    // Add comment
    const addCommentForm = container.querySelector('#add-comment-form');
    if (addCommentForm) {
      const feedback = addCommentForm.querySelector('#add-comment-feedback');
      addCommentForm.onsubmit = async (e) => {
        e.preventDefault();
        const author = addCommentForm.author.value.trim();
        const content = addCommentForm.text.value.trim();
        const MAX_COMMENT_LENGTH = 5000;
        const MAX_AUTHOR_LENGTH = 100;
        let error = validateAuthor(author, MAX_AUTHOR_LENGTH) || validateContentLength(content, MAX_COMMENT_LENGTH);
        if (error) {
          if (feedback) {
            feedback.textContent = error;
          }
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = error;
          debugLog("[DEBUG] Add comment: validation error", error);
          addCommentForm.author.focus();
          return;
        }
        debugLog("[DEBUG] Add comment: submitting", { promptId, author, content });
        try {
          const result = await addComment(promptId, { author, content });
          debugLog("[DEBUG] Add comment: API result", result);
          if (feedback) feedback.textContent = '';
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = 'Comment added successfully';
          await renderCommentsResults(promptId, container);
          // Focus comment content input after re-render
          setTimeout(() => {
            const newForm = container.querySelector('#add-comment-form');
            if (newForm && newForm.text) newForm.text.focus();
          }, 0);
        } catch (err) {
          if (feedback) feedback.textContent = 'Failed to add comment';
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = 'Failed to add comment';
          showToast && showToast('Failed to add comment', 'danger');
          debugLog("[DEBUG] Add comment: error", err);
        }
      };
      debugLog("[DEBUG] Add comment form handler attached");
    }

    // Delete comment
    container.querySelectorAll('.delete-comment-btn').forEach(btn => {
      btn.onclick = async () => {
        const commentId = btn.getAttribute('data-id');
        debugLog("[DEBUG] Delete comment button clicked for commentId:", commentId);
        if (await showConfirmModal('Delete this comment?')) {
          const li = btn.closest('li');
          await handleListItemOptimisticRemove(
            li,
            async () => {
              const result = await deleteComment(commentId);
              debugLog("[DEBUG] Delete comment: API result", result);
              if (li) {
                debugLog("[DEBUG] About to remove comment li from DOM. li.id:", li.id, "li.textContent:", li.textContent);
              }
              if (li && li.parentNode) {
                li.parentNode.removeChild(li);
                const stillExists = !!document.querySelector(`.delete-comment-btn[data-id="${commentId}"]`);
                debugLog("[DEBUG] Comment li removed from DOM. Still exists in DOM?", stillExists);
              }
              const live = container.querySelector('#comments-results-live');
              if (live) live.textContent = 'Comment deleted';
              await renderCommentsResults(promptId, container);
              // Focus comment content input after re-render
              setTimeout(() => {
                const newForm = container.querySelector('#add-comment-form');
                if (newForm && newForm.text) newForm.text.focus();
              }, 0);
            },
            () => {
              showToast && showToast('Failed to delete comment', 'danger');
              const live = container.querySelector('#comments-results-live');
              if (live) live.textContent = 'Failed to delete comment';
            }
          );
        }
      };
      debugLog("[DEBUG] Delete comment handler attached for commentId:", btn.getAttribute('data-id'));
    });

    // Add result
    const addResultForm = container.querySelector('#add-result-form');
    if (addResultForm) {
      const feedback = addResultForm.querySelector('#add-result-feedback');
      addResultForm.onsubmit = async (e) => {
        e.preventDefault();
        const author = addResultForm.author.value.trim();
        const content = addResultForm.value.value.trim();
        const MAX_AUTHOR_LENGTH = 100;
        let error = validateAuthor(author, MAX_AUTHOR_LENGTH);
        if (!content) {
          error = 'Result content cannot be empty';
        }
        if (error) {
          if (feedback) {
            feedback.textContent = error;
          }
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = error;
          debugLog("[DEBUG] Add result: validation error", error);
          addResultForm.author.focus();
          return;
        }
        debugLog("[DEBUG] Add result: submitting", { promptId, author, content });
        try {
          const result = await addResult(promptId, { author, content });
          debugLog("[DEBUG] Add result: API result", result);
          if (feedback) feedback.textContent = '';
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = 'Result added successfully';
          await renderCommentsResults(promptId, container);
          // Focus result content textarea after re-render
          setTimeout(() => {
            const newForm = container.querySelector('#add-result-form');
            if (newForm && newForm.value) newForm.value.focus();
          }, 0);
        } catch (err) {
          if (feedback) feedback.textContent = 'Failed to add result';
          const live = container.querySelector('#comments-results-live');
          if (live) live.textContent = 'Failed to add result';
          showToast && showToast('Failed to add result', 'danger');
          debugLog("[DEBUG] Add result: error", err);
        }
      };
      debugLog("[DEBUG] Add result form handler attached");
    }

    // Delete result
    container.querySelectorAll('.delete-result-btn').forEach(btn => {
      btn.onclick = async () => {
        const resultId = btn.getAttribute('data-id');
        debugLog("[DEBUG] Delete result button clicked for resultId:", resultId);
        if (await showConfirmModal('Delete this result?')) {
          const li = btn.closest('li');
          await handleListItemOptimisticRemove(
            li,
            async () => {
              const result = await deleteResult(resultId);
              debugLog("[DEBUG] Delete result: API result", result);
              if (li) {
                debugLog("[DEBUG] About to remove result li from DOM. li.id:", li.id, "li.textContent:", li.textContent);
              }
              if (li && li.parentNode) {
                li.parentNode.removeChild(li);
                const stillExists = !!document.querySelector(`.delete-result-btn[data-id="${resultId}"]`);
                debugLog("[DEBUG] Result li removed from DOM. Still exists in DOM?", stillExists);
              }
              const live = container.querySelector('#comments-results-live');
              if (live) live.textContent = 'Result deleted';
              await renderCommentsResults(promptId, container);
              // Focus result content textarea after re-render
              setTimeout(() => {
                const newForm = container.querySelector('#add-result-form');
                if (newForm && newForm.value) newForm.value.focus();
              }, 0);
            },
            () => {
              showToast && showToast('Failed to delete result', 'danger');
              const live = container.querySelector('#comments-results-live');
              if (live) live.textContent = 'Failed to delete result';
            }
          );
        }
      };
      debugLog("[DEBUG] Delete result handler attached for resultId:", btn.getAttribute('data-id'));
    });

    // View result modal logic
    container.querySelectorAll('.view-result-btn').forEach(btn => {
      btn.onclick = () => {
        const content = btn.getAttribute('data-content') || '';
        const modal = document.getElementById('result-modal');
        const modalContent = document.getElementById('result-modal-content');
        debugLog("[DEBUG] View result button clicked. Content:", content);
        if (modal && modalContent) {
          // Always escape user content before rendering in modal for safety, even if already escaped in data attribute.
          modalContent.innerHTML = `<pre style="white-space:pre-wrap;word-break:break-word;font-size:15px;color:#F3EFFF;background:#1C1433;border-radius:8px;padding:16px;max-height:60vh;overflow:auto;">${escapeHtml(content)}</pre>`;
          modal.style.display = 'flex';
          modal.classList.add('active');
          modal.setAttribute('aria-hidden', 'false');
          document.body.classList.add('modal-open');
          // Accessibility: focus trap
          trapFocus(modal);
          // Focus the close button if available
          const closeBtn = document.getElementById('close-result-modal-btn');
          if (closeBtn) {
            closeBtn.focus();
            closeBtn.onclick = () => {
              modal.style.display = 'none';
              modal.classList.remove('active');
              modal.setAttribute('aria-hidden', 'true');
              document.body.classList.remove('modal-open');
              debugLog("[DEBUG] Result modal closed");
            };
          }
        }
      };
      debugLog("[DEBUG] View result handler attached");
    });

  } catch (err) {
    container.innerHTML = '<div style="color:red;">Error loading comments or results.</div>';
    if (typeof showToast === "function") showToast('Error loading comments or results', 'danger');
    debugLog('[DEBUG] CommentsResults: Failed to load', err);
  }
}