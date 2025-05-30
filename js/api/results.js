/**
 * results.js - Simple API client for results
 * (2025 Rebuild, "stupid simple" pattern)
 */

export async function fetchResults(promptId) {
  try {
    console.log("[fetchResults] called with promptId:", promptId);
    // FIX: Use prompt_id to match backend API
    const url = '/api/results.php?prompt_id=' + encodeURIComponent(promptId);
    console.log("[fetchResults] Fetching URL:", url);
    const res = await fetch(url);
    console.log("[fetchResults] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchResults] Error response:", text);
      throw new Error('Failed to fetch results');
    }
    const data = await res.json();
    console.log("[fetchResults] Data received:", data);
    return data;
  } catch (err) {
    console.error("[fetchResults] Exception:", err);
    throw err;
  }
}

export async function addResult(promptId, data) {
  try {
    console.log("[addResult] called with promptId:", promptId, "data:", data);
    const payload = { action: 'add', prompt_id: promptId, ...data };
    console.log("[addResult] Sending payload:", payload);
    const res = await fetch('/api/results.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[addResult] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[addResult] Error response:", text);
      throw new Error('Failed to add result');
    }
    const result = await res.json();
    console.log("[addResult] Data received:", result);
    return result;
  } catch (err) {
    console.error("[addResult] Exception:", err);
    throw err;
  }
}

export async function deleteResult(resultId) {
  try {
    console.log("[deleteResult] called with resultId:", resultId);
    const url = `/api/results.php?id=${encodeURIComponent(resultId)}`;
    console.log("[deleteResult] Sending DELETE to:", url);
    const res = await fetch(url, { method: 'DELETE' });
    console.log("[deleteResult] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[deleteResult] Error response:", text);
      throw new Error('Failed to delete result');
    }
    const result = await res.json();
    console.log("[deleteResult] Data received:", result);
    return result;
  } catch (err) {
    console.error("[deleteResult] Exception:", err);
    throw err;
  }
}