// backend/utils/requestNumber.js
// Generates MRF numbers in three different formats:
// LAR: LAR-MTCE-001-2025 (Land Area)
// SAR: SAR-001-2025 (Swamp Area)
// PHC: PHC-001-2025 (PHC POD)

const { query } = require('../config/database');

/**
 * GENERATE MRF NUMBER
 * Three different formats based on area:
 * - Land Area (LAR): LAR-MTCE-001-2025
 * - Swamp Area (SAR): SAR-001-2025  
 * - PHC POD (PHC): PHC-001-2025
 * 
 * Numbers continue from last number in that area
 */
async function generateRequestNumber(siteCode) {
  const year = new Date().getFullYear();
  
  try {
    let pattern, format;
    
    // Determine format based on site code
    if (siteCode === 'LAR') {
      // Land Area: LAR-MTCE-001-2025
      pattern = `LAR-MTCE-%-${year}`;
      format = 'LAR-MTCE-XXX-YYYY';
    } else if (siteCode === 'SAR') {
      // Swamp Area: SAR-001-2025
      pattern = `SAR-%-${year}`;
      format = 'SAR-XXX-YYYY';
    } else if (siteCode === 'PHC') {
      // PHC POD: PHC-001-2025
      pattern = `PHC-%-${year}`;
      format = 'PHC-XXX-YYYY';
    } else {
      // Default to LAR format for unknown codes
      pattern = `LAR-MTCE-%-${year}`;
      format = 'LAR-MTCE-XXX-YYYY';
    }
    
    // Get the next sequence number for this area
    const result = await query(
      `SELECT mrf_number FROM material_requests 
       WHERE mrf_number LIKE $1 
       ORDER BY mrf_number DESC 
       LIMIT 1`,
      [pattern.replace('%', '%')]
    );
    
    let nextSeq = 1;
    
    if (result.rows.length > 0) {
      const lastNumber = result.rows[0].mrf_number;
      
      // Extract sequence number from last MRF number
      let seqStr;
      if (siteCode === 'LAR') {
        // LAR-MTCE-001-2025 → extract 001
        const parts = lastNumber.split('-');
        seqStr = parts[2]; // Gets "001"
      } else {
        // SAR-001-2025 or PHC-001-2025 → extract 001
        const parts = lastNumber.split('-');
        seqStr = parts[1]; // Gets "001"
      }
      
      nextSeq = parseInt(seqStr) + 1;
    }
    
    const buildNumber = (seq) => {
      const seqFormatted = String(seq).padStart(3, '0');
      if (siteCode === 'LAR') {
        return `LAR-MTCE-${seqFormatted}-${year}`;
      }
      if (siteCode === 'SAR') {
        return `SAR-${seqFormatted}-${year}`;
      }
      if (siteCode === 'PHC') {
        return `PHC-${seqFormatted}-${year}`;
      }
      return `LAR-MTCE-${seqFormatted}-${year}`;
    };
    
    // Ensure uniqueness by checking the database before returning
    let attempts = 0;
    while (attempts < 10) {
      const candidate = buildNumber(nextSeq);
      const exists = await query(
        'SELECT 1 FROM material_requests WHERE mrf_number = $1 LIMIT 1',
        [candidate]
      );
      
      if (exists.rowCount === 0) {
        console.log(`✅ Generated MRF Number: ${candidate} (Format: ${format})`);
        return candidate;
      }
      
      nextSeq++;
      attempts++;
    }
    
    throw new Error('Unable to generate a unique MRF number after multiple attempts');
    
  } catch (error) {
    console.error('❌ Generate MRF number error:', error);
    throw error;
  }
}

module.exports = { generateRequestNumber };