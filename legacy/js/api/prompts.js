// prompts.js — ES6 modular refactor with structured errors, helpers, and stubs
import CONFIG from '../config.js';
import {
  createPrompt as dbCreatePrompt,
  readPrompt as dbReadPrompt,
  updatePrompt as dbUpdatePrompt,
  deletePrompt as dbDeletePrompt,
  listPrompts as dbListPrompts,
  listCategories as dbListCategories,
  listTags as dbListTags,
  filterPromptsByCategory as dbFilterPromptsByCategory,
  filterPromptsByTag as dbFilterPromptsByTag,
  apiReq
} from './db.js';

import { uuidv4 } from '../util/helpers.js';

// --- Utility Types & Helpers ---

/**
 * @typedef {Object} ApiError
 * @property {string} code - Stable error code for UI and i18n.
 * @property {string} message - Human-friendly error message.
 */

/**
 * Returns a structured error object, not a thrown error.
 * @param {string} code
 * @param {string} message
 * @returns {ApiError}
 */
/**
 * Internal: structured error object for API methods (not thrown).
 * If you need an Error instance, wrap as needed.
 * @private
 */
function makeError(code, message, details) {
  return details ? { code, message, details } : { code, message };
}

/**
 * Checks presence of required fields in an object.
 * @param {object} obj
 * @param {string[]} fields
 * @returns {null|ApiError}
 */
function validateFields(obj, fields) {
  for (const f of fields) {
    if (!(f in obj) || obj[f] === undefined || obj[f] === null) {
      return makeError('validation/missing_field', `Missing required field: "${f}"`);
    }
  }
  return null;
}

/**
 * Canonical prompt fields (used for schema validation & docs).
 */
export const PROMPT_FIELDS = [
  "id", "title", "description", "prompt", "tags", "category", "author", "created_at", "updated_at"
];

// --- CRUD Operations ---

/**
 * Create a prompt.
 * @param {object} prompt
 * @returns {Promise<object|ApiError>}
 */
/**
 * Create a prompt.
 * Returns {object} on success, or error-object {code,message} on error.
 * Never throws—consumer must check for .code.
 */
export async function createPrompt(prompt) {
  const v = validateFields(prompt, ["title", "description", "prompt"]);
  if (v) return v;
  try {
    return await dbCreatePrompt(prompt);
  } catch (e) {
    return makeError('prompts/create_error', e?.message || 'Unknown error');
  }
}

/**
 * Read a prompt by ID.
 * @param {string} id
 * @returns {Promise<object|ApiError>}
 */
/**
 * Read prompt by id.
 * Returns prompt {object}, or {code,message} on error/not found.
 * Never throws—consumer must check for .code.
 */
export async function readPrompt(id) {
  if (!id) return makeError('validation/no_id', 'No prompt id supplied');
  try {
    return await dbReadPrompt(id);
  } catch (e) {
    return makeError('prompts/read_error', e?.message || 'Unknown error');
  }
}

/**
 * Update a prompt.
 * @param {object} prompt
 * @returns {Promise<object|ApiError>}
 */
/**
 * Update prompt (requires id).
 * Returns updated {object} on success, {code,message} on fail.
 * Never throws—consumer must check for .code.
 */
export async function updatePrompt(prompt) {
  if (!prompt?.id) return makeError('validation/no_id', 'No prompt id supplied');
  try {
    return await dbUpdatePrompt(prompt);
  } catch (e) {
    return makeError('prompts/update_error', e?.message || 'Unknown error');
  }
}

/**
 * Delete a prompt.
 * @param {string} id
 * @returns {Promise<true|ApiError>}
 */
/**
 * Delete prompt by id.
 * Returns true on success, or error-object on fail.
 * Never throws—consumer must check for .code.
 */
export async function deletePrompt(id) {
  if (!id) return makeError('validation/no_id', 'No prompt id supplied');
  try {
    await dbDeletePrompt(id);
    return true;
  } catch (e) {
    return makeError('prompts/delete_error', e?.message || 'Unknown error');
  }
}

/**
 * List prompts.
 * @returns {Promise<object[]|ApiError>}
 */
/**
 * List all prompts.
 * Returns array of prompt objects, or error-object on fail.
 * Never throws—consumer must check for .code.
 */
export async function listPrompts() {
  try {
    return await dbListPrompts();
  } catch (e) {
    return makeError('prompts/list_error', e?.message || 'Unknown error');
  }
}

/**
 * List prompt categories.
 * @returns {Promise<string[]|ApiError>}
 */
/**
 * List all prompt categories.
 * Returns array of strings or error-object on fail.
 * Never throws.
 */
export async function listCategories() {
  try {
    return await dbListCategories();
  } catch (e) {
    return makeError('prompts/categories_error', e?.message || 'Unknown error');
  }
}

/**
 * List all tags.
 * @returns {Promise<string[]|ApiError>}
 */
/**
 * List all prompt tags.
 * Returns array of strings or error-object on fail.
 * Never throws.
 */
export async function listTags() {
  try {
    return await dbListTags();
  } catch (e) {
    return makeError('prompts/tags_error', e?.message || 'Unknown error');
  }
}

/**
 * Filter prompts by category.
 * @param {string} category
 * @returns {Promise<object[]|ApiError>}
 */
/**
 * Filter prompts by category.
 * Returns filtered array or error object. Never throws.
 */
export async function filterPromptsByCategory(category) {
  if (!category) return makeError('validation/no_category', 'No category supplied');
  try {
    return await dbFilterPromptsByCategory(category);
  } catch (e) {
    return makeError('prompts/filter_category_error', e?.message || 'Unknown error');
  }
}

/**
 * Filter prompts by tag.
 * @param {string} tag
 * @returns {Promise<object[]|ApiError>}
 */
/**
 * Filter prompts by tag.
 * Returns filtered array or error object. Never throws.
 */
export async function filterPromptsByTag(tag) {
  if (!tag) return makeError('validation/no_tag', 'No tag supplied');
  try {
    return await dbFilterPromptsByTag(tag);
  } catch (e) {
    return makeError('prompts/filter_tag_error', e?.message || 'Unknown error');
  }
}

// --- Community Comments & Results ---

/**
 * @param {string} promptId
 * @returns {Promise<object[]|ApiError>}
 */
export async function getPromptComments(promptId) {
  if (!promptId) return makeError('validation/no_prompt_id', 'No prompt id supplied');
  try {
    const all = await apiReq('comments', 'list');
    return all.filter(c => c.promptId === promptId);
  } catch (e) {
    return makeError('prompts/comments_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {{content:string}} contentObj
 * @returns {Promise<object|ApiError>}
 */
export async function addPromptComment(promptId, contentObj) {
  if (!promptId) return makeError('validation/no_prompt_id', 'No prompt id supplied');
  if (!contentObj?.content) return makeError('validation/no_content', 'No comment content');
  const entry = {
    id: uuidv4(),
    promptId,
    created_at: new Date().toISOString(),
    author: 'anon',
    content: contentObj.content
  };
  try {
    await apiReq('comments', 'add', { entry });
    return entry;
  } catch (e) {
    return makeError('prompts/comments_add_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {string} commentId
 * @param {string} newContent
 * @returns {Promise<object|ApiError>}
 */
export async function editPromptComment(promptId, commentId, newContent) {
  if (!promptId || !commentId) return makeError('validation/missing_id', 'Missing prompt or comment id');
  if (!newContent) return makeError('validation/no_content', 'No content supplied');
  try {
    const all = await apiReq('comments', 'list');
    const idx = all.findIndex(c => c.id === commentId && c.promptId === promptId);
    if (idx === -1) return makeError('prompts/not_found', 'Comment not found');
    all[idx].content = newContent;
    all[idx].edited_at = new Date().toISOString();
    await apiReq('comments', 'edit', { id: commentId, entry: all[idx] });
    return all[idx];
  } catch (e) {
    return makeError('prompts/comments_edit_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {string} commentId
 * @returns {Promise<true|ApiError>}
 */
export async function deletePromptComment(promptId, commentId) {
  if (!promptId || !commentId) return makeError('validation/missing_id', 'Missing prompt or comment id');
  try {
    await apiReq('comments', 'delete', { id: commentId });
    return true;
  } catch (e) {
    return makeError('prompts/comments_delete_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @returns {Promise<object[]|ApiError>}
 */
export async function getPromptResults(promptId) {
  if (!promptId) return makeError('validation/no_prompt_id', 'No prompt id supplied');
  try {
    const all = await apiReq('results', 'list');
    return all.filter(r => r.promptId === promptId);
  } catch (e) {
    return makeError('prompts/results_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {{title?:string, content:string}} resultObj
 * @returns {Promise<object|ApiError>}
 */
export async function addPromptResult(promptId, resultObj) {
  if (!promptId) return makeError('validation/no_prompt_id', 'No prompt id supplied');
  if (!resultObj?.content) return makeError('validation/no_content', 'No result content');
  const entry = {
    id: uuidv4(),
    promptId,
    created_at: new Date().toISOString(),
    author: 'anon',
    title: resultObj.title || '',
    content: resultObj.content
  };
  try {
    await apiReq('results', 'add', { entry });
    return entry;
  } catch (e) {
    return makeError('prompts/results_add_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {string} resultId
 * @param {object} updates
 * @returns {Promise<object|ApiError>}
 */
export async function editPromptResult(promptId, resultId, updates) {
  if (!promptId || !resultId) return makeError('validation/missing_id', 'Missing prompt or result id');
  if (!updates || (!updates.content && !('title' in updates))) {
    return makeError('validation/no_updates', 'No valid update fields supplied');
  }
  try {
    const all = await apiReq('results', 'list');
    const idx = all.findIndex(r => r.id === resultId && r.promptId === promptId);
    if (idx === -1) return makeError('prompts/not_found', 'Result not found');
    if (updates.content) all[idx].content = updates.content;
    if ('title' in updates) all[idx].title = updates.title;
    all[idx].edited_at = new Date().toISOString();
    await apiReq('results', 'edit', { id: resultId, entry: all[idx] });
    return all[idx];
  } catch (e) {
    return makeError('prompts/results_edit_error', e?.message || 'Unknown error');
  }
}

/**
 * @param {string} promptId
 * @param {string} resultId
 * @returns {Promise<true|ApiError>}
 */
export async function deletePromptResult(promptId, resultId) {
  if (!promptId || !resultId) return makeError('validation/missing_id', 'Missing prompt or result id');
  try {
    await apiReq('results', 'delete', { id: resultId });
    return true;
  } catch (e) {
    return makeError('prompts/results_delete_error', e?.message || 'Unknown error');
  }
}

// --- Batch Import: Previewer, Chunker, Reporter ---

/**
 * Preview batch import: validates and returns validation reports before actual import.
 * @param {object[]} raws - Raw prompt objects
 * @returns {{ preview: object[], errors: ApiError[] }}
 */
export function previewBatchPrompts(raws) {
  /** @type {object[]} */
  const preview = [];
  /** @type {ApiError[]} */
  const errors = [];
  // FUTURE: Consider validating the full PROMPT_FIELDS set, not just minimal.
  raws.forEach((raw, i) => {
    const v = validateFields(raw, ["title", "description", "prompt"]);
    if (v) {
      errors.push({ ...v, code: 'batch/invalid', message: `Item ${i}: ${v.message}` });
      preview.push(undefined);
    } else {
      preview.push({ ...raw });
    }
  });
  return { preview, errors };
}

/**
 * Chunk an array into smaller batches for import or processing.
 * @param {object[]} arr
 * @param {number} chunkSize
 * @returns {object[][]}
 */
export function chunkArray(arr, chunkSize) {
  if (!Array.isArray(arr) || chunkSize < 1) return [];
  const chunks = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    chunks.push(arr.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Import prompts in batch with per-file feedback.
 * @param {object[]} items
 * @param {number} [chunkSize=10]
 * @param {function} [onProgress] - Called after each chunk ({ done, total, errors })
 * @returns {Promise<{imported: number, errors: ApiError[]}>}
 */
export async function importPromptsBatch(items, chunkSize = 10, onProgress) {
  let imported = 0;
  /** @type {ApiError[]} */
  const errors = [];
  const chunks = chunkArray(items, chunkSize);
  for (let i = 0; i < chunks.length; ++i) {
    const chunk = chunks[i];
    for (const [j, item] of chunk.entries()) {
      const v = validateFields(item, ["title", "description", "prompt"]);
      if (v) {
        errors.push({ ...v, code: 'batch/invalid', message: `Chunk ${i} Item ${j}: ${v.message}` });
        continue;
      }
      try {
        const res = await createPrompt(item);
        if (res && !res.code) imported++;
        else if (res?.code) errors.push(res);
      } catch (e) {
        errors.push(makeError('batch/import_error', e?.message || 'Unknown error'));
      }
    }
    if (onProgress) onProgress({ done: (i + 1) * chunkSize, total: items.length, errors: [...errors] });
  }
  return { imported, errors };
}

// --- Dev/Test hooks and stubs ---

/**
 * Simulated latency/errors for development and tests.
 * FUTURE: Extend with richer test scenarios.
 * Returns ApiError object on forced error, else resolves.
 */
export async function devTestHook(opts = {}) {
  if (opts.delayMs) await new Promise(r => setTimeout(r, opts.delayMs));
  if (opts.forceError)
    return makeError('dev/forced_error', 'Simulated error for devTestHook');
}

/**
 * Health poll routine stub (to be overridden by integration).
 * @returns {Promise<{ ok: boolean, ts: number, error?: ApiError }>}
 */
/**
 * Stub: Health poll routine for integration or extension.
 * Returns {ok, ts, api} object; error object on failure.
 */
export async function healthPollStub() {
  // Simulate a health check with the current config.
  try {
    return { ok: true, ts: Date.now(), api: CONFIG.apiEndpoint };
  } catch (e) {
    return { ok: false, ts: Date.now(), error: makeError('health/failure', e?.message || 'Unknown error') };
  }
}