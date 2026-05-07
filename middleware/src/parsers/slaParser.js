'use strict';
/**
 * slaParser.js — parser: "Support Availability" text → ServiceSla
 *
 * Logic:
 *  - Creates a service-level SLA record (flavour_id = null)
 *  - Extracts availability_pct (highest found %), restoration_hours (lowest "N hours"),
 *               delivery_days (min "N working days"), support_window_code
 *  - Conservative: creates a record only when at least one numeric SLA value exists
 *  - Per-flavour SLA (WPS002-1: 99.0%, WPS002-2: 99.9%) is retained in sla_note_raw
 */

function parseSla(serviceId, raw) {
  if (!raw || !raw.trim()) return null;

  // ── Availability % ──────────────────────────────────────────────────────────
  // Use the highest guaranteed value; it is usually the first/default value, not the worst case.
  const availMatches = [...raw.matchAll(/(\d+\.?\d*)\s*%/g)]
    .map(m => parseFloat(m[1]))
    .filter(n => !isNaN(n) && n > 0 && n <= 100);
  const availabilityPct = availMatches.length > 0 ? Math.max(...availMatches) : null;

  // ── Restoration hours ───────────────────────────────────────────────────────
  // Skip lines containing "24x7" or "24/7"; they describe the support window.
  const restorationNums = [];
  for (const line of raw.split(/\r?\n/)) {
    if (/24\s*[x/]\s*7/i.test(line)) continue;
    for (const m of line.matchAll(/(\d+)\s+hours?/gi)) {
      const n = parseInt(m[1]);
      if (!isNaN(n) && n > 0 && n <= 8760) restorationNums.push(n);
    }
  }
  const restorationHours = restorationNums.length > 0 ? Math.min(...restorationNums) : null;

  // ── Delivery days ───────────────────────────────────────────────────────────
  const deliveryNums = [];
  for (const m of raw.matchAll(/(\d+)\s+(?:working\s+)?days?/gi)) {
    const n = parseInt(m[1]);
    if (!isNaN(n) && n > 0 && n <= 365) deliveryNums.push(n);
  }
  const deliveryDays = deliveryNums.length > 0 ? Math.min(...deliveryNums) : null;

  // No numeric SLA value means there is nothing reliable to parse.
  if (availabilityPct == null && restorationHours == null && deliveryDays == null) return null;

  // ── Support window ──────────────────────────────────────────────────────────
  let supportWindowCode = 'business_hours';
  if (/24\s*[x/]\s*7|round[- ]?the[- ]?clock|continuous.*support|always.*available/i.test(raw)) {
    supportWindowCode = '24x7';
  } else if (/best.?effort|no.*sla|no.*guarantee/i.test(raw)) {
    supportWindowCode = 'best_effort';
  }

  return {
    serviceId,
    flavourId:         null,    // service-level SLA
    availabilityPct,
    restorationHours,
    deliveryDays,
    supportWindowCode,
    slaNoteRaw:        raw.substring(0, 4000),
    sourceField:       'Support Availability',
  };
}

module.exports = { parseSla };
