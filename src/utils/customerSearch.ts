import type { Customer } from '../types/index.ts';
import { removeVietnameseTones } from './vietnamese.ts';
import { normalizeSinglePhone, normalizeVietnamesePhone, isPhoneMatching } from './excel.ts';

export interface ScoreCustomerOptions {
  selectedCustomerId?: string;
}

export interface FilterCustomersOptions extends ScoreCustomerOptions {
  filterOnlyDebt?: boolean;
}

/**
 * Score a customer against a search query using Diacritic-Aware & Phone-First ranking (ADR-0016).
 *
 * Ranking Hierarchy:
 * Tier 1 (300 pts): Exact Phone Match (numeric digits).
 * Tier 2 (250 pts): Phone Prefix Match (numeric digits >= 3).
 * Tier 3 (220 pts): Phone Substring Match (numeric digits >= 3).
 * Tier 4 (200 pts): Exact Case-Insensitive Full Name Match WITH DIACRITICS.
 * Tier 5 (150 pts): Tone-Clean Full Name Match (fallback without diacritics).
 * Tier 6 (130 pts): Exact Diacritic Word/Prefix Match.
 * Tier 7 (100 pts): Tone-Clean Word/Prefix Match.
 * Tier 8 (90 pts):  Multi-token Match in Name.
 * Tier 9 (60 pts):  Substring Match in Name.
 * Tier 10 (40 pts): Substring Match in Address.
 * Tier 11 (30 pts): General Token Match.
 *
 * Tiebreakers:
 * +2 pts: Has outstanding debt (> 0).
 * +1 pt: Currently selected customer in POS.
 * Secondary sort: Name length ascending (shorter name ranks higher).
 */
export function scoreCustomer(
  customer: Customer,
  rawQuery: string,
  options?: ScoreCustomerOptions
): number {
  const rawTrimmed = rawQuery.trim();
  if (!rawTrimmed) return 0;

  // NFC Unicode Normalization for exact diacritic consistency across IMEs / operating systems
  const rawNFC = rawTrimmed.normalize('NFC');
  const rawLower = rawNFC.toLowerCase();
  const cleanQuery = removeVietnameseTones(rawNFC);
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  const numericQuery = rawTrimmed.replace(/\D/g, '');

  const nameRaw = (customer.name || '').trim().normalize('NFC');
  const nameRawLower = nameRaw.toLowerCase();
  const nameClean = removeVietnameseTones(nameRaw);

  const phoneRaw = customer.phone || '';
  const phone2Raw = customer.phone2 || '';
  const combinedPhoneRaw = [phoneRaw, phone2Raw].filter(Boolean).join(' / ');
  const normPhones = normalizeVietnamesePhone(combinedPhoneRaw);
  const customerPhones = (normPhones ? normPhones.split(' / ') : combinedPhoneRaw.split(/[\/,;\n\r|]|\s+-\s+/))
    .map(p => p.trim())
    .filter(Boolean);
  const customerPhoneDigitsList = customerPhones
    .map(p => p.replace(/\D/g, ''))
    .filter(Boolean);
  const customerAllDigits = combinedPhoneRaw.replace(/\D/g, '');

  const addressClean = customer.address ? removeVietnameseTones(customer.address.normalize('NFC')) : '';
  const combined = `${nameClean} ${combinedPhoneRaw} ${customerAllDigits} ${addressClean}`;

  // Check if search query consists solely of phone number digits / phone punctuation (no alphabetical letters)
  const isPurePhoneQuery = /^[\d\s+\-()./]+$/.test(rawTrimmed) && numericQuery.length >= 3;

  const normNumericQuery = normalizeSinglePhone(numericQuery);
  const queryPhoneCandidates = [numericQuery, normNumericQuery].filter(Boolean);

  const phoneHasDigits =
    numericQuery.length >= 3 &&
    queryPhoneCandidates.some(
      q =>
        customerPhoneDigitsList.some(p => p.includes(q)) ||
        customerAllDigits.includes(q)
    );

  // Every token must match in combined fields (or phone digits)
  const allTokensMatch =
    tokens.length > 0 &&
    tokens.every(tok => {
      if (combined.includes(tok)) return true;
      const tokDigits = tok.replace(/\D/g, '');
      if (tokDigits.length >= 3 && customerAllDigits.includes(tokDigits)) return true;
      if (tok === '+84' || tok === '84') return true;
      return false;
    });

  if (isPurePhoneQuery) {
    // In pure phone search, customer must match phone digits OR match token in code/address/name
    if (!phoneHasDigits && !allTokensMatch) {
      return 0;
    }
  } else {
    // In text or mixed search (contains letters), ALL tokens MUST strictly match
    if (!allTokensMatch) {
      return 0;
    }
  }

  // Check phone matches (applicable when query is purely phone)
  let isExactPhone = false;
  let isPhonePrefix = false;
  let isPhoneSubstring = false;

  if (isPurePhoneQuery && numericQuery.length > 0) {
    const normQuery = normalizeSinglePhone(numericQuery);
    isExactPhone = customerPhoneDigitsList.some(p => {
      if (p === numericQuery) return true;
      if (normQuery && (p === normQuery || normalizeSinglePhone(p) === normQuery)) return true;
      return false;
    });

    if (!isExactPhone && numericQuery.length >= 3) {
      isPhonePrefix = customerPhoneDigitsList.some(p => {
        if (p.startsWith(numericQuery)) return true;
        if (normQuery && (p.startsWith(normQuery) || normalizeSinglePhone(p).startsWith(normQuery))) return true;
        return false;
      });

      if (!isPhonePrefix) {
        isPhoneSubstring =
          queryPhoneCandidates.some(
            q => customerPhoneDigitsList.some(p => p.includes(q)) || customerAllDigits.includes(q)
          );
      }
    }
  }

  // Check name matches with diacritics
  const isExactNameWithDiacritics = nameRawLower === rawLower;
  const isToneCleanFullName = nameClean === cleanQuery;

  // Words with diacritics
  const rawWords = nameRawLower.split(/\s+/).filter(Boolean);
  const isNamePrefixWithDiacritics = nameRawLower.startsWith(rawLower);
  const isWordMatchWithDiacritics = rawWords.some(
    w => w === rawLower || (rawLower.length >= 2 && w.startsWith(rawLower))
  );

  // Words tone-clean
  const nameWordsClean = nameClean.split(/\s+/).filter(Boolean);
  const isNamePrefixToneClean = nameClean.startsWith(cleanQuery);
  const isWordMatchToneClean = nameWordsClean.some(
    w => w === cleanQuery || (cleanQuery.length >= 2 && w.startsWith(cleanQuery))
  );

  const isNameDiacriticSubstring = nameRawLower.includes(rawLower);
  const isNameSubstring = nameClean.includes(cleanQuery);
  const isAddrSubstring = addressClean.includes(cleanQuery);

  let score = 0;

  if (isExactPhone) {
    score = 300; // Tier 1: Exact Phone Match
  } else if (isPhonePrefix) {
    score = 250; // Tier 2: Phone Prefix Match
  } else if (isPhoneSubstring) {
    score = 220; // Tier 3: Phone Substring Match
  } else if (isExactNameWithDiacritics) {
    score = 200; // Tier 4: Exact Full Name Match WITH DIACRITICS
  } else if (isToneCleanFullName) {
    score = 150; // Tier 5: Tone-Clean Full Name Match
  } else if (isNamePrefixWithDiacritics || isWordMatchWithDiacritics) {
    score = 130; // Tier 6: Exact Diacritic Word/Prefix Match
  } else if (isNamePrefixToneClean || isWordMatchToneClean) {
    score = 100; // Tier 7: Tone-Clean Word/Prefix Match
  } else if (isNameDiacriticSubstring) {
    score = 95; // Tier 8a: Multi-word Exact Diacritic phrase match in name
  } else if (tokens.length > 1 && tokens.every(t => nameClean.includes(t))) {
    score = 90; // Tier 8: Multi-token Name Match
  } else if (tokens.length > 1 && tokens.every(t => combined.includes(t))) {
    score = 85; // Tier 8b: Multi-token Combined Match (e.g. Name + Phone, Name + Address)
  } else if (isNameSubstring) {
    score = 60; // Tier 9: Substring Name Match
  } else if (isAddrSubstring) {
    score = 40; // Tier 10: Address Match
  } else {
    score = 30; // Tier 11: General Match
  }

  // Tiebreakers
  if (customer.debt > 0) score += 2;
  if (options?.selectedCustomerId && customer.id === options.selectedCustomerId) score += 1;

  return score;
}

/**
 * Filter and rank customers based on search query and optional filters.
 */
export function filterAndRankCustomers(
  customers: Customer[],
  query: string,
  options?: FilterCustomersOptions
): Customer[] {
  const rawTrimmed = query.trim();
  const filterDebt = options?.filterOnlyDebt;

  if (!rawTrimmed) {
    const result = filterDebt ? customers.filter(c => c.debt > 0) : [...customers];
    if (options?.selectedCustomerId) {
      const selected = result.find(c => c.id === options.selectedCustomerId);
      const others = result
        .filter(c => c.id !== options.selectedCustomerId)
        .sort((a, b) => (b.debt || 0) - (a.debt || 0));
      return selected ? [selected, ...others] : others;
    }
    return result.sort((a, b) => (b.debt || 0) - (a.debt || 0));
  }

  const scored: { customer: Customer; score: number }[] = [];

  for (const c of customers) {
    if (filterDebt && !(c.debt > 0)) continue;
    const score = scoreCustomer(c, rawTrimmed, options);
    if (score > 0) {
      scored.push({ customer: c, score });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.customer.name.length - b.customer.name.length;
  });

  return scored.map(s => s.customer);
}

/**
 * Detect whether a user search query is an 8-12 digit phone number (allowing standard phone punctuation).
 */
export function isPhoneNumberQuery(query: string): boolean {
  const trimmed = query.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 12) return false;
  // Ensure the query doesn't contain alphabetical characters (e.g. "hang0988")
  const nonPhoneChars = trimmed.replace(/[\d\s+\-()./]/g, '');
  return nonPhoneChars.length === 0;
}

/**
 * Check if a normalized phone number already exists in the customer list (excluding a specific customer ID if editing).
 */
export function findDuplicatePhoneCustomer(
  customers: Customer[],
  phoneInput: string,
  excludeCustomerId?: string
): Customer | null {
  const norm = normalizeVietnamesePhone(phoneInput.trim());
  if (!norm) return null;

  return (
    customers.find(c => {
      if (excludeCustomerId && c.id === excludeCustomerId) return false;
      const matchPhone1 = Boolean(c.phone && isPhoneMatching(c.phone, norm));
      const matchPhone2 = Boolean(c.phone2 && isPhoneMatching(c.phone2, norm));
      return matchPhone1 || matchPhone2;
    }) || null
  );
}
