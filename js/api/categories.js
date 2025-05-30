/**
 * categories.js - Simple API client for categories
 * (2025 Rebuild, "stupid simple" pattern)
 */

export async function fetchCategories() {
  try {
    console.log("[fetchCategories] called");
    const url = '/api/categories.php';
    console.log("[fetchCategories] Fetching URL:", url);
    const res = await fetch(url);
    console.log("[fetchCategories] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchCategories] Error response:", text);
      throw new Error('Failed to fetch categories');
    }
    const data = await res.json();
    console.log("[fetchCategories] Data received:", data);
    return data.categories || [];
  } catch (err) {
    console.error("[fetchCategories] Exception:", err);
    throw err;
  }
}