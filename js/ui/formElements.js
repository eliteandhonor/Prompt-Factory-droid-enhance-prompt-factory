// formElements.js
// [AUDITFIX] Encapsulate form elements, avoid window._formElements global

let _formElements = null;

export function setFormElements(elements) {
  _formElements = elements;
}

export function getFormElements() {
  if (!_formElements) {
    throw new Error('Form elements not initialized');
  }
  return _formElements;
}