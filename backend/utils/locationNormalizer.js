// backend/utils/locationNormalizer.js
// ✅ Fixes location inconsistencies (OBOB vs OB/OB, Brass vs Brass Terminal)

/**
 * Location normalization mapping
 * Maps all variations to a single canonical name
 */
const LOCATION_MAP = {
    // OBOB variations
    'obob': 'OBOB',
    'ob/ob': 'OBOB',
    'ob-ob': 'OBOB',
    'ob ob': 'OBOB',
    'o.b.o.b': 'OBOB',
    
    // Brass variations
    'brass': 'BRASS TERMINAL',
    'brass terminal': 'BRASS TERMINAL',
    'brass-terminal': 'BRASS TERMINAL',
    'brass term': 'BRASS TERMINAL',
    'brass trml': 'BRASS TERMINAL',
    
    // Kwale variations
    'kwale': 'KWALE',
    'kwa-le': 'KWALE',
    
    // Irri variations (merge IRRI F/S with IRRI)
    'irri': 'IRRI',
    'ir-ri': 'IRRI',
    'irri fs': 'IRRI',
    'irri f/s': 'IRRI',
    'irri f s': 'IRRI',
    
    // Oshie variations (merge OSHIE F/S with OSHIE)
    'oshie': 'OSHIE',
    'o-shie': 'OSHIE',
    'oshie fs': 'OSHIE',
    'oshie f/s': 'OSHIE',
    'oshie f s': 'OSHIE',
    'oshies fs': 'OSHIE',
    'oshies f/s': 'OSHIE',
    
    // Ebocha variations
    'ebocha': 'EBOCHA',
    'e-bocha': 'EBOCHA',
    
    // Idu variations (merge IDU F/S with IDU)
    'idu': 'IDU',
    'i-du': 'IDU',
    'idu fs': 'IDU',
    'idu f/s': 'IDU',
    'idu f s': 'IDU',
    'idu fs': 'IDU',
    
    // Akri variations
    'akri': 'AKRI',
    'a-kri': 'AKRI',

    // Ogboinbiri variations
    'ogboinbiri': 'OGBOINBIRI',
    'ogboin-biri': 'OGBOINBIRI',
    'ogboin biri': 'OGBOINBIRI',
    'ogboinbiri': 'OGBOINBIRI',
    'ogbainbiri': 'OGBOINBIRI',
    'OGBOINBIRI GAS PLANT': 'OGBOINBIRI',
    
    // Obama variations
    'obama': 'OBAMA',
    'o-bama': 'OBAMA',
    
    // Clough Creek variations
    'clough creek': 'CLOUGH CREEK',
    'clough-creek': 'CLOUGH CREEK',
    'cloughcreek': 'CLOUGH CREEK',
    'clough': 'CLOUGH CREEK',
    
    // PHC variations
    'phc': 'PHC',
    'p.h.c': 'PHC',
    'port harcourt': 'PHC',
    'portharcourt': 'PHC',
    'ph': 'PHC',
    
    // Samabri variations (changed from SAMABIRI to SAMABRI)
    'samabiri': 'SAMABRI',
    'samabri': 'SAMABRI',
    'sama-biri': 'SAMABRI',
    'sama biri': 'SAMABRI',
    'sama-bri': 'SAMABRI',
    'sama bri': 'SAMABRI',
    
    // Tebidaba variations (merge TEBIDABA F/S with TEBIDABA)
    'tebidaba': 'TEBIDABA',
    'tebi-daba': 'TEBIDABA',
    'tebi daba': 'TEBIDABA',
    'tebidaba fs': 'TEBIDABA',
    'tebidaba f/s': 'TEBIDABA',
    'tebidaba f s': 'TEBIDABA',
    
    // Obama variations (merge OBAMA F/S with OBAMA)
    'obama fs': 'OBAMA',
    'obama f/s': 'OBAMA',
    'obama f s': 'OBAMA',
    
    // Ogbainbiri variations (merge OGBOINBIRI variations)
    'ogbainbiri': 'OGBOINBIRI',
    'ogboibiri': 'OGBOINBIRI',
    
    // EOC variations
    'eoc': 'EOC',
    'eoc/idu': 'IDU',
    'eoc idu': 'IDU',
    
    // Other variations from the image
    'ex-abb camp res': 'EX-ABB CAMP RES',
    'ex abb camp res': 'EX-ABB CAMP RES',
    'tuomo': 'TUOMO',
    'kgp': 'KGP',
    'lar': 'LAR',
    'obob eoc': 'OBOB',
    'obob-eoc': 'OBOB',
    'obob/eoc': 'OBOB',
    'obob eoc kgp': 'OBOB',
    'obob-eoc-kgp': 'OBOB',
    'obob/eoc/kgp': 'OBOB',
    'brass and ogb': 'BRASS TERMINAL'
  };
  
  /**
   * Normalize a location name
   * @param {string} location - Raw location name
   * @returns {string} - Normalized location name
   */
  function normalizeLocation(location) {
    if (!location) return '';
    
    const cleaned = location.trim().toLowerCase();
    
    // Check if we have a mapping for this
    if (LOCATION_MAP[cleaned]) {
      return LOCATION_MAP[cleaned];
    }
    
    // If no mapping found, return uppercase version
    return location.trim().toUpperCase();
  }
  
  /**
   * Normalize all locations in a request object
   * @param {Object} request - Request object with location/asset field
   * @returns {Object} - Request with normalized location
   */
  function normalizeRequestLocation(request) {
    if (request.asset) {
      request.asset = normalizeLocation(request.asset);
    }
    if (request.location) {
      request.location = normalizeLocation(request.location);
    }
    return request;
  }
  
  /**
   * SQL query to fix all existing locations in database
   * Run this ONCE to clean up existing data
   */
  function getLocationFixSQL() {
    const updates = [];
    
    Object.entries(LOCATION_MAP).forEach(([wrong, correct]) => {
      updates.push(`
        UPDATE material_requests 
        SET asset = '${correct}' 
        WHERE LOWER(TRIM(asset)) = '${wrong}';
      `);
    });
    
    return updates.join('\n');
  }

  // ✅ ADD this function at the end
function normalizeForAnalytics(location) {
    if (!location) return null;
    const normalized = normalizeLocation(location);
    // ✅ Force OBOB consistency for analytics
    if (normalized === 'OB/OB') return 'OBOB';
    return normalized;
  }
  
  
  module.exports = {
    normalizeLocation,
    normalizeRequestLocation,
    getLocationFixSQL,
    LOCATION_MAP,
    normalizeForAnalytics
  };