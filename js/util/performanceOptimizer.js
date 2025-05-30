/**
 * js/util/performanceOptimizer.js
 * A collection of utilities and classes for optimizing various aspects of web application performance.
 * Includes: Virtual Scrolling, Data Caching (LRU), Request Deduplication/Batching,
 * Memory Monitoring, Lazy Loading concepts, JSON Parsing Optimization, and DOM Optimization.
 */

// --- 1. Virtual Scrolling ---

/**
 * VirtualScroller class to handle rendering large lists efficiently.
 * Renders only the items visible in the viewport.
 */
export class VirtualScroller {
  /**
   * @param {HTMLElement} container - The scrollable container element.
   * @param {Array<any>} allItems - The full list of items to render.
   * @param {Function} renderItemFn - A function that takes an item and its index, and returns an HTMLElement or HTML string.
   * @param {object} [options={}] - Configuration options.
   * @param {number} [options.itemHeight=50] - Estimated height of a single item (can be dynamic).
   * @param {number} [options.bufferSize=10] - Number of items to render above/below the viewport.
   * @param {Function} [options.getItemHeightFn] - Optional function to get specific height for an item at an index.
   */
  constructor(container, allItems, renderItemFn, options = {}) {
    this.container = container;
    this.allItems = allItems;
    this.renderItemFn = renderItemFn;
    this.itemHeight = options.itemHeight || 50;
    this.bufferSize = options.bufferSize || 10; // Number of items to render outside viewport
    this.getItemHeightFn = options.getItemHeightFn; // For variable height items

    this.scrollTop = 0;
    this.viewportHeight = 0;
    this.totalContentHeight = 0;

    this.renderedItems = new Map(); // Map of index to rendered element
    this.itemPositions = []; // Stores y-position of each item if heights are variable

    this._calculateTotalContentHeight();

    // Create a sizer element to set the scrollbar height correctly
    this.sizer = document.createElement('div');
    this.sizer.style.width = '1px';
    this.sizer.style.opacity = '0';
    this.sizer.style.position = 'absolute';
    this.sizer.style.height = `${this.totalContentHeight}px`;
    this.container.style.position = 'relative'; // Ensure container is a positioned parent
    this.container.appendChild(this.sizer);

    this.onScroll = this.onScroll.bind(this);
    this.container.addEventListener('scroll', this.onScroll, { passive: true });

    this.updateViewport();
    this.render();
  }

  _calculateTotalContentHeight() {
    if (this.getItemHeightFn) {
      this.totalContentHeight = 0;
      this.itemPositions = [];
      for (let i = 0; i < this.allItems.length; i++) {
        this.itemPositions.push(this.totalContentHeight);
        this.totalContentHeight += this.getItemHeightFn(i, this.allItems[i]);
      }
    } else {
      this.totalContentHeight = this.allItems.length * this.itemHeight;
    }
    if (this.sizer) {
        this.sizer.style.height = `${this.totalContentHeight}px`;
    }
  }

  updateViewport() {
    this.scrollTop = this.container.scrollTop;
    this.viewportHeight = this.container.clientHeight;
  }

  updateItems(newItems) {
    this.allItems = newItems;
    this._calculateTotalContentHeight();
    this.renderedItems.clear(); // Clear old rendered items
    // Remove all direct children except the sizer
    Array.from(this.container.children).forEach(child => {
        if (child !== this.sizer) {
            this.container.removeChild(child);
        }
    });
    this.render();
  }

  render() {
    const startIndex = this._getStartIndex();
    const endIndex = this._getEndIndex();

    const newRenderedItems = new Map();

    for (let i = startIndex; i <= endIndex; i++) {
      if (i < 0 || i >= this.allItems.length) continue;

      let itemElement = this.renderedItems.get(i);
      if (!itemElement) {
        itemElement = this.renderItemFn(this.allItems[i], i);
        if (typeof itemElement === 'string') {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = itemElement.trim();
            itemElement = tempDiv.firstChild;
        }
        if (!itemElement) continue;

        itemElement.style.position = 'absolute';
        itemElement.style.left = '0';
        itemElement.style.right = '0'; // Ensure full width
        this.container.appendChild(itemElement);
      }

      const topPosition = this.getItemHeightFn ? this.itemPositions[i] : i * this.itemHeight;
      itemElement.style.top = `${topPosition}px`;
      if (!this.getItemHeightFn) { // If fixed height
        itemElement.style.height = `${this.itemHeight}px`;
      }

      newRenderedItems.set(i, itemElement);
      this.renderedItems.delete(i); // Remove from old map to track items to remove
    }

    // Remove items that are no longer in the viewport
    this.renderedItems.forEach((element, _) => {
      this.container.removeChild(element);
    });

    this.renderedItems = newRenderedItems;
  }

  _getStartIndex() {
    let startNode = 0;
    if (this.getItemHeightFn) {
        // Binary search or linear scan for variable heights
        for(let i=0; i < this.itemPositions.length; i++) {
            if (this.itemPositions[i] + this.getItemHeightFn(i, this.allItems[i]) > this.scrollTop) {
                startNode = i;
                break;
            }
        }
    } else {
        startNode = Math.floor(this.scrollTop / this.itemHeight);
    }
    return Math.max(0, startNode - this.bufferSize);
  }

  _getEndIndex() {
    let endNode = 0;
    const scrollBottom = this.scrollTop + this.viewportHeight;
     if (this.getItemHeightFn) {
        for(let i=this._getStartIndex(); i < this.itemPositions.length; i++) {
             if (this.itemPositions[i] >= scrollBottom) {
                endNode = i;
                break;
            }
            if (i === this.itemPositions.length -1) endNode = i; // last item
        }
    } else {
        endNode = Math.ceil(scrollBottom / this.itemHeight);
    }
    return Math.min(this.allItems.length - 1, endNode + this.bufferSize);
  }

  onScroll() {
    this.updateViewport();
    requestAnimationFrame(() => this.render());
  }

  destroy() {
    this.container.removeEventListener('scroll', this.onScroll);
    if (this.sizer && this.sizer.parentNode === this.container) {
        this.container.removeChild(this.sizer);
    }
    this.renderedItems.forEach(element => {
        if (element.parentNode === this.container) {
            this.container.removeChild(element);
        }
    });
    this.renderedItems.clear();
    this.allItems = [];
    this.itemPositions = [];
  }
}

// --- 2. Data Caching with LRU Eviction ---

/**
 * LRUCache class for caching data with a Least Recently Used eviction policy.
 */
export class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) {
      return null;
    }
    const value = this.cache.get(key);
    // Move to end to mark as recently used
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key); // Remove old entry to update its position
    } else if (this.cache.size >= this.capacity) {
      // Evict least recently used (first item in map iteration)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }

  delete(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// --- 3. Request Deduplication and Batching ---

const ongoingRequests = new Map(); // key: request identifier, value: Promise

/**
 * Deduplicates identical concurrent requests.
 * @param {string} requestId - A unique identifier for the request (e.g., URL + params).
 * @param {Function} requestFn - A function that returns a Promise for the actual request.
 * @returns {Promise<any>}
 */
export function deduplicateRequest(requestId, requestFn) {
  if (ongoingRequests.has(requestId)) {
    console.log(`[DeduplicateRequest] Request ${requestId} is ongoing, returning existing promise.`);
    return ongoingRequests.get(requestId);
  }

  const requestPromise = requestFn()
    .then(response => {
      ongoingRequests.delete(requestId);
      return response;
    })
    .catch(error => {
      ongoingRequests.delete(requestId);
      throw error;
    });

  ongoingRequests.set(requestId, requestPromise);
  return requestPromise;
}

/**
 * Batches multiple calls to a function that occur within a short time window.
 * Useful for API calls that can accept multiple IDs.
 * @param {Function} batchProcessorFn - Function that takes an array of items and processes them (e.g., API call).
 * @param {number} [delay=50] - Milliseconds to wait for batching.
 * @returns {Function} A function that you call with individual items to be batched.
 */
export function createBatchRequester(batchProcessorFn, delay = 50) {
  let batch = [];
  let timeoutId = null;

  return function(item) {
    return new Promise((resolve, reject) => {
      batch.push({ item, resolve, reject });

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        const currentBatch = [...batch];
        batch = [];
        timeoutId = null;
        try {
          const results = await batchProcessorFn(currentBatch.map(b => b.item));
          // Assuming results array matches the order of items in currentBatch
          if (Array.isArray(results) && results.length === currentBatch.length) {
            currentBatch.forEach((b, index) => b.resolve(results[index]));
          } else if (results !== undefined && currentBatch.length === 1) { // Single item result
             currentBatch[0].resolve(results);
          }
          else { // Fallback if result structure is unexpected or for general processing
            currentBatch.forEach(b => b.resolve(results)); // Resolve all with the same result or handle error
            if (!Array.isArray(results) || results.length !== currentBatch.length) {
                console.warn('[BatchRequester] Batch processor did not return an array of matching length or a single expected result.');
            }
          }
        } catch (error) {
          currentBatch.forEach(b => b.reject(error));
        }
      }, delay);
    });
  };
}

// --- 4. Memory Usage Monitoring ---

/**
 * Logs current memory usage to the console.
 * Note: `performance.memory` is non-standard and primarily available in Chrome-based browsers.
 */
export function logMemoryUsage() {
  if (performance && performance.memory) {
    const memory = performance.memory;
    const formatBytes = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    console.log(
      `[MemoryUsage] JS Heap: ${formatBytes(memory.usedJSHeapSize)} / ${formatBytes(memory.totalJSHeapSize)} (Limit: ${formatBytes(memory.jsHeapSizeLimit)})`
    );
  } else {
    console.warn('[MemoryUsage] performance.memory API not available in this browser.');
  }
}

// --- 5. Lazy Loading and Progressive Enhancement (Concepts/Stubs) ---

/**
 * Lazy loads an image when it enters the viewport.
 * @param {HTMLImageElement} imgElement - The image element with a `data-src` attribute.
 */
export function lazyLoadImage(imgElement) {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const lazyImage = entry.target;
        if (lazyImage.dataset.src) {
          lazyImage.src = lazyImage.dataset.src;
        }
        // Optional: add a class when loaded, remove data-src
        // lazyImage.classList.add('loaded');
        // lazyImage.removeAttribute('data-src');
        obs.unobserve(lazyImage);
      }
    });
  }, { rootMargin: '0px 0px 200px 0px' }); // Trigger 200px before it's in viewport

  observer.observe(imgElement);
}

/**
 * Example of progressively enhancing a component.
 * This is more of a pattern than a specific utility.
 * Load basic HTML, then enhance with JS.
 */
export function progressiveEnhanceComponent(containerSelector, enhancementFn) {
  const container = document.querySelector(containerSelector);
  if (container && !container.dataset.enhanced) {
    enhancementFn(container);
    container.dataset.enhanced = 'true';
  }
}

// --- 6. JSON Parsing Optimization ---

/**
 * Parses JSON, potentially using a reviver for large objects or async methods if available.
 * For now, it's a wrapper around `JSON.parse` with error handling.
 * Browsers are already highly optimized for JSON.parse.
 * True async parsing would require a Web Worker or a library.
 * @param {string} jsonString - The JSON string to parse.
 * @param {Function} [reviver] - Optional reviver function for `JSON.parse`.
 * @returns {Promise<any>} Parsed JSON object or null if parsing fails.
 */
export async function optimizedJsonParse(jsonString, reviver) {
  try {
    // In future, could use:
    // if (typeof Response !== 'undefined' && new Response(jsonString).json) {
    //   return await new Response(jsonString).json(); // Uses browser's optimized stream parsing
    // }
    return JSON.parse(jsonString, reviver);
  } catch (error) {
    console.error('[OptimizedJsonParse] Failed to parse JSON:', error, { stringSnippet: jsonString.substring(0, 100) });
    throw error; // Re-throw to allow caller to handle
  }
}

// --- 7. DOM Optimization Utilities ---

/**
 * Batches DOM read operations, then write operations, using requestAnimationFrame.
 * Helps prevent layout thrashing.
 * @param {Function} readFn - A function that performs DOM reads and returns data.
 * @param {Function} writeFn - A function that performs DOM writes using data from readFn.
 */
export function batchDomReadWrite(readFn, writeFn) {
  requestAnimationFrame(() => {
    const data = readFn();
    requestAnimationFrame(() => {
      writeFn(data);
    });
  });
}

/**
 * A simple utility to update DOM content more efficiently by diffing.
 * This is a very basic example. For complex diffing, use a library like Preact/React or a dedicated DOM diffing lib.
 * @param {HTMLElement} element - The DOM element to update.
 * @param {string} newContentHtml - The new HTML string for the content.
 */
export function updateElementContentIfChanged(element, newContentHtml) {
  if (element.innerHTML !== newContentHtml) {
    element.innerHTML = newContentHtml;
  }
}

/**
 * Debounces a function using requestAnimationFrame.
 * Useful for frequent events like resize or scroll that trigger DOM updates.
 * @param {Function} fn - The function to call.
 * @returns {Function} A debounced version of the function.
 */
export function rafDebounce(fn) {
    let rafId = null;
    return (...args) => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }
        rafId = requestAnimationFrame(() => {
            fn(...args);
            rafId = null;
        });
    };
}

console.log('[PerformanceOptimizer] Module loaded.');
