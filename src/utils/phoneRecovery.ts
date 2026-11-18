import type { Customer } from '../types/index.ts';

/**
 * Result of analyzing a potentially fused Vietnamese phone string.
 */
export interface FusedPhoneAnalysis {
  isFused: boolean;
  status: 'not_fused' | 'ok' | 'ambiguous' | 'invalid';
  phones: string[];
  rawDigits: string;
}

/**
 * Find all valid segmentations of a Vietnamese digit string into:
 * - Mobile numbers: 0[35789] + 8 digits (10 digits total)
 * - Landline numbers: 02 + 9 digits (11 digits total)
 *
 * Uses memoized recursion with an early cutoff once > 1 distinct segmentation is found.
 */
function findPhoneSegmentations(digits: string): string[][] {
  if (!digits || !/^\d+$/.test(digits) || digits.length > 60) {
    return [];
  }

  const memo = new Map<number, string[][]>();

  function solve(pos: number): string[][] {
    if (pos === digits.length) return [[]];
    const cached = memo.get(pos);
    if (cached !== undefined) return cached;

    const results: string[][] = [];
    const rest = digits.slice(pos);

    if (rest.length >= 10 && /^0[35789]\d{8}/.test(rest)) {
      const head = rest.slice(0, 10);
      for (const tail of solve(pos + 10)) {
        results.push([head, ...tail]);
        if (results.length > 1) {
          memo.set(pos, results);
          return results;
        }
      }
    }

    if (rest.length >= 11 && /^02\d{9}/.test(rest)) {
      const head = rest.slice(0, 11);
      for (const tail of solve(pos + 11)) {
        results.push([head, ...tail]);
        if (results.length > 1) {
          memo.set(pos, results);
          return results;
        }
      }
    }

    memo.set(pos, results);
    return results;
  }

  return solve(0);
}

/**
 * Deterministically split a fused Vietnamese phone digit string (e.g. 20, 21, 30+ digits).
 * Returns deduplicated phone numbers ONLY when exactly ONE valid segmentation exists.
 * Ambiguous, invalid, or single-number (<= 11 digits) strings return null.
 */
export function segmentFusedPhone(raw: string): string[] | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;

  // Handle fused international prefix if a single leading 84 was stripped improperly
  if (digits.startsWith('84') && digits.length >= 11 && digits[2] !== '0') {
    const candidate = '0' + digits.slice(2);
    if (candidate.length > 11) {
      digits = candidate;
    }
  }

  if (digits.length <= 11) return null;

  const segmentations = findPhoneSegmentations(digits);
  if (segmentations.length !== 1 || segmentations[0].length < 2) {
    return null;
  }

  const unique: string[] = [];
  for (const phone of segmentations[0]) {
    if (!unique.includes(phone)) {
      unique.push(phone);
    }
  }
  return unique;
}

/**
 * Analyze a phone string for UI diagnostics (Sentinel tab).
 */
export function analyzeFusedPhone(raw: string): FusedPhoneAnalysis {
  let rawDigits = String(raw || '').replace(/\D/g, '');
  if (rawDigits.startsWith('84') && rawDigits.length >= 11 && rawDigits[2] !== '0') {
    const candidate = '0' + rawDigits.slice(2);
    if (candidate.length > 11) {
      rawDigits = candidate;
    }
  }
  if (rawDigits.length <= 11) {
    return {
      isFused: false,
      status: 'not_fused',
      phones: rawDigits ? [rawDigits] : [],
      rawDigits,
    };
  }

  // If input already contains explicit delimiters, split on them first
  if (/[\/,;\n\r|]/.test(raw)) {
    return {
      isFused: false,
      status: 'not_fused',
      phones: [],
      rawDigits,
    };
  }

  const segmentations = findPhoneSegmentations(rawDigits);
  if (segmentations.length === 1 && segmentations[0].length >= 2) {
    const unique: string[] = [];
    for (const p of segmentations[0]) {
      if (!unique.includes(p)) unique.push(p);
    }
    return {
      isFused: true,
      status: 'ok',
      phones: unique,
      rawDigits,
    };
  }

  return {
    isFused: true,
    status: segmentations.length > 1 ? 'ambiguous' : 'invalid',
    phones: [],
    rawDigits,
  };
}

/**
 * Extract clean individual phones from a single field that may contain delimiters or fused digits.
 */
function extractCleanPhonesFromField(rawField: string): {
  phones: string[];
  hadUnresolvableFused: boolean;
} {
  if (!rawField || !rawField.trim()) {
    return { phones: [], hadUnresolvableFused: false };
  }

  const parts = rawField
    .split(/[\/,;\n\r|]|\s+-\s+/)
    .map(p => p.trim())
    .filter(Boolean);

  const collected: string[] = [];
  let hadUnresolvableFused = false;

  for (const part of parts) {
    let digits = part.replace(/[^0-9+]/g, '');
    if (!digits || /^0+$/.test(digits)) continue;
    if (digits.startsWith('+84')) digits = '0' + digits.slice(3);
    else if (digits.startsWith('84') && digits.length >= 10) digits = '0' + digits.slice(2);
    if (digits.length === 9 && !digits.startsWith('0')) digits = '0' + digits;

    if (digits.length > 11) {
      const seg = segmentFusedPhone(digits);
      if (seg && seg.length > 0) {
        for (const p of seg) {
          if (!collected.includes(p)) collected.push(p);
        }
      } else {
        hadUnresolvableFused = true;
        if (!collected.includes(digits)) collected.push(digits);
      }
    } else if (digits) {
      if (!collected.includes(digits)) collected.push(digits);
    }
  }

  return { phones: collected, hadUnresolvableFused };
}

/**
 * Repair fused or delimited phones on a single Customer record into clean `phone` + `phone2`.
 * - If 1 unique number remains (e.g. duplicated 20-digit string), clears redundant duplicate.
 * - If 2 numbers exist, stores [0] in `phone` and [1] in `phone2`.
 * - If 3+ numbers exist, stores [0] in `phone` and [1..] joined with " / " in `phone2`.
 * - Leaves unresolvable/ambiguous digit strings untouched.
 */
export function repairCustomerFusedPhones(
  customer: Customer,
  timestamp = new Date().toISOString()
): { customer: Customer; changed: boolean; log?: string } {
  const p1Res = extractCleanPhonesFromField(customer.phone || '');
  const p2Res = extractCleanPhonesFromField(customer.phone2 || '');

  // Never alter unresolvable fused strings (no guessing)
  if (p1Res.hadUnresolvableFused || p2Res.hadUnresolvableFused) {
    return { customer, changed: false };
  }

  const allUnique: string[] = [];
  for (const p of [...p1Res.phones, ...p2Res.phones]) {
    if (p && !allUnique.includes(p)) {
      allUnique.push(p);
    }
  }

  const nextPhone = allUnique[0] || '';
  const nextPhone2 = allUnique.length > 1 ? allUnique.slice(1).join(' / ') : undefined;

  const currentPhone = (customer.phone || '').trim();
  const currentPhone2 = customer.phone2 ? customer.phone2.trim() : undefined;

  if (nextPhone === currentPhone && nextPhone2 === currentPhone2) {
    return { customer, changed: false };
  }

  // Only trigger if the existing record actually had fused/delimited/duplicate phones or messy formatting
  const updated: Customer = {
    ...customer,
    phone: nextPhone,
    phone2: nextPhone2,
    updatedAt: timestamp,
  };

  const beforeDisplay = [currentPhone, currentPhone2].filter(Boolean).join(' | ');
  const afterDisplay = [nextPhone, nextPhone2].filter(Boolean).join(' / ');
  return {
    customer: updated,
    changed: true,
    log: `Phục hồi SĐT cho "${customer.name}": ${beforeDisplay} -> ${afterDisplay}`,
  };
}

/**
 * Run fused-phone repair across a customer list and return both the full updated list
 * and only the customers that actually changed (for targeted Cloud batch sync).
 */
export function repairFusedPhonesBatch(
  customers: Customer[],
  timestamp = new Date().toISOString()
): {
  customers: Customer[];
  changedCustomers: Customer[];
  log: string[];
} {
  const nextCustomers: Customer[] = [];
  const changedCustomers: Customer[] = [];
  const log: string[] = [];

  for (const c of customers) {
    const res = repairCustomerFusedPhones(c, timestamp);
    nextCustomers.push(res.customer);
    if (res.changed) {
      changedCustomers.push(res.customer);
      if (res.log) log.push(res.log);
    }
  }

  return {
    customers: nextCustomers,
    changedCustomers,
    log,
  };
}
