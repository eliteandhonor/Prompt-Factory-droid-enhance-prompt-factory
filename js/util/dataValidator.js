/**
 * js/util/dataValidator.js
 * Comprehensive data validation, sanitization, and error handling system.
 */

// --- Helper: HTML Escaping (Basic XSS Prevention for strings) ---
/**
 * Escapes HTML special characters in a string.
 * @param {string} str - The string to escape.
 * @returns {string} The escaped string, or an empty string if input is null/undefined.
 */
export function escapeHtml(str) {
  if (str === null || typeof str === 'undefined') {
    return '';
  }
  if (typeof str !== 'string') {
    try {
      str = String(str);
    } catch (e) {
      return ''; // Should not happen for most primitive types
    }
  }
  return str.replace(/[&<>"']/g, function (match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match];
  });
}

/**
 * Basic input sanitization by escaping HTML.
 * For rich text or complex HTML, use a dedicated library like DOMPurify after this basic step.
 * @param {*} value - The input value to sanitize.
 * @returns {*} Sanitized value (string if input was string, otherwise original).
 */
export function sanitizeInput(value) {
  if (typeof value === 'string') {
    return escapeHtml(value);
  }
  return value; // Non-string values are returned as-is for now
}

// --- Custom Error Class ---
export class ValidationError extends Error {
  constructor(message, details = []) {
    super(message);
    this.name = 'ValidationError';
    this.details = details; // Array of { field, message, value }
  }
}

// --- Entity Schemas ---
// Schemas define the expected structure and validation rules for data entities.
// Based on db_parts/config.php but adapted for client-side validation needs.
const SCHEMAS = {
  prompt: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 40, label: 'Prompt ID' },
    title: { type: 'string', required: true, minLength: 1, maxLength: 255, label: 'Title' },
    content: { type: 'string', required: true, minLength: 1, maxLength: 20000, label: 'Content' },
    description: { type: 'string', maxLength: 5000, label: 'Description' },
    category: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, label: 'Category ID' }, // Should exist in categories
    tags: { type: 'array', required: true, items: { type: 'string', pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 50 }, label: 'Tags' }, // Items should exist in tags
    author: { type: 'string', maxLength: 100, label: 'Author' },
    user_id: { type: 'string', required: false, pattern: /^[a-zA-Z0-9_@.-]+$/, maxLength: 60, label: 'User ID' }, // Usually set by backend
    created_at: { type: 'string', format: 'iso8601', label: 'Creation Date' },
    updated_at: { type: 'string', format: 'iso8601', label: 'Update Date' },
    schemaVersion: { type: 'string', pattern: /^\d+\.\d+$/, label: 'Schema Version' }
  },
  category: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 40, label: 'Category ID' },
    name: { type: 'string', required: true, minLength: 1, maxLength: 100, label: 'Category Name' },
    created_at: { type: 'string', format: 'iso8601', label: 'Creation Date' },
    updated_at: { type: 'string', format: 'iso8601', label: 'Update Date' }
  },
  tag: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 40, label: 'Tag ID' },
    name: { type: 'string', required: true, minLength: 1, maxLength: 50, label: 'Tag Name' },
    created_at: { type: 'string', format: 'iso8601', label: 'Creation Date' },
    updated_at: { type: 'string', format: 'iso8601', label: 'Update Date' }
  },
  comment: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 40, label: 'Comment ID' },
    prompt_id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, label: 'Prompt ID' }, // Should exist in prompts
    comment: { type: 'string', required: true, minLength: 1, maxLength: 5000, label: 'Comment Text' }, // 'comment' field as per schema
    author: { type: 'string', maxLength: 100, label: 'Author' },
    user_id: { type: 'string', required: false, pattern: /^[a-zA-Z0-9_@.-]+$/, maxLength: 60, label: 'User ID' },
    created_at: { type: 'string', format: 'iso8601', label: 'Creation Date' },
    updated_at: { type: 'string', format: 'iso8601', label: 'Update Date' }
  },
  result: {
    id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, maxLength: 40, label: 'Result ID' },
    prompt_id: { type: 'string', required: true, pattern: /^[a-zA-Z0-9_.-]+$/, label: 'Prompt ID' }, // Should exist in prompts
    output: { type: 'string', required: true, minLength: 1, maxLength: 20000, label: 'Output Text' }, // 'output' field as per schema
    score: { type: 'number', min: 0, max: 100, label: 'Score' },
    user_id: { type: 'string', required: false, pattern: /^[a-zA-Z0-9_@.-]+$/, maxLength: 60, label: 'User ID' },
    created_at: { type: 'string', format: 'iso8601', label: 'Creation Date' },
    updated_at: { type: 'string', format: 'iso8601', label: 'Update Date' }
  }
  // Add other schemas like 'user' if needed
};

// --- Core Validation Logic ---

/**
 * Validates a single value against a specific rule.
 * @param {*} value - The value to validate.
 * @param {object} rule - The validation rule object from the schema.
 * @param {string} fieldName - The name of the field being validated.
 * @returns {{isValid: boolean, message?: string}} Validation result.
 */
function validateValue(value, rule, fieldName) {
  const label = rule.label || fieldName;

  if (rule.required && (value === null || typeof value === 'undefined' || String(value).trim() === '')) {
    return { isValid: false, message: `${label} is required.` };
  }

  // If not required and value is empty, it's valid (unless other rules apply, handled below)
  if (!rule.required && (value === null || typeof value === 'undefined' || String(value).trim() === '')) {
    return { isValid: true };
  }

  if (rule.type) {
    if (rule.type === 'array' && !Array.isArray(value)) {
      return { isValid: false, message: `${label} must be an array.` };
    }
    if (rule.type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        return { isValid: false, message: `${label} must be an object.`};
    }
    if (rule.type !== 'array' && rule.type !== 'object' && typeof value !== rule.type) {
      // Allow string representation of numbers for form inputs, but strict type for 'number'
      if (rule.type === 'number' && (isNaN(parseFloat(value)) || !isFinite(value))) {
         return { isValid: false, message: `${label} must be a valid number.` };
      } else if (rule.type !== 'number') {
         return { isValid: false, message: `${label} must be of type ${rule.type}.` };
      }
    }
  }

  if (typeof value === 'string') {
    const sValue = String(value).trim(); // Use trimmed value for length checks, but original for pattern
    if (rule.minLength && sValue.length < rule.minLength) {
      return { isValid: false, message: `${label} must be at least ${rule.minLength} characters long.` };
    }
    if (rule.maxLength && value.length > rule.maxLength) { // Check original length for maxLength
      return { isValid: false, message: `${label} must be no more than ${rule.maxLength} characters long.` };
    }
    if (rule.pattern && !rule.pattern.test(value)) { // Check original value for pattern
      return { isValid: false, message: `${label} has an invalid format.` };
    }
    if (rule.format === 'iso8601') {
      const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
      if (!iso8601Pattern.test(value)) {
        return { isValid: false, message: `${label} must be a valid ISO 8601 date string.` };
      }
    }
     if (rule.format === 'url') {
        try {
            new URL(value);
        } catch (_) {
            return { isValid: false, message: `${label} must be a valid URL.` };
        }
    }
  }

  if (typeof value === 'number') {
    if (rule.min !== undefined && value < rule.min) {
      return { isValid: false, message: `${label} must be at least ${rule.min}.` };
    }
    if (rule.max !== undefined && value > rule.max) {
      return { isValid: false, message: `${label} must be no more than ${rule.max}.` };
    }
  }

  if (Array.isArray(value) && rule.items) {
    for (let i = 0; i < value.length; i++) {
      const itemValidation = validateValue(value[i], rule.items, `${label} item ${i + 1}`);
      if (!itemValidation.isValid) {
        return itemValidation; // Return first item error
      }
    }
  }

  return { isValid: true };
}

/**
 * Validates an entity against its schema.
 * @param {object} entity - The entity object to validate.
 * @param {string} entityType - The type of the entity (e.g., 'prompt', 'category').
 * @param {object} [datasets={}] - Optional map of datasets for relational integrity checks (e.g., { categories: allCategoriesArray, tags: allTagsArray }).
 * @returns {{isValid: boolean, errors: Array<{field: string, message: string, value: any}>}} Validation result.
 */
export function validateEntity(entity, entityType, datasets = {}) {
  const schema = SCHEMAS[entityType];
  if (!schema) {
    return { isValid: false, errors: [{ field: '_schema', message: `Unknown entity type: ${entityType}`, value: entityType }] };
  }

  const errors = [];

  for (const fieldName in schema) {
    const rule = schema[fieldName];
    const value = entity[fieldName];

    // Basic validation
    const validationResult = validateValue(value, rule, fieldName);
    if (!validationResult.isValid) {
      errors.push({ field: fieldName, message: validationResult.message, value });
    }

    // Data integrity checks (examples)
    if (validationResult.isValid && value !== null && typeof value !== 'undefined') {
      if (fieldName === 'category' && entityType === 'prompt' && datasets.categories) {
        if (!datasets.categories.some(cat => cat.id === value)) {
          errors.push({ field: fieldName, message: `Category ID "${value}" does not exist.`, value });
        }
      }
      if (fieldName === 'tags' && entityType === 'prompt' && Array.isArray(value) && datasets.tags) {
        value.forEach(tagId => {
          if (!datasets.tags.some(tag => tag.id === tagId)) {
            errors.push({ field: fieldName, message: `Tag ID "${tagId}" does not exist.`, value: tagId });
          }
        });
      }
      if (fieldName === 'prompt_id' && (entityType === 'comment' || entityType === 'result') && datasets.prompts) {
         if (!datasets.prompts.some(p => p.id === value)) {
            errors.push({ field: fieldName, message: `Prompt ID "${value}" does not exist.`, value });
        }
      }
    }
  }
  
  // Check for extraneous fields not in schema (optional, can be strict)
  // for (const fieldName in entity) {
  //   if (!schema.hasOwnProperty(fieldName)) {
  //     errors.push({ field: fieldName, message: `Unexpected field "${fieldName}".`, value: entity[fieldName] });
  //   }
  // }

  return { isValid: errors.length === 0, errors };
}

/**
 * Formats validation errors into a user-friendly string or array.
 * @param {Array<{field: string, message: string}>} errors - Array of error objects.
 * @param {'string' | 'array'} [format='string'] - Desired output format.
 * @returns {string | string[]} Formatted error messages.
 */
export function formatValidationErrors(errors, format = 'string') {
  const messages = errors.map(err => `${err.field ? `Field '${err.field}': ` : ''}${err.message}`);
  if (format === 'array') {
    return messages;
  }
  return messages.join('\n');
}

// --- Form Validation ---

/**
 * Validates a single form field and provides real-time feedback.
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} fieldElement - The form field element.
 * @param {string} entityType - The type of entity the form is for (to get the schema).
 * @returns {{isValid: boolean, message?: string}} Validation result for the specific field.
 */
export function validateFormField(fieldElement, entityType) {
  const fieldName = fieldElement.name || fieldElement.id;
  const schema = SCHEMAS[entityType];

  if (!schema || !schema[fieldName]) {
    // console.warn(`No validation rule found for field "${fieldName}" in schema "${entityType}".`);
    return { isValid: true }; // No rule, assume valid or handle elsewhere
  }

  const rule = schema[fieldName];
  let value = fieldElement.type === 'checkbox' ? fieldElement.checked : fieldElement.value;
  
  if (fieldElement.multiple && fieldElement.tagName === 'SELECT') {
    value = Array.from(fieldElement.selectedOptions).map(opt => opt.value);
  } else if (rule.type === 'number') {
    value = value === '' ? undefined : parseFloat(value); // Convert to number for validation
  }


  const result = validateValue(value, rule, fieldName);

  // Example: Update ARIA attributes for accessibility
  if (result.isValid) {
    fieldElement.removeAttribute('aria-invalid');
    fieldElement.removeAttribute('aria-describedby');
    // Clear any associated error message display
    const errorDisplay = document.getElementById(`${fieldElement.id}-error`);
    if (errorDisplay) errorDisplay.textContent = '';
  } else {
    fieldElement.setAttribute('aria-invalid', 'true');
    const errorDisplayId = `${fieldElement.id}-error`;
    fieldElement.setAttribute('aria-describedby', errorDisplayId);
    // Display error message (implementation depends on UI structure)
    const errorDisplay = document.getElementById(errorDisplayId);
    if (errorDisplay) errorDisplay.textContent = result.message;
  }

  return result;
}

/**
 * Validates all fields in a given form.
 * @param {HTMLFormElement} formElement - The form element.
 * @param {string} entityType - The type of entity the form represents.
 * @param {object} [datasets={}] - Optional datasets for relational integrity.
 * @returns {{isValid: boolean, errors: Array<{field: string, message: string, value: any}>, formData: object}}
 */
export function validateForm(formElement, entityType, datasets = {}) {
  const formData = {};
  const elements = formElement.elements;
  let allFieldsValid = true;
  const formLevelErrors = [];

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (!element.name || element.type === 'submit' || element.type === 'button' || element.type === 'reset') {
      continue;
    }

    let value;
    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (element.type === 'select-multiple') {
      value = Array.from(element.selectedOptions).map(opt => opt.value);
    } else {
      value = element.value;
    }
    
    // Basic sanitization for string inputs before storing in formData
    formData[element.name] = sanitizeInput(value);

    // Perform validation (which might re-sanitize or use raw for specific checks like length)
    const fieldValidation = validateFormField(element, entityType); // This also updates ARIA
    if (!fieldValidation.isValid) {
      allFieldsValid = false;
      // Error already displayed by validateFormField, but can collect them too
      formLevelErrors.push({ field: element.name, message: fieldValidation.message, value: element.value });
    }
  }

  // Perform entity-level validation after collecting all form data
  const entityValidation = validateEntity(formData, entityType, datasets);
  if (!entityValidation.isValid) {
    allFieldsValid = false;
    entityValidation.errors.forEach(err => {
        // Avoid duplicate messages if field-level already caught it,
        // but add if it's a cross-field or entity-level rule.
        if (!formLevelErrors.some(fe => fe.field === err.field && fe.message === err.message)) {
            formLevelErrors.push(err);
        }
        // Try to associate with a field for ARIA
        const fieldEl = formElement.elements[err.field];
        if (fieldEl) {
            fieldEl.setAttribute('aria-invalid', 'true');
            const errorDisplayId = `${fieldEl.id}-error`;
            fieldEl.setAttribute('aria-describedby', errorDisplayId);
            const errorDisplay = document.getElementById(errorDisplayId);
            if (errorDisplay && !errorDisplay.textContent) errorDisplay.textContent = err.message; // Only if not already set
        }
    });
  }

  return { isValid: allFieldsValid, errors: formLevelErrors, formData };
}

// --- API Response Validation ---

/**
 * Validates an API response structure.
 * This is a simplified example; more complex responses might need more detailed schemas.
 * @param {object} responseData - The data part of the API response.
 * @param {'list' | 'single' | 'status'} expectedType - The expected type of response.
 * @param {string} [entityType] - If 'list' or 'single', the type of entity expected (e.g., 'prompt').
 * @returns {{isValid: boolean, errors: Array<{field: string, message: string}>}}
 */
export function validateApiResponse(responseData, expectedType, entityType) {
  const errors = [];
  if (typeof responseData !== 'object' || responseData === null) {
    errors.push({ field: 'response', message: 'Response data must be an object.' });
    return { isValid: false, errors };
  }

  if (!responseData.hasOwnProperty('ok')) {
    errors.push({ field: 'ok', message: 'Response missing "ok" status field.' });
  } else if (typeof responseData.ok !== 'boolean') {
    errors.push({ field: 'ok', message: '"ok" status field must be a boolean.' });
  }

  if (responseData.ok === false) {
    if (!responseData.hasOwnProperty('error') || typeof responseData.error !== 'string') {
      errors.push({ field: 'error', message: 'Failed response must include an "error" message string.' });
    }
    // If ok is false, we often don't validate further payload unless specific cases demand it.
    return { isValid: errors.length === 0, errors };
  }

  // If 'ok' is true, proceed with payload validation based on expectedType
  switch (expectedType) {
    case 'list':
      if (!entityType || !SCHEMAS[entityType]) {
        errors.push({ field: '_schema', message: `Invalid entityType "${entityType}" for list validation.` });
        break;
      }
      const listKey = `${entityType}s`; // e.g., 'prompts', 'categories'
      if (!responseData.hasOwnProperty(listKey) || !Array.isArray(responseData[listKey])) {
        errors.push({ field: listKey, message: `Response missing or invalid "${listKey}" array.` });
      } else {
        // Optionally, validate each item in the list (can be performance intensive for large lists)
        // responseData[listKey].forEach((item, index) => {
        //   const itemValidation = validateEntity(item, entityType);
        //   if (!itemValidation.isValid) {
        //     errors.push({ field: `${listKey}[${index}]`, message: `Invalid item: ${formatValidationErrors(itemValidation.errors)}` });
        //   }
        // });
      }
      break;
    case 'single':
      if (!entityType || !SCHEMAS[entityType]) {
        errors.push({ field: '_schema', message: `Invalid entityType "${entityType}" for single entity validation.` });
        break;
      }
      if (!responseData.hasOwnProperty(entityType) || typeof responseData[entityType] !== 'object') {
        errors.push({ field: entityType, message: `Response missing or invalid "${entityType}" object.` });
      } else {
        const itemValidation = validateEntity(responseData[entityType], entityType);
        if (!itemValidation.isValid) {
          errors.push({ field: entityType, message: `Invalid ${entityType} data: ${formatValidationErrors(itemValidation.errors)}` });
        }
      }
      break;
    case 'status': // e.g., for create/update/delete operations that just return status
      // Often, just checking 'ok: true' is enough. Specific success messages can be checked if needed.
      // if (responseData.hasOwnProperty('message') && typeof responseData.message !== 'string') {
      //   errors.push({field: 'message', message: 'Optional success message must be a string.'});
      // }
      break;
    default:
      errors.push({ field: '_expectedType', message: `Unknown expectedType "${expectedType}" for API validation.` });
  }

  return { isValid: errors.length === 0, errors };
}


// --- Data Integrity & Recovery (Conceptual Stubs) ---

/**
 * Checks data integrity and attempts to provide default/safe values.
 * This is a placeholder for more complex logic.
 * @param {object} entity - The entity to check.
 * @param {string} entityType - The type of entity.
 * @returns {object} The entity, potentially modified with defaults.
 */
export function ensureDataIntegrity(entity, entityType) {
  const schema = SCHEMAS[entityType];
  if (!schema) return entity;

  const newEntity = { ...entity };
  for (const fieldName in schema) {
    const rule = schema[fieldName];
    if (rule.required && (typeof newEntity[fieldName] === 'undefined' || newEntity[fieldName] === null)) {
      // Attempt to provide a default based on type
      if (rule.type === 'string') newEntity[fieldName] = '';
      else if (rule.type === 'number') newEntity[fieldName] = 0;
      else if (rule.type === 'array') newEntity[fieldName] = [];
      else if (rule.type === 'boolean') newEntity[fieldName] = false;
      console.warn(`[Integrity] Missing required field "${fieldName}" in ${entityType}, applied default.`);
    }
  }
  return newEntity;
}

// --- Client-Side Data Migration Utilities (Conceptual Stubs) ---

/**
 * Migrates a single entity data from an old version to the current version.
 * This is a STUB. Real migration involves detailed transformation logic per version.
 * @param {object} entityData - The entity data to migrate.
 * @param {string} entityType - The type of entity (e.g., 'prompt').
 * @param {string} fromVersion - The version of the input entityData (e.g., "1.0").
 * @returns {object} The migrated entity data (conforming to the current schema).
 */
export function migrateEntityData(entityData, entityType, fromVersion) {
  const currentSchemaVersion = SCHEMAS[entityType]?.schemaVersion?.default || "1.0"; // Assuming schema has a default version
  
  console.log(`[Migration STUB] Attempting to migrate ${entityType} from v${fromVersion} to v${currentSchemaVersion}`);
  let migratedData = { ...entityData };

  if (entityType === 'prompt') {
    if (fromVersion === "0.9" && currentSchemaVersion === "1.0") {
      // Example migration: rename a field, add a new required field with default
      // if (migratedData.oldFieldName) {
      //   migratedData.newFieldName = migratedData.oldFieldName;
      //   delete migratedData.oldFieldName;
      // }
      // if (!migratedData.schemaVersion) {
      //    migratedData.schemaVersion = "1.0";
      // }
      console.log(`[Migration STUB] Applied hypothetical migration for prompt v0.9 to v1.0`);
    }
    // Add more migration steps for other versions as needed
  }
  
  // Ensure schemaVersion is set
  if (!migratedData.schemaVersion && SCHEMAS[entityType]?.schemaVersion) {
      migratedData.schemaVersion = currentSchemaVersion;
  }


  // Final validation against current schema
  const validation = validateEntity(migratedData, entityType);
  if (!validation.isValid) {
    console.warn(`[Migration STUB] Post-migration validation failed for ${entityType}:`, validation.errors);
    // Depending on strategy, might throw error or return partially migrated data with warnings
  }

  return migratedData;
}

/**
 * Migrates an array of entities.
 * @param {object[]} entityArray - Array of entity data.
 * @param {string} entityType - Type of entities in the array.
 * @param {string} fromVersion - Version of the input data.
 * @returns {object[]} Array of migrated entities.
 */
export function migrateEntityArray(entityArray, entityType, fromVersion) {
    if (!Array.isArray(entityArray)) {
        console.error("[Migration] Expected an array for batch migration.");
        return [];
    }
    return entityArray.map(entity => migrateEntityData(entity, entityType, fromVersion));
}

console.log('[DataValidator] Module loaded.');
