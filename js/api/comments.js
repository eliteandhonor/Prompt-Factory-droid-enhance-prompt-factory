/**
 * comments.js - Simple API client for comments
 * (2025 Rebuild, "stupid simple" pattern)
 */

/**
 * Fetches all comments for a given prompt.
 * @param {string} promptId - The ID of the prompt to fetch comments for.
 * @returns {Promise<Object>} The API response containing comments.
 */
export async function fetchComments(promptId) {
  try {
    console.log("[fetchComments] called with promptId:", promptId);
    const url = '/api/comments.php?prompt_id=' + encodeURIComponent(promptId);
    console.log("[fetchComments] Fetching URL:", url);
    const res = await fetch(url);
    console.log("[fetchComments] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchComments] Error response:", text);
      throw new Error('Failed to fetch comments');
    }
    const data = await res.json();
    console.log("[fetchComments] Data received:", data);
    return data;
  } catch (err) {
    console.error("[fetchComments] Exception:", err);
    throw err;
  }
}

/**
 * Adds a comment to a prompt.
 * @param {string} promptId - The ID of the prompt to add a comment to.
 * @param {Object} data - The comment data (should include 'content' and optionally 'author').
 * @returns {Promise<Object>} The API response containing the new comment.
 */
export async function addComment(promptId, data) {
  try {
    console.log("[addComment] called with promptId:", promptId, "data:", data);
    const payload = { action: 'add', prompt_id: promptId, ...data };
    console.log("[addComment] Sending payload:", payload);
    const res = await fetch('/api/comments.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[addComment] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[addComment] Error response:", text);
      throw new Error('Failed to add comment');
    }
    const result = await res.json();
    console.log("[addComment] Data received:", result);
    return result;
  } catch (err) {
    console.error("[addComment] Exception:", err);
    throw err;
  }
}

/**
 * Deletes a comment by its ID.
 * @param {string} commentId - The ID of the comment to delete.
 * @returns {Promise<Object>} The API response after deletion.
 */
export async function deleteComment(commentId) {
  try {
    console.log("[deleteComment] called with commentId:", commentId);
    const url = `/api/comments.php?id=${encodeURIComponent(commentId)}`;
    console.log("[deleteComment] Sending DELETE to:", url);

    // Extra logging: show stack trace to confirm call origin
    console.log("[deleteComment] Stack trace:", new Error().stack);

    const res = await fetch(url, { method: 'DELETE' });
    console.log("[deleteComment] Fetch completed. Response status:", res.status);

    // Log response headers for debugging
    for (const [key, value] of res.headers.entries()) {
      console.log(`[deleteComment] Response header: ${key}: ${value}`);
    }

    if (!res.ok) {
      const text = await res.text();
      console.error("[deleteComment] Error response:", text);
      throw new Error('Failed to delete comment');
    }
    const result = await res.json();
    console.log("[deleteComment] Data received:", result);
    return result;
  } catch (err) {
    console.error("[deleteComment] Exception:", err);
    throw err;
  }
}