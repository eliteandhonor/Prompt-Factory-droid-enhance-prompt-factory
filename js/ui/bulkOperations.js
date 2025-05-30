/**
 * js/ui/bulkOperations.js
 * Manages bulk operations for prompts: selection, delete, export, edit.
 */

import { fetchPromptById, updatePrompt as apiUpdatePrompt, deletePrompt as apiDeletePrompt } from '../api/prompts.js';
import { getCategories as appGetCategories, getTags as appGetTags } from '../state/appState.js'; // Assuming appState provides full category/tag objects
import { showConfirmationModal, showCustomModal, closeModal } from './modals.js'; // Assuming showCustomModal can render complex forms
import { showToast } from './toast.js';
import { showLoading, hideLoading } from './progress.js';
import { downloadFile } from '../util/helpers.js'; // Assumed helper

// --- State ---
const selectedPromptIds = new Set();
let lastClickedPromptId = null; // For shift-click range selection
let isBulkOperationInProgress = false;

// --- DOM Elements ---
// These selectors should match the actual HTML structure for the bulk actions toolbar
const BULK_TOOLBAR_ID = 'bulk-actions-toolbar';
const SELECTED_COUNT_ID = 'bulk-selected-count';
const SELECT_ALL_BTN_ID = 'bulk-select-all-btn';
const DESELECT_ALL_BTN_ID = 'bulk-deselect-all-btn';
const INVERT_SELECTION_BTN_ID = 'bulk-invert-selection-btn';
const BULK_DELETE_BTN_ID = 'bulk-delete-btn';
const BULK_EXPORT_BTN_ID = 'bulk-export-btn';
const BULK_EDIT_BTN_ID = 'bulk-edit-btn';

let bulkActionsToolbar;
let selectedCountElement;

// --- Initialization ---

/**
 * Initializes the bulk operations module.
 * Should be called once the DOM is ready and toolbar elements exist.
 */
export function initBulkOperations() {
    bulkActionsToolbar = document.getElementById(BULK_TOOLBAR_ID);
    selectedCountElement = document.getElementById(SELECTED_COUNT_ID);

    if (!bulkActionsToolbar || !selectedCountElement) {
        console.warn('Bulk operations toolbar elements not found. Bulk operations may not function correctly.');
        return;
    }

    document.getElementById(SELECT_ALL_BTN_ID)?.addEventListener('click', selectAllVisiblePrompts);
    document.getElementById(DESELECT_ALL_BTN_ID)?.addEventListener('click', deselectAllPrompts);
    document.getElementById(INVERT_SELECTION_BTN_ID)?.addEventListener('click', invertSelection);
    document.getElementById(BULK_DELETE_BTN_ID)?.addEventListener('click', handleBulkDelete);
    document.getElementById(BULK_EXPORT_BTN_ID)?.addEventListener('click', handleBulkExport);
    document.getElementById(BULK_EDIT_BTN_ID)?.addEventListener('click', handleBulkEdit);

    document.addEventListener('keydown', _handleGlobalKeyDown);

    _updateBulkUIToolbar(); // Initially hide toolbar
    console.log('Bulk operations initialized.');
}

/**
 * Registers event listeners for a prompt's selection checkbox.
 * This should be called by the prompt list rendering logic for each prompt item.
 * @param {HTMLInputElement} checkboxElement - The checkbox input element.
 * @param {string} promptId - The ID of the prompt associated with this checkbox.
 */
export function registerPromptCheckboxEvents(checkboxElement, promptId) {
    if (!checkboxElement) return;
    checkboxElement.checked = selectedPromptIds.has(promptId); // Sync checkbox with current selection state
    checkboxElement.addEventListener('change', (event) => {
        _handlePromptCheckboxChange(event, promptId);
    });
    checkboxElement.addEventListener('click', (event) => { // Handle shift-click on the click event
        if (event.shiftKey) {
            _handlePromptCheckboxChange(event, promptId, true);
        }
    });
}

// --- Selection Logic ---

function _handlePromptCheckboxChange(event, promptId, isShiftClick = false) {
    const checkbox = event.target;
    const currentlyVisiblePrompts = _getVisiblePromptElementsAndIds();

    if (isShiftClick && lastClickedPromptId && lastClickedPromptId !== promptId) {
        const lastClickedIndex = currentlyVisiblePrompts.findIndex(p => p.id === lastClickedPromptId);
        const currentIndex = currentlyVisiblePrompts.findIndex(p => p.id === promptId);

        if (lastClickedIndex !== -1 && currentIndex !== -1) {
            const start = Math.min(lastClickedIndex, currentIndex);
            const end = Math.max(lastClickedIndex, currentIndex);
            for (let i = start; i <= end; i++) {
                const idToSelect = currentlyVisiblePrompts[i].id;
                if (checkbox.checked) {
                    selectedPromptIds.add(idToSelect);
                } else {
                    // If shift-unchecking, only uncheck if it was part of the original range action.
                    // This behavior might need refinement based on exact UX desired.
                    // For simplicity, we'll make shift-click always set to the state of the clicked checkbox.
                    selectedPromptIds.add(idToSelect); // Add first, then individual checkboxes will reflect
                }
                const promptElementCheckbox = currentlyVisiblePrompts[i].element.querySelector('.prompt-select-checkbox');
                if (promptElementCheckbox) promptElementCheckbox.checked = checkbox.checked;
            }
             // Ensure the clicked item itself is correctly set
            if (checkbox.checked) {
                selectedPromptIds.add(promptId);
            } else {
                selectedPromptIds.delete(promptId);
            }
        }
    } else {
        if (checkbox.checked) {
            selectedPromptIds.add(promptId);
        } else {
            selectedPromptIds.delete(promptId);
        }
    }

    lastClickedPromptId = promptId;
    _updateBulkUIToolbar();
}

function _getVisiblePromptElementsAndIds() {
    // This selector needs to match how prompt items are rendered and identified
    const promptElements = document.querySelectorAll('#prompt-list .prompt-block'); // Assuming .prompt-block is the item container
    return Array.from(promptElements)
        .filter(el => el.offsetParent !== null) // Basic visibility check
        .map(el => ({
            id: el.dataset.promptId,
            element: el,
            checkbox: el.querySelector('.prompt-select-checkbox') // Assuming this class for checkboxes
        }))
        .filter(p => p.id && p.checkbox);
}

function selectAllVisiblePrompts() {
    const visiblePrompts = _getVisiblePromptElementsAndIds();
    visiblePrompts.forEach(p => {
        selectedPromptIds.add(p.id);
        if (p.checkbox) p.checkbox.checked = true;
    });
    lastClickedPromptId = visiblePrompts.length > 0 ? visiblePrompts[visiblePrompts.length - 1].id : null;
    _updateBulkUIToolbar();
}

function deselectAllPrompts() {
    const checkboxesToUpdate = _getVisiblePromptElementsAndIds(); // Get currently visible to update their checkboxes
    checkboxesToUpdate.forEach(p => {
        if (p.checkbox) p.checkbox.checked = false;
    });
    selectedPromptIds.clear();
    lastClickedPromptId = null;
    _updateBulkUIToolbar();
}

function invertSelection() {
    const visiblePrompts = _getVisiblePromptElementsAndIds();
    visiblePrompts.forEach(p => {
        if (selectedPromptIds.has(p.id)) {
            selectedPromptIds.delete(p.id);
            if (p.checkbox) p.checkbox.checked = false;
        } else {
            selectedPromptIds.add(p.id);
            if (p.checkbox) p.checkbox.checked = true;
        }
    });
    lastClickedPromptId = null; // Inverting selection breaks sequential shift-click logic
    _updateBulkUIToolbar();
}

// --- UI Update Functions ---

function _updateBulkUIToolbar() {
    if (!bulkActionsToolbar || !selectedCountElement) return;

    const count = selectedPromptIds.size;
    if (count > 0) {
        bulkActionsToolbar.style.display = ''; // Or 'flex', 'grid' depending on its layout
        selectedCountElement.textContent = `${count} selected`;
    } else {
        bulkActionsToolbar.style.display = 'none';
        selectedCountElement.textContent = '0 selected';
    }
    // Sync all visible checkboxes (important after operations like invert or select all)
    const visiblePrompts = _getVisiblePromptElementsAndIds();
     visiblePrompts.forEach(p => {
        if (p.checkbox) {
            p.checkbox.checked = selectedPromptIds.has(p.id);
        }
    });
}

// --- Keyboard Shortcut Handler ---

function _handleGlobalKeyDown(event) {
    if (isBulkOperationInProgress) return; // Don't process shortcuts if a modal or operation is active

    // Check if focus is on an input field, textarea, or select to avoid interference
    const activeElement = document.activeElement;
    const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'SELECT' || activeElement.isContentEditable);

    if (isInputFocused && event.key !== 'Escape') return; // Allow Escape to deselect even from inputs

    if (event.key === 'Escape') {
        if (selectedPromptIds.size > 0) {
            deselectAllPrompts();
            event.preventDefault();
        }
    } else if ((event.metaKey || event.ctrlKey) && event.key === 'a') {
        // If not input focused, or if it is but we decide Cmd/Ctrl+A should always work for prompts
        selectAllVisiblePrompts();
        event.preventDefault();
    }
}

// --- Bulk Action Handlers ---

async function handleBulkDelete() {
    if (isBulkOperationInProgress) return;
    const idsToDelete = Array.from(selectedPromptIds);
    if (idsToDelete.length === 0) {
        showToast('No prompts selected for deletion.', 'info');
        return;
    }

    showConfirmationModal(
        `Are you sure you want to delete ${idsToDelete.length} prompt(s)? This action cannot be undone.`,
        async () => {
            isBulkOperationInProgress = true;
            showLoading(`Deleting ${idsToDelete.length} prompt(s)...`);
            let successCount = 0;
            let failCount = 0;

            for (const id of idsToDelete) {
                try {
                    await apiDeletePrompt(id);
                    successCount++;
                } catch (error) {
                    console.error(`Failed to delete prompt ${id}:`, error);
                    failCount++;
                }
            }

            hideLoading();
            if (failCount > 0) {
                showToast(`${successCount} prompt(s) deleted. ${failCount} failed.`, 'warning');
            } else {
                showToast(`${successCount} prompt(s) successfully deleted.`, 'success');
            }
            deselectAllPrompts(); // Clears selection and updates UI
            // Dispatch an event to notify the prompt list to refresh
            document.dispatchEvent(new CustomEvent('promptsChanged', { detail: { reason: 'bulkDelete' } }));
            isBulkOperationInProgress = false;
        },
        () => { /* User cancelled */ }
    );
}

async function handleBulkExport() {
    if (isBulkOperationInProgress) return;
    const idsToExport = Array.from(selectedPromptIds);
    if (idsToExport.length === 0) {
        showToast('No prompts selected for export.', 'info');
        return;
    }

    const modalId = 'bulk-export-options-modal';
    const formHtml = `
        <form id="bulk-export-form">
            <p>Select export format for ${idsToExport.length} prompt(s):</p>
            <div>
                <input type="radio" id="export-json" name="export-format" value="json" checked>
                <label for="export-json">JSON</label>
            </div>
            <div>
                <input type="radio" id="export-csv" name="export-format" value="csv">
                <label for="export-csv">CSV</label>
            </div>
            <div>
                <input type="radio" id="export-markdown" name="export-format" value="md">
                <label for="export-markdown">Markdown</label>
            </div>
            <div class="modal-actions">
                <button type="submit" class="primary">Export</button>
                <button type="button" class="secondary" data-close-modal-id="${modalId}">Cancel</button>
            </div>
        </form>
    `;

    showCustomModal(modalId, 'Bulk Export Options', formHtml, async (formData) => {
        // This callback is executed when the form inside the custom modal is submitted
        // For showCustomModal, we'd typically handle form submission within the modal's own script or event listeners.
        // Let's adjust to handle form submission directly.
    });
    
    // Need to attach listener to the form created by showCustomModal
    // This is a common challenge with dynamically injected forms.
    // A better showCustomModal would return the modal element or take a submit callback.
    // Assuming showCustomModal allows attaching listeners or has a submit callback:
    const exportForm = document.getElementById('bulk-export-form');
    if (exportForm) {
        exportForm.onsubmit = async (e) => {
            e.preventDefault();
            isBulkOperationInProgress = true;
            closeModal(modalId); // Close the options modal

            const format = new FormData(exportForm).get('export-format');
            showLoading(`Exporting ${idsToExport.length} prompt(s) as ${format.toUpperCase()}...`);

            const promptsData = [];
            try {
                for (const id of idsToExport) {
                    // Fetch full prompt data. Consider a bulk fetch API endpoint if performance is an issue.
                    const prompt = await fetchPromptById(id);
                    if (prompt) promptsData.push(prompt);
                }

                if (promptsData.length === 0) {
                    throw new Error("Could not fetch details for selected prompts.");
                }

                let fileContent = '';
                let fileName = `prompts-export-${new Date().toISOString().split('T')[0]}`;
                let mimeType = 'text/plain';

                if (format === 'json') {
                    fileContent = _promptsToJSON(promptsData);
                    fileName += '.json';
                    mimeType = 'application/json';
                } else if (format === 'csv') {
                    fileContent = _promptsToCSV(promptsData);
                    fileName += '.csv';
                    mimeType = 'text/csv';
                } else if (format === 'md') {
                    fileContent = _promptsToMarkdown(promptsData);
                    fileName += '.md';
                    mimeType = 'text/markdown';
                }

                downloadFile(fileName, fileContent, mimeType);
                showToast(`Successfully exported ${promptsData.length} prompt(s).`, 'success');

            } catch (error) {
                console.error('Bulk export failed:', error);
                showToast(`Export failed: ${error.message}`, 'error');
            } finally {
                hideLoading();
                isBulkOperationInProgress = false;
            }
        };
        // Handle cancel button inside the modal
        const cancelButton = exportForm.querySelector(`[data-close-modal-id="${modalId}"]`);
        cancelButton?.addEventListener('click', () => closeModal(modalId));
    } else {
        console.error("Could not find export form in modal.");
    }
}


async function handleBulkEdit() {
    if (isBulkOperationInProgress) return;
    const idsToEdit = Array.from(selectedPromptIds);
    if (idsToEdit.length === 0) {
        showToast('No prompts selected for editing.', 'info');
        return;
    }

    isBulkOperationInProgress = true; // Set early to prevent other actions
    showLoading('Loading edit options...');

    try {
        const [categories, tags] = await Promise.all([appGetCategories(), appGetTags()]);
        hideLoading();

        const modalId = 'bulk-edit-options-modal';
        let categoryOptions = '<option value="">No Change</option>';
        categories.forEach(cat => {
            categoryOptions += `<option value="${cat.id}">${cat.name}</option>`;
        });

        let tagOptions = '';
        tags.forEach(tag => {
            tagOptions += `<option value="${tag.id}">${tag.name}</option>`;
        });

        const formHtml = `
            <form id="bulk-edit-form">
                <p>Editing ${idsToEdit.length} prompt(s):</p>
                <div class="form-group">
                    <label for="bulk-edit-category">Category:</label>
                    <select id="bulk-edit-category" name="category">${categoryOptions}</select>
                </div>
                <div class="form-group">
                    <label for="bulk-edit-tags-action">Tags Action:</label>
                    <select id="bulk-edit-tags-action" name="tagsAction">
                        <option value="">No Change</option>
                        <option value="replace">Replace Tags</option>
                        <option value="add">Add Tags</option>
                        <option value="remove">Remove Tags</option> 
                    </select>
                </div>
                <div class="form-group">
                    <label for="bulk-edit-tags">Select Tags:</label>
                    <select id="bulk-edit-tags" name="tags" multiple size="5" disabled>${tagOptions}</select>
                    <small>Hold Ctrl/Cmd to select multiple. Field enabled when Tags Action is set.</small>
                </div>
                <div class="modal-actions">
                    <button type="submit" class="primary">Apply Changes</button>
                    <button type="button" class="secondary" data-close-modal-id="${modalId}">Cancel</button>
                </div>
            </form>
        `;

        showCustomModal(modalId, 'Bulk Edit Prompts', formHtml);

        const editForm = document.getElementById('bulk-edit-form');
        const tagsActionSelect = document.getElementById('bulk-edit-tags-action');
        const tagsSelect = document.getElementById('bulk-edit-tags');

        if (tagsActionSelect && tagsSelect) {
            tagsActionSelect.addEventListener('change', () => {
                tagsSelect.disabled = !tagsActionSelect.value || tagsActionSelect.value === "";
            });
        }
        
        if (editForm) {
            editForm.onsubmit = async (e) => {
                e.preventDefault();
                closeModal(modalId);
                showLoading(`Updating ${idsToEdit.length} prompt(s)...`);

                const formData = new FormData(editForm);
                const newCategoryId = formData.get('category');
                const tagsAction = formData.get('tagsAction');
                const selectedTagIds = Array.from(tagsSelect.selectedOptions).map(opt => opt.value);

                let successCount = 0;
                let failCount = 0;

                for (const id of idsToEdit) {
                    try {
                        const promptToUpdate = await fetchPromptById(id); // Fetch current prompt data
                        if (!promptToUpdate) {
                            failCount++;
                            console.warn(`Prompt ${id} not found for bulk edit.`);
                            continue;
                        }

                        const updatePayload = {};
                        let changed = false;

                        if (newCategoryId) {
                            updatePayload.category = newCategoryId;
                            changed = true;
                        }

                        if (tagsAction && selectedTagIds.length > 0) {
                            let currentTags = new Set(promptToUpdate.tags || []);
                            if (tagsAction === 'replace') {
                                updatePayload.tags = selectedTagIds;
                                changed = true;
                            } else if (tagsAction === 'add') {
                                selectedTagIds.forEach(tagId => currentTags.add(tagId));
                                updatePayload.tags = Array.from(currentTags);
                                changed = true;
                            } else if (tagsAction === 'remove') {
                                selectedTagIds.forEach(tagId => currentTags.delete(tagId));
                                updatePayload.tags = Array.from(currentTags);
                                changed = true;
                            }
                        } else if (tagsAction === 'replace' && selectedTagIds.length === 0) { // Explicitly clear tags
                            updatePayload.tags = [];
                            changed = true;
                        }


                        if (changed) {
                            await apiUpdatePrompt(id, updatePayload);
                        }
                        successCount++;
                    } catch (error) {
                        console.error(`Failed to update prompt ${id}:`, error);
                        failCount++;
                    }
                }

                hideLoading();
                if (failCount > 0) {
                    showToast(`${successCount} prompt(s) updated. ${failCount} failed.`, 'warning');
                } else {
                    showToast(`${successCount} prompt(s) successfully updated.`, 'success');
                }
                deselectAllPrompts();
                document.dispatchEvent(new CustomEvent('promptsChanged', { detail: { reason: 'bulkEdit' } }));
                isBulkOperationInProgress = false;
            };
             // Handle cancel button inside the modal
            const cancelButton = editForm.querySelector(`[data-close-modal-id="${modalId}"]`);
            cancelButton?.addEventListener('click', () => {
                closeModal(modalId);
                isBulkOperationInProgress = false; // Reset flag on cancel
            });
        } else {
            hideLoading(); // Ensure loading is hidden if form isn't found
            isBulkOperationInProgress = false;
            console.error("Could not find edit form in modal.");
        }

    } catch (error) {
        hideLoading();
        console.error('Failed to load data for bulk edit:', error);
        showToast('Could not load edit options. Please try again.', 'error');
        isBulkOperationInProgress = false; // Reset flag on error
    }
}


// --- Export Formatters (Helper Functions) ---

function _promptsToJSON(prompts) {
    return JSON.stringify(prompts, null, 2);
}

function _promptsToCSV(prompts) {
    if (prompts.length === 0) return '';

    const headers = ['id', 'title', 'content', 'category', 'tags', 'description', 'author', 'created_at', 'updated_at'];
    const csvRows = [];
    csvRows.push(headers.join(','));

    prompts.forEach(prompt => {
        const row = headers.map(header => {
            let value = prompt[header];
            if (header === 'tags' && Array.isArray(value)) {
                value = value.join('|'); // Use pipe as a separator for multiple tags
            }
            if (value === null || value === undefined) {
                value = '';
            }
            // Escape quotes and commas
            value = String(value).replace(/"/g, '""');
            if (String(value).includes(',') || String(value).includes('\n') || String(value).includes('"')) {
                value = `"${value}"`;
            }
            return value;
        });
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

function _promptsToMarkdown(prompts) {
    let mdContent = '# Prompts Export\n\n';
    prompts.forEach(prompt => {
        mdContent += `## ${prompt.title || 'Untitled Prompt'}\n\n`;
        mdContent += `**ID:** ${prompt.id || 'N/A'}\n`;
        mdContent += `**Category:** ${prompt.category || 'N/A'}\n`; // Assuming category is an ID, might need to fetch name
        mdContent += `**Tags:** ${(prompt.tags && prompt.tags.join(', ')) || 'None'}\n`; // Assuming tags are IDs
        mdContent += `**Author:** ${prompt.author || 'N/A'}\n`;
        mdContent += `**Created At:** ${prompt.created_at || 'N/A'}\n`;
        mdContent += `**Updated At:** ${prompt.updated_at || 'N/A'}\n\n`;
        if (prompt.description) {
            mdContent += `**Description:**\n${prompt.description}\n\n`;
        }
        mdContent += `**Content:**\n\`\`\`\n${prompt.content || ''}\n\`\`\`\n\n---\n\n`;
    });
    return mdContent;
}

// --- Public API (Optional, if other modules need to interact) ---
export function clearSelection() {
    deselectAllPrompts();
}

export function getSelectedPromptCount() {
    return selectedPromptIds.size;
}
