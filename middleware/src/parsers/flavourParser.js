'use strict';
/**
 * flavourParser.js — parser: "Service Cost" + "Additional Information" → ServiceFlavour
 *
 * Logic:
 *  1. Finds flavour codes in the {SERVICE_ID}-{number}{optional_suffix} format (for example WPS002-1, WPS002-1A)
 *  2. Tries to extract title, serviceUnit, and priceValue for each code
 *  3. Conservative: creates a flavour even without a price (code + title only)
 *  4. Does not replace structured item.flavours[]; it is called only when that array is missing
 */

/** Regex for a flavour code derived from a concrete service_id. */
function _flavourCodeRe(serviceId) {
  const esc = serviceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b(${esc}-\\d+[A-Za-z]?)\\b`, 'g');
}

/** Parses a price from a text fragment and returns a number or null. */
function _parsePrice(s) {
  if (!s) return null;
  // Remove invisible characters (U+200B, BOM, NBSP).
  const clean = s.replace(/[\u200B\uFEFF\u00A0]+/g, '').trim();
  // Number with optional dot/comma thousands separator and no leading currency symbol.
  const m = clean.match(/^[\s|]*([\d,]+(?:\.\d+)?)\s*(?:EUR|€)?\s*[\s*]*$/);
  if (!m) return null;
  const num = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(num) ? null : num;
}

/** Finds the "Per X" unit in text. */
function _parseUnit(s) {
  if (!s) return null;
  const m = s.match(/\bper\s+[\w\s]{1,50}/i);
  return m ? m[0].replace(/[.,*]+$/, '').trim().substring(0, 100) : null;
}

/**
 * Main parser.
 *
 * @param {string}      serviceId  — business key used to derive flavour codes
 * @param {string|null} costRaw    — raw "Service Cost" field
 * @param {string|null} addlRaw    — raw "Additional Information" field
 * @returns {Array}                — objects for importRepo.upsertFlavour()
 */
function parseFlavours(serviceId, costRaw, addlRaw) {
  if (!serviceId || (!costRaw && !addlRaw)) return [];

  const re = _flavourCodeRe(serviceId);
  const allText = [costRaw, addlRaw].filter(Boolean).join('\n');

  // Collect unique codes from the full text.
  const codes = new Set();
  let m;
  while ((m = re.exec(allText)) !== null) codes.add(m[1]);
  re.lastIndex = 0;

  if (codes.size === 0) return [];

  const results = [];
  let displayOrder = 0;

  for (const code of [...codes].sort()) {
    const codeEsc = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const codeRe  = new RegExp(`${codeEsc}[*]?\\s*(.*)`, 'i');
    let title = null, serviceUnit = null, priceValue = null;

    outer:
    for (const text of [costRaw, addlRaw]) {
      if (!text) continue;
      for (const line of text.split(/\r?\n/)) {
        if (!line.includes(code)) continue;
        const lm = codeRe.exec(line);
        if (!lm) continue;

        const rest = lm[1].trim();

        if (rest.includes('|')) {
          // Table format: code | title | unit | price.
          const parts = rest
            .split('|')
            .map(p => p.replace(/[\u200B\uFEFF\u00A0]+/g, '').trim())
            .filter(Boolean);

          if (parts.length >= 1 && !title) {
            title = parts[0]
              .replace(/^[:\s]+/, '')    // strip leading ":" (for example "WPS002-3: Data...")
              .replace(/^\/\s*/, '')     // strip leading "/"
              .replace(/[/*:]+$/, '')    // strip trailing junk
              .trim() || null;
          }
          for (const part of parts) {
            if (!serviceUnit) serviceUnit = _parseUnit(part);
            if (priceValue == null) priceValue = _parsePrice(part);
          }
        } else {
          // Text / bullet format: "1.WPS002-1 User Account: Per account".
          const colonParts = rest.split(':');
          if (!title) {
            title = colonParts[0]
              .replace(/^\d+[.)]\s*/, '')  // remove "1." / "1)"
              .replace(/[/*:]+$/, '')
              .trim() || null;
          }
          for (const seg of colonParts) {
            if (!serviceUnit) serviceUnit = _parseUnit(seg);
          }
        }

        break outer;
      }
    }

    results.push({
      serviceId,
      flavourCode:       code,
      title:             (title || code).substring(0, 255),
      serviceUnit:       serviceUnit ?? null,
      priceValue:        priceValue ?? null,
      currencyCode:      'EUR',
      billingPeriodCode: 'annual',
      flavourStatusCode: 'active',
      isOrderable:       1,
      displayOrder:      displayOrder++,
      pricingNoteRaw:    costRaw ? costRaw.substring(0, 4000) : null,
    });
  }

  return results;
}

module.exports = { parseFlavours };
