/**
 * tags.js - Simple API client for tags
 * (2025 Rebuild, "stupid simple" pattern)
 */

export async function fetchTags() {
  try {
    console.log("[fetchTags] called");
    const url = '/api/tags.php';
    console.log("[fetchTags] Fetching URL:", url);
    const res = await fetch(url);
    console.log("[fetchTags] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchTags] Error response:", text);
      throw new Error('Failed to fetch tags');
    }
    const data = await res.json();
    console.log("[fetchTags] Data received:", data);
    return data.tags || [];
  } catch (err) {
    console.error("[fetchTags] Exception:", err);
    throw err;
  }
}