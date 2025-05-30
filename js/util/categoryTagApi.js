// categoryTagApi.js
// Atomic audit fix: Modularize and deduplicate category/tag CRUD logic.
// Provides: addCategory, addTag, fetchCategories, fetchTags

export async function fetchCategories() {
  const res = await fetch('/api/categories.php');
  if (!res.ok) throw new Error('Failed to fetch categories');
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.categories)) throw new Error(data.error || 'Invalid categories response');
  return data.categories;
}

export async function fetchTags() {
  const res = await fetch('/api/tags.php');
  if (!res.ok) throw new Error('Failed to fetch tags');
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.tags)) throw new Error(data.error || 'Invalid tags response');
  return data.tags;
}

export async function addCategory(name) {
  const res = await fetch('/api/categories.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (!data.ok || !data.category) throw new Error(data.error || 'Failed to add category');
  return data.category;
}

export async function addTag(name) {
  const res = await fetch('/api/tags.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  const data = await res.json();
  if (!data.ok || !data.tag) throw new Error(data.error || 'Failed to add tag');
  return data.tag;
}

// Optionally, add deleteCategory, deleteTag, updateCategory, updateTag, etc. as needed.