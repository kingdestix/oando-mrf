// backend/utils/fuzzySearch.js
// ✅ Fuzzy search for materials (handles misspellings)

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(a, b) {
    const matrix = [];
  
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
  
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
  
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
  
    return matrix[b.length][a.length];
  }
  
  /**
   * Calculate similarity percentage between two strings
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} - Similarity percentage (0-100)
   */
  function similarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 100.0;
    
    const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return ((longer.length - distance) / longer.length) * 100;
  }
  
  /**
   * Build fuzzy search SQL WHERE clause
   * @param {string} searchTerm - User's search query
   * @param {number} threshold - Minimum similarity percentage (default: 70)
   * @returns {string} - SQL WHERE clause
   */
  function buildFuzzySearchSQL(searchTerm, threshold = 70) {
    const term = searchTerm.toLowerCase().trim();
    
    // Split into words for better matching
    const words = term.split(/\s+/);
    
    // Build conditions:
    // 1. Exact match (highest priority)
    // 2. Contains all words (medium priority)
    // 3. Fuzzy match using similarity (lowest priority)
    
    const conditions = [
      // Exact match
      `LOWER(l.material_description) = '${term}'`,
      
      // Contains search term
      `LOWER(l.material_description) LIKE '%${term}%'`,
      
      // Contains all words (any order)
      ...words.map(word => `LOWER(l.material_description) LIKE '%${word}%'`).join(' OR '),
      
      // Part number or OEM model exact match
      `LOWER(l.part_number) = '${term}'`,
      `LOWER(l.oem_model) = '${term}'`,
      
      // Fuzzy: similar words (using PostgreSQL similarity if available)
      `similarity(LOWER(l.material_description), '${term}') > ${threshold / 100}`
    ];
    
    return `(${conditions.join(' OR ')})`;
  }
  
  /**
   * Post-process search results to rank by relevance
   * @param {Array} results - Search results from database
   * @param {string} searchTerm - Original search query
   * @returns {Array} - Ranked results
   */
  function rankSearchResults(results, searchTerm) {
    return results.map(result => {
      const description = result.material_description || '';
      const score = similarity(description.toLowerCase(), searchTerm.toLowerCase());
      
      return {
        ...result,
        relevance_score: score
      };
    }).sort((a, b) => b.relevance_score - a.relevance_score);
  }
  
  module.exports = {
    levenshteinDistance,
    similarity,
    buildFuzzySearchSQL,
    rankSearchResults
  };