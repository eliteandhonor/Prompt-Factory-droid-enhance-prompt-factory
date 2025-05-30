/**
 * js/util/searchEngine.js
 * Powerful client-side search engine for prompts.
 * Features: Full-text search, ranking, highlighting, advanced filtering,
 * result caching, fuzzy matching, and stubs for analytics/saved searches.
 */

// --- Configuration ---
const SCORE_THRESHOLD = 0.1; // Minimum score for a prompt to be included in search results
const FUZZY_MATCH_THRESHOLD = 2; // Max Levenshtein distance for a fuzzy match (lower is stricter)
const CACHE_MAX_SIZE = 100;    // Max number of search results to cache

// --- Cache ---
const searchCache = new Map();

// --- Helper Functions ---

/**
 * Normalizes and tokenizes text into an array of words.
 * Converts to lowercase, removes punctuation, and splits by whitespace.
 * @param {string} text - The input text.
 * @returns {string[]} Array of normalized words.
 */
function tokenizeAndNormalize(text) {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation (keeps alphanumeric and whitespace)
    .split(/\s+/)           // Split by one or more whitespace characters
    .filter(Boolean);         // Remove any empty strings resulting from multiple spaces
}

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy matching.
 * @param {string} s1 - First string.
 * @param {string} s2 - Second string.
 * @returns {number} The Levenshtein distance.
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1) return s2 ? s2.length : 0;
  if (!s2) return s1.length;

  const s1Len = s1.length;
  const s2Len = s2.length;
  const track = Array(s2Len + 1).fill(null).map(() => Array(s1Len + 1).fill(null));

  for (let i = 0; i <= s1Len; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2Len; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2Len; j += 1) {
    for (let i = 1; i <= s1Len; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,        // Deletion
        track[j - 1][i] + 1,        // Insertion
        track[j - 1][i - 1] + indicator, // Substitution
      );
    }
  }
  return track[s2Len][s1Len];
}

/**
 * Checks if a search term matches a token in the text, possibly with fuzzy matching.
 * @param {string} term - The normalized search term.
 * @param {string[]} textTokens - Array of normalized tokens from the text field.
 * @param {boolean} fuzzy - Whether to enable fuzzy matching.
 * @param {number} fuzzyThreshold - Max Levenshtein distance for a fuzzy match.
 * @returns {boolean} True if the term matches, false otherwise.
 */
function termMatches(term, textTokens, fuzzy, fuzzyThreshold) {
  if (textTokens.includes(term)) {
    return true;
  }
  if (fuzzy) {
    for (const token of textTokens) {
      if (levenshteinDistance(term, token) <= fuzzyThreshold) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Calculates a relevance score for a prompt based on the search query.
 * @param {object} prompt - The prompt object.
 * @param {string[]} queryTokens - Array of normalized search query tokens.
 * @param {boolean} fuzzy - Whether to enable fuzzy matching.
 * @returns {number} The relevance score.
 */
function calculateScore(prompt, queryTokens, fuzzy) {
  let score = 0;
  const matchedQueryTerms = new Set();

  const weights = {
    title: 10,
    description: 5,
    content: 3,
    tags: 7, // Assuming tags are relevant keywords
  };

  // Pre-tokenize prompt fields once
  const promptFieldTokens = {
    title: tokenizeAndNormalize(prompt.title),
    description: tokenizeAndNormalize(prompt.description),
    content: tokenizeAndNormalize(prompt.content),
    tags: Array.isArray(prompt.tags) ? tokenizeAndNormalize(prompt.tags.join(' ')) : [],
  };

  queryTokens.forEach(queryToken => {
    let termFoundInPromptThisIteration = false;
    if (prompt.title && termMatches(queryToken, promptFieldTokens.title, fuzzy, FUZZY_MATCH_THRESHOLD)) {
      score += weights.title;
      termFoundInPromptThisIteration = true;
    }
    if (prompt.description && termMatches(queryToken, promptFieldTokens.description, fuzzy, FUZZY_MATCH_THRESHOLD)) {
      score += weights.description;
      termFoundInPromptThisIteration = true;
    }
    if (prompt.content && termMatches(queryToken, promptFieldTokens.content, fuzzy, FUZZY_MATCH_THRESHOLD)) {
      score += weights.content;
      termFoundInPromptThisIteration = true;
    }
    if (prompt.tags && prompt.tags.length > 0 && termMatches(queryToken, promptFieldTokens.tags, fuzzy, FUZZY_MATCH_THRESHOLD)) {
      score += weights.tags;
      termFoundInPromptThisIteration = true;
    }

    if (termFoundInPromptThisIteration) {
        matchedQueryTerms.add(queryToken);
    }
  });

  // Bonus for matching more unique terms from the query
  score += matchedQueryTerms.size * 5;

  // Simple phrase matching bonus: if all query tokens appear in order in any single field's raw text
  const fullQueryString = queryTokens.join(' ');
  if (fullQueryString.length > 0) { // Only apply if there's a multi-word query
      const checkPhrase = (text) => text && text.toLowerCase().includes(fullQueryString);
      if (checkPhrase(prompt.title)) score += 20;
      else if (checkPhrase(prompt.description)) score += 15;
      else if (checkPhrase(prompt.content)) score += 10;
  }

  return score;
}

/**
 * Applies various filters to the list of prompts.
 * @param {object[]} prompts - Array of prompt objects.
 * @param {object} filters - Filter criteria.
 * @param {string} [filters.category] - Category ID to filter by.
 * @param {string[]} [filters.tags] - Array of tag IDs (prompt must have ALL specified tags).
 * @param {{startDate?: string, endDate?: string}} [filters.dateRange] - Date range for 'updated_at' or 'created_at'.
 * @returns {object[]} Filtered array of prompts.
 */
function applyFilters(prompts, filters) {
  let filteredPrompts = prompts;

  // Category filter
  if (filters.category && typeof filters.category === 'string') {
    filteredPrompts = filteredPrompts.filter(p => p.category === filters.category);
  }

  // Tags filter (AND logic - prompt must have all specified tags)
  if (filters.tags && Array.isArray(filters.tags) && filters.tags.length > 0) {
    filteredPrompts = filteredPrompts.filter(p => {
      if (!p.tags || !Array.isArray(p.tags)) return false;
      return filters.tags.every(filterTagId => p.tags.includes(filterTagId));
    });
  }

  // Date range filter
  if (filters.dateRange) {
    const { startDate, endDate } = filters.dateRange;
    // Ensure dates are valid before attempting to parse
    const start = startDate && !isNaN(new Date(startDate).getTime()) ? new Date(startDate) : null;
    const end = endDate && !isNaN(new Date(endDate).getTime()) ? new Date(endDate) : null;

    if (start || end) {
      filteredPrompts = filteredPrompts.filter(p => {
        // Prefer updated_at, fallback to created_at
        const promptDateStr = p.updated_at || p.created_at;
        if (!promptDateStr || isNaN(new Date(promptDateStr).getTime())) return false; // Skip if no valid date
        
        const promptDate = new Date(promptDateStr);
        if (start && promptDate < start) return false;
        // If end date is specified, make it inclusive of the whole day
        if (end) {
            const inclusiveEndDate = new Date(end);
            inclusiveEndDate.setHours(23, 59, 59, 999); // End of the day
            if (promptDate > inclusiveEndDate) return false;
        }
        return true;
      });
    }
  }
  return filteredPrompts;
}

// --- Main Search Function ---

/**
 * Searches, filters, and ranks prompts.
 * @param {object[]} allPrompts - The complete list of prompt objects to search within.
 * @param {string} searchQuery - The user's search query string.
 * @param {object} [options={}] - Search configuration options.
 * @param {object} [options.filters={}] - Filtering criteria.
 *   @param {string} [options.filters.category] - Category ID.
 *   @param {string[]} [options.filters.tags] - Array of tag IDs.
 *   @param {{startDate?: string, endDate?: string}} [options.filters.dateRange] - Date range.
 * @param {boolean} [options.fuzzy=false] - Enable fuzzy matching for search terms.
 * @param {boolean} [options.useCache=true] - Whether to use the search cache.
 * @returns {{results: object[], highlightTerms: string[]}} An object containing the search results and terms to highlight.
 */
export function search(allPrompts, searchQuery, options = {}) {
  const { filters = {}, fuzzy = false, useCache = true } = options;
  const normalizedQuery = (searchQuery || '').trim();
  const queryTokens = tokenizeAndNormalize(normalizedQuery);

  const cacheKey = useCache ? `${normalizedQuery}|${JSON.stringify(filters)}|fuzzy:${fuzzy}` : null;

  if (useCache && cacheKey && searchCache.has(cacheKey)) {
    const cachedResult = searchCache.get(cacheKey);
    logSearchQuery(normalizedQuery, filters, cachedResult.results.length, true); // Analytics stub
    return cachedResult;
  }

  let processedPrompts = [...allPrompts];

  // 1. Apply filters first
  if (Object.keys(filters).length > 0) {
    processedPrompts = applyFilters(processedPrompts, filters);
  }

  // 2. Perform search and scoring if a search query is provided
  if (queryTokens.length > 0) {
    processedPrompts = processedPrompts
      .map(prompt => {
        const score = calculateScore(prompt, queryTokens, fuzzy);
        return { ...prompt, _searchScore: score }; // Attach score temporarily
      })
      .filter(prompt => prompt._searchScore >= SCORE_THRESHOLD) // Filter by score threshold
      .sort((a, b) => b._searchScore - a._searchScore); // Sort by score descending
  } else {
    // If no search query, but filters might have been applied,
    // sort by most recently updated by default.
    processedPrompts.sort((a, b) =>
      new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
    );
  }

  const finalResults = {
    results: processedPrompts.map(({ _searchScore, ...prompt }) => prompt), // Remove temporary score
    highlightTerms: queryTokens, // Pass normalized query tokens for highlighting
  };

  // Update cache if enabled
  if (useCache && cacheKey) {
    if (searchCache.size >= CACHE_MAX_SIZE) {
      // Simple LRU: delete the first (oldest) key
      const oldestKey = searchCache.keys().next().value;
      searchCache.delete(oldestKey);
    }
    searchCache.set(cacheKey, finalResults);
  }

  logSearchQuery(normalizedQuery, filters, finalResults.results.length, false); // Analytics stub

  return finalResults;
}

// --- Highlighting Utility ---

/**
 * Wraps matching terms in a string with <mark> tags for highlighting.
 * This function is case-insensitive.
 * @param {string} text - The text in which to highlight terms.
 * @param {string[]} termsToHighlight - An array of normalized terms to highlight.
 * @returns {string} The text with specified terms highlighted.
 */
export function highlightMatches(text, termsToHighlight) {
  if (!text || typeof text !== 'string' || !termsToHighlight || termsToHighlight.length === 0) {
    return text;
  }

  // Escape special regex characters in each term and join with OR operator
  const escapedTerms = termsToHighlight.map(term =>
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
  );

  if (escapedTerms.length === 0) return text;

  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}


// --- Analytics and Saved Searches Stubs ---

/**
 * Logs search activity (STUB - for demonstration).
 * In a real application, this would send data to an analytics backend.
 * @param {string} query - The search query.
 * @param {object} filters - Applied filters.
 * @param {number} resultCount - Number of results found.
 * @param {boolean} fromCache - Whether the result was served from cache.
 */
export function logSearchQuery(query, filters, resultCount, fromCache) {
  console.info('[Search Analytics STUB]:', {
    timestamp: new Date().toISOString(),
    query,
    filters: JSON.parse(JSON.stringify(filters)), // Deep copy for logging
    resultCount,
    fromCache,
  });
}

/**
 * Saves a search query and filters (STUB - for demonstration).
 * In a real application, this would persist to localStorage or a backend.
 * @param {string} name - A user-defined name for the saved search.
 * @param {string} query - The search query.
 * @param {object} filters - Applied filters.
 * @returns {Promise<object>} A promise resolving with the saved search object.
 */
export async function saveSearch(name, query, filters) {
  const savedSearch = { name, query, filters, savedAt: new Date().toISOString() };
  console.info('[Save Search STUB]:', savedSearch);
  // Example: localStorage.setItem(`savedSearch_${name}`, JSON.stringify(savedSearch));
  return savedSearch;
}

/**
 * Loads saved searches (STUB - for demonstration).
 * In a real application, this would load from localStorage or a backend.
 * @returns {Promise<object[]>} A promise resolving with an array of saved search objects.
 */
export async function loadSavedSearches() {
  console.info('[Load Saved Searches STUB]');
  const searches = [];
  // Example:
  // for (let i = 0; i < localStorage.length; i++) {
  //   const key = localStorage.key(i);
  //   if (key && key.startsWith('savedSearch_')) {
  //     searches.push(JSON.parse(localStorage.getItem(key)));
  //   }
  // }
  return searches;
}

/**
 * Clears the entire search cache.
 */
export function clearSearchCache() {
  searchCache.clear();
  console.info('Search cache cleared.');
}
