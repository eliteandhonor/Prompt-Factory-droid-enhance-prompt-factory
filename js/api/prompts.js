// DEBUG: prompts.js loaded. typeof document.currentScript: ${typeof document !== 'undefined' && document.currentScript ? document.currentScript.type : 'N/A'}, window.ESM_DEBUG = true;
if (typeof window !== 'undefined') window.ESM_DEBUG = true;
/**
 * prompts.js - Simple API client for prompts
 * (2025 Rebuild, "stupid simple" pattern)
 */

export async function fetchPrompts(params = {}) {
  try {
    console.log("[fetchPrompts] START", { params });
    const query = new URLSearchParams(params).toString();
    const url = '/api/prompts.php' + (query ? `?${query}` : '');
    console.log("[fetchPrompts] Fetching URL:", url);
    const res = await fetch(url);
    console.log("[fetchPrompts] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchPrompts] Error response:", text);
      console.log("[fetchPrompts] END (error response)");
      throw new Error('Failed to fetch prompts');
    }
    const data = await res.json();
    console.log("[fetchPrompts] Data received:", data);
    console.log("[fetchPrompts] END (success)", { prompts: data.prompts });
    return data.prompts;
  } catch (err) {
    console.error("[fetchPrompts] Exception:", err);
    console.log("[fetchPrompts] END (exception)");
    throw err;
  }
}

export async function createPrompt(data) {
  try {
    console.log("[createPrompt] START", { data });
    const payload = { action: 'create', ...data };
    console.log("[createPrompt] Sending payload:", payload);
    const res = await fetch('/api/prompts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[createPrompt] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[createPrompt] Error response:", text);
      console.log("[createPrompt] END (error response)");
      throw new Error('Failed to create prompt');
    }
    const result = await res.json();
    console.log("[createPrompt] Data received:", result);
    // Explicit debug logging for author and description fields
    if (result && result.prompt) {
      import('../util/debugLogger.js').then(({ debugLog }) => {
        debugLog("[createPrompt] API response author:", result.prompt.author);
        debugLog("[createPrompt] API response description:", result.prompt.description);
      });
    } else {
      import('../util/debugLogger.js').then(({ debugLog }) => {
        debugLog("[createPrompt] API response missing prompt object", result);
      });
    }
    console.log("[createPrompt] END (success)", { result });
    return result;
  } catch (err) {
    console.error("[createPrompt] Exception:", err);
    console.log("[createPrompt] END (exception)");
    throw err;
  }
}

export async function updatePrompt(id, data) {
  try {
    console.log("[updatePrompt] START", { id, data });
    const payload = { action: 'update', id, ...data };
    console.log("[updatePrompt] Sending payload:", payload);
    const res = await fetch('/api/prompts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[updatePrompt] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[updatePrompt] Error response:", text);
      console.log("[updatePrompt] END (error response)");
      throw new Error('Failed to update prompt');
    }
    const result = await res.json();
    console.log("[updatePrompt] Data received:", result);
    // Explicit debug logging for author and description fields
    if (result && result.prompt) {
      import('../util/debugLogger.js').then(({ debugLog }) => {
        debugLog("[updatePrompt] API response author:", result.prompt.author);
        debugLog("[updatePrompt] API response description:", result.prompt.description);
      });
    } else {
      import('../util/debugLogger.js').then(({ debugLog }) => {
        debugLog("[updatePrompt] API response missing prompt object", result);
      });
    }
    console.log("[updatePrompt] END (success)", { result });
    return result;
  } catch (err) {
    console.error("[updatePrompt] Exception:", err);
    console.log("[updatePrompt] END (exception)");
    throw err;
  }
}

export async function deletePrompt(id) {
  try {
    console.log("[deletePrompt] START", { id });
    const payload = { action: 'delete', id };
    console.log("[deletePrompt] Sending payload:", payload);
    const res = await fetch('/api/prompts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[deletePrompt] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[deletePrompt] Error response:", text);
      console.log("[deletePrompt] END (error response)");
      throw new Error('Failed to delete prompt');
    }
    const result = await res.json();
    console.log("[deletePrompt] Data received:", result);
    console.log("[deletePrompt] END (success)", { result });
    return result;
  } catch (err) {
    console.error("[deletePrompt] Exception:", err);
    console.log("[deletePrompt] END (exception)");
    throw err;
  }
}
// Batch import prompts: accepts array of prompt objects
export async function importPrompts(prompts) {
  try {
    console.log("[importPrompts] START", { prompts });
    // DEBUG: Log content length and snippet for each prompt
    prompts.forEach((p, i) => {
      const content = p.content || '';
      console.log(`[importPrompts][DEBUG] Prompt #${i} content length: ${content.length}, first 50: "${content.slice(0,50)}", last 50: "${content.slice(-50)}"`);
    });
    const payload = { action: "import", prompts };
    const res = await fetch('/api/prompts.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log("[importPrompts] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[importPrompts] Error response:", text);
      console.log("[importPrompts] END (error response)");
      throw new Error('Failed to import prompts');
    }
    const result = await res.json();
    console.log("[importPrompts] Data received:", result);
    console.log("[importPrompts] END (success)", { result });
    return result;
  } catch (err) {
    console.error("[importPrompts] Exception:", err);
    console.log("[importPrompts] END (exception)");
    throw err;
  }
}
// Fetch a single prompt by ID (best practice for modal editing)
export async function fetchPromptById(id) {
  try {
    if (!id) throw new Error('No prompt ID provided');
    console.log("[fetchPromptById] START", { id });
    const url = `/api/prompts.php?id=${encodeURIComponent(id)}`;
    const res = await fetch(url);
    console.log("[fetchPromptById] Response status:", res.status);
    if (!res.ok) {
      const text = await res.text();
      console.error("[fetchPromptById] Error response:", text);
      const err = new Error('Failed to fetch prompt by ID');
      if (res.status === 404) {
        err.status = 404;
        err.message = 'Prompt not found';
      } else {
        err.status = res.status;
      }
      throw err;
    }
    const data = await res.json();
    if (!data.ok || !data.prompt) {
      throw new Error('Prompt not found');
    }
    console.log("[fetchPromptById] Data received:", data.prompt);
    return data.prompt;
  } catch (err) {
    console.error("[fetchPromptById] Exception:", err);
    throw err;
  }
}
