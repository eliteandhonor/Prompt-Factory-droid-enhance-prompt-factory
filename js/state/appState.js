/**
 * App State Module
 * Centralizes global app state for prompts, categories, tags, and current prompt.
 * Provides getter/setter functions and change notification.
 */
const state = {
  categories: [],
  tags: [],
  prompts: [],
  currentPrompt: null
};

const listeners = [];

export function getCategories() {
  console.log("getCategories: START");
  const result = state.categories;
  console.log("getCategories: END", { result });
  return result;
}
export function setCategories(categories) {
  console.log("setCategories: START", { categories });
  state.categories = categories;
  notify();
  console.log("setCategories: END", { newState: state.categories });
}
export function getTags() {
  console.log("getTags: START");
  const result = state.tags;
  console.log("getTags: END", { result });
  return result;
}
export function setTags(tags) {
  console.log("setTags: START", { tags });
  state.tags = tags;
  notify();
  console.log("setTags: END", { newState: state.tags });
}
export function getPrompts() {
  console.log("getPrompts: START");
  const result = state.prompts;
  console.log("getPrompts: END", { result });
  return result;
}
export function setPrompts(prompts) {
  console.log("setPrompts: START", { prompts });
  state.prompts = prompts;
  notify();
  console.log("setPrompts: END", { newState: state.prompts });
}
export function getCurrentPrompt() {
  console.log("getCurrentPrompt: START");
  const result = state.currentPrompt;
  console.log("getCurrentPrompt: END", { result });
  return result;
}
export function setCurrentPrompt(prompt) {
  console.log("setCurrentPrompt: START", { prompt });
  state.currentPrompt = prompt;
  notify();
  console.log("setCurrentPrompt: END", { newState: state.currentPrompt });
}
export function subscribe(listener) {
  console.log("subscribe: START", { listenerCount: listeners.length });
  listeners.push(listener);
  console.log("subscribe: Listener added", { listenerCount: listeners.length });
  // Return an unsubscribe function
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) {
      listeners.splice(idx, 1);
      console.log("subscribe: Listener removed", { listenerCount: listeners.length });
    }
  };
}
function notify() {
  console.log("notify: START", { listenerCount: listeners.length, state: { ...state } });
  listeners.forEach(fn => fn({ ...state }));
  console.log("notify: END");
}
