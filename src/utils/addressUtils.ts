import type { Customer } from '../types/index.ts';

const ADDRESS_STREET_HINT_RE =
  /\d|\b(số|ngõ|ngách|hẻm|đường|phố|tòa|chung cư|căn|lô|khu|phường|quận|tầng|vin|ct\d*|p\d+|bt\d*|lk\d*|tập thể)\b/i;

const SHORT_UNIT_TOKEN_RE = /^(?:[A-Za-zÀ-ỹ]{0,2}\d+[A-Za-zÀ-ỹ]?|\d+[A-Za-zÀ-ỹ]{0,2})$/;
const PURE_SHORT_PREFIX_RE = /^(?:p|phòng|tầng|căn|lô|nhà|số|ct|hh|nơ|k|a|b|c|d)?\s*[a-zA-Z]?\d+[a-zA-Z]?$/i;

/**
 * Normalize a primary address and optional list of extra addresses:
 * - Trims whitespace
 * - Drops empties
 * - Deduplicates case-insensitively (NFC)
 * - Promotes the first extra address to primary if primary is blank
 */
export function normalizeAddressList(
  primary: string,
  extras?: string[]
): { address: string; extraAddresses?: string[] } {
  const seen = new Set<string>();
  const cleanAll: string[] = [];

  const pushIfUnique = (raw?: string) => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return;
    const key = trimmed.normalize('NFC').replace(/\s+/g, ' ').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      cleanAll.push(trimmed);
    }
  };

  pushIfUnique(primary);
  for (const ex of extras || []) {
    pushIfUnique(ex);
  }

  if (cleanAll.length === 0) {
    return { address: '', extraAddresses: undefined };
  }

  const [first, ...rest] = cleanAll;
  return {
    address: first,
    extraAddresses: rest.length > 0 ? rest : undefined,
  };
}

/**
 * Return all distinct non-empty addresses of a customer (primary + extraAddresses).
 */
export function getAllCustomerAddresses(
  customer: Pick<Customer, 'address' | 'extraAddresses'> | null | undefined
): string[] {
  if (!customer) return [];
  const { address, extraAddresses } = normalizeAddressList(
    customer.address || '',
    customer.extraAddresses
  );
  return [address, ...(extraAddresses || [])].filter(Boolean);
}

/**
 * Check if two address strings refer to the same normalized address.
 */
export function isAddressMatching(addrA: string, addrB: string): boolean {
  const normA = String(addrA || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  const normB = String(addrB || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  return Boolean(normA && normB && normA === normB);
}

/**
 * Determine whether a slash at `slashIndex` inside `str` is an address boundary
 * (separating two distinct delivery addresses) vs a house-number / alley / lot / date slash.
 */
function isAddressBoundarySlash(str: string, slashIndex: number, segmentStart: number): boolean {
  // Ignore double slashes like 30//67A
  if (str[slashIndex - 1] === '/' || str[slashIndex + 1] === '/') {
    return false;
  }

  const leftSoFar = str.slice(segmentStart, slashIndex);
  const rightRest = str.slice(slashIndex + 1);

  // Leading or trailing slash is never a two-address split
  if (!leftSoFar.trim() || !rightRest.trim()) return false;

  const hasSpaceBefore = /\s$/.test(leftSoFar);
  const hasSpaceAfter = /^\s/.test(rightRest);

  // Extract immediate non-whitespace token just before `/` and just after `/`
  const leftTrimmed = leftSoFar.trimEnd();
  const rightTrimmed = rightRest.trimStart();

  const tokenBeforeMatch = leftTrimmed.match(/([^\s,;()]+)$/);
  const tokenAfterMatch = rightTrimmed.match(/^([^\s,;()/]+)/);
  const tokenBefore = tokenBeforeMatch ? tokenBeforeMatch[1] : '';
  const tokenAfter = tokenAfterMatch ? tokenAfterMatch[1] : '';

  // Next piece up to the following `/` or `;` or `|` or newline
  const nextDelimiterIdx = rightTrimmed.search(/[\/|;\n]/);
  const immediateRight =
    nextDelimiterIdx === -1 ? rightTrimmed : rightTrimmed.slice(0, nextDelimiterIdx).trim();

  // Case 1: Space around `/` (e.g. "1 Trần Huy Liệu/ 83 Hào Nam", "P512 / CT5B mễ trì hạ", "1/6/ 200 Nguyễn Sơn")
  if (hasSpaceBefore || hasSpaceAfter) {
    // Reject if the entire left segment is just a short room/unit prefix like "P512" in "P512 / CT5B mễ trì hạ"
    if (PURE_SHORT_PREFIX_RE.test(leftTrimmed) && leftTrimmed.length <= 10) {
      return false;
    }
    // Reject if left side ends with a house-number / unit-number prefix like "8 ngách 40 / 26 Kim Giang"
    if (
      /(?:^|\s)(?:số|ngõ|ngách|hẻm|tầng|phòng|căn|lô|khu|nhà)\s+[a-zA-ZÀ-ỹ]?\d+[a-zA-ZÀ-ỹ]?$/i.test(
        leftTrimmed
      )
    ) {
      return false;
    }
    // Reject if entire right side is just a short unit/number token (e.g. "P512 / CT5B")
    if (SHORT_UNIT_TOKEN_RE.test(rightTrimmed)) {
      return false;
    }
    // If immediate right before the next `/` is a short unit token (e.g. "A1/78 Trung Tiền" or "35/260 Đội Cấn"),
    // allow split ONLY when right side continues into a full street address and left side isn't a unit token.
    if (SHORT_UNIT_TOKEN_RE.test(immediateRight)) {
      const rightContinuesWithStreet =
        rightTrimmed.includes('/') && /[a-zA-ZÀ-ỹ]{2,}/.test(rightTrimmed) && !SHORT_UNIT_TOKEN_RE.test(tokenBefore);
      if (!rightContinuesWithStreet) {
        return false;
      }
    }
    // Both sides must look substantial
    return leftTrimmed.length >= 4 && rightTrimmed.length >= 4 && /[a-zA-ZÀ-ỹ]/.test(leftTrimmed) && /[a-zA-ZÀ-ỹ]/.test(rightTrimmed);
  }

  // Case 2: No spaces around `/` (e.g. "40/26", "914/k3", "1C/106", "14/222F", "P2/N3", "Trung/38", "Hậu/39", "M3-M4/90")
  // If both immediate tokens are short house/alley/room codes, it's ONE address
  if (SHORT_UNIT_TOKEN_RE.test(tokenBefore) && SHORT_UNIT_TOKEN_RE.test(tokenAfter)) {
    return false;
  }

  // If tokenBefore is a multi-letter Vietnamese word (>= 2 letters, not a 1-letter+digits code like 14A, k3, 1C, P2)
  // OR contains a hyphenated building code like M3-M4 before a street number
  const isWordBefore = /[a-zA-ZÀ-ỹ]{2,}/.test(tokenBefore) && !/^[a-zA-ZÀ-ỹ]{1,2}\d+[a-zA-ZÀ-ỹ]?$/i.test(tokenBefore);
  const isHyphenBuildingBefore = /^[a-zA-ZÀ-ỹ0-9]+-[a-zA-ZÀ-ỹ0-9]+$/.test(tokenBefore) && /^\d+$/.test(tokenAfter);

  if (isWordBefore || isHyphenBuildingBefore) {
    // Ensure left side has enough context (>= 4 chars) and right side looks like an address (>= 5 chars with letters)
    return (
      leftTrimmed.length >= 4 &&
      rightTrimmed.length >= 5 &&
      /[a-zA-ZÀ-ỹ]/.test(leftTrimmed) &&
      /[a-zA-ZÀ-ỹ]/.test(rightTrimmed)
    );
  }

  return false;
}

/**
 * Extract distinct delivery addresses from a legacy single `address` string.
 * Protects Vietnamese slash house numbers (e.g. "ngách 40/26 Kim Giang", "4/7/188 Vương Thừa Vũ",
 * "914/k3 Kpark", "14/222F Đội Cấn", "1C/106", "vườn hoa 1/6", "P512 / CT5B") from false splitting.
 */
export function extractIndividualAddresses(addressStr: string): string[] {
  if (!addressStr) return [];
  const raw = String(addressStr).replace(/\r\n/g, '\n').trim();
  if (!raw) return [];

  // Strip stray leading backslashes/slashes like "\\ A4 tòa nhà..."
  const cleaned = raw.replace(/^[\\/|;\s]+/, '').trim();
  if (!cleaned) return [];

  // Step 1: Split on unambiguous delimiters `;` and `|`
  const coarseParts: string[] = [];
  for (const semiPart of cleaned.split(/\s*[;|]\s*/)) {
    const trimmedSemi = semiPart.trim();
    if (!trimmedSemi) continue;

    // Handle newlines: only split on `\n` if BOTH sides look like independent addresses
    if (trimmedSemi.includes('\n')) {
      const lines = trimmedSemi.split('\n').map(l => l.trim()).filter(Boolean);
      const mergedLines: string[] = [];
      for (const line of lines) {
        if (
          mergedLines.length > 0 &&
          mergedLines[mergedLines.length - 1].length >= 10 &&
          line.length >= 10 &&
          ADDRESS_STREET_HINT_RE.test(mergedLines[mergedLines.length - 1]) &&
          ADDRESS_STREET_HINT_RE.test(line)
        ) {
          mergedLines.push(line);
        } else if (mergedLines.length > 0) {
          mergedLines[mergedLines.length - 1] = `${mergedLines[mergedLines.length - 1]}, ${line}`;
        } else {
          mergedLines.push(line);
        }
      }
      coarseParts.push(...mergedLines);
    } else {
      coarseParts.push(trimmedSemi);
    }
  }

  // Step 2: Within each part, scan `/` boundaries carefully
  const splitParts: string[] = [];
  for (const part of coarseParts) {
    let segStart = 0;
    for (let i = 0; i < part.length; i++) {
      if (part[i] === '/') {
        if (isAddressBoundarySlash(part, i, segStart)) {
          const left = part.slice(segStart, i).trim();
          if (left.length >= 3) {
            splitParts.push(left);
          }
          segStart = i + 1;
        }
      }
    }
    const tail = part.slice(segStart).trim();
    if (tail.length >= 3) {
      splitParts.push(tail);
    }
  }

  // Deduplicate case-insensitively preserving first occurrence
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const addr of splitParts) {
    const key = addr.normalize('NFC').replace(/\s+/g, ' ').toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(addr);
    }
  }

  return unique;
}

/**
 * Convert a customer's delimited `address` string into primary `address` + `extraAddresses`
 * on the SAME customer profile (without creating a duplicate customer).
 */
export function convertAddressToExtraAddresses(
  customer: Customer,
  timestamp = new Date().toISOString()
): { customer: Customer; changed: boolean; addresses: string[] } {
  const extracted = extractIndividualAddresses(customer.address || '');
  if (extracted.length <= 1) {
    return {
      customer,
      changed: false,
      addresses: getAllCustomerAddresses(customer),
    };
  }

  const [primary, ...rest] = extracted;
  const normalized = normalizeAddressList(primary, [...(customer.extraAddresses || []), ...rest]);

  return {
    customer: {
      ...customer,
      address: normalized.address,
      extraAddresses: normalized.extraAddresses,
      updatedAt: timestamp,
    },
    changed: true,
    addresses: [normalized.address, ...(normalized.extraAddresses || [])],
  };
}
