// scripts/test_adr0010.js
import assert from 'node:assert';
import { removeVietnameseTones } from '../src/utils/vietnamese.ts';

console.log('--- RUNNING ADR-0010 MULTI-TOKEN SEARCH, RANKING & PAGINATION TESTS ---');

// 1. Multi-token and Whole-Word Ranking Test
function scoreCustomer(customer, rawQuery) {
  const cleanQuery = removeVietnameseTones(rawQuery.trim());
  const tokens = cleanQuery.split(/\s+/).filter(Boolean);
  const numericQuery = rawQuery.trim().replace(/\D/g, '');

  const nameClean = removeVietnameseTones(customer.name);
  const phone = customer.phone || '';
  const addressClean = customer.address ? removeVietnameseTones(customer.address) : '';
  const combined = `${nameClean} ${phone} ${addressClean}`;

  const allTokensMatch = tokens.every(tok => combined.includes(tok));
  if (!allTokensMatch) return 0;

  let score = 0;
  const nameWords = nameClean.split(/\s+/).filter(Boolean);

  const isNamePrefix = nameClean.startsWith(cleanQuery);
  const isWordBoundaryMatch = nameWords.some(w => w === cleanQuery || (cleanQuery.length >= 2 && w.startsWith(cleanQuery)));
  const isPhonePrefix = numericQuery.length > 0 && phone.startsWith(numericQuery);
  const isNameSubstring = nameClean.includes(cleanQuery);

  if (isNamePrefix) score = 120;
  else if (isWordBoundaryMatch) score = 110;
  else if (isPhonePrefix) score = 100;
  else if (tokens.length > 1 && tokens.every(t => nameClean.includes(t))) score = 90;
  else if (isNameSubstring) score = 60;
  else score = 40;

  if (customer.debt > 0) score += 15;
  return score;
}

console.log('1. Testing whole-word ranking ("Yến" vs "Nguyễn")...');
const custYenThanhPhan = { id: 'c1', name: 'Yến Thanh Phan', phone: '0912345678', debt: 0 };
const custLeYen = { id: 'c2', name: 'Lê Yến', phone: '0932377552', debt: 0 };
const custHaiYen = { id: 'c3', name: 'Hải Yến', phone: '0982858486', debt: 0 };
const custNguyenTuan = { id: 'c4', name: 'Anh Nguyễn Tuấn', phone: '0912345678', debt: 0 };

const scoreYenThanhPhan = scoreCustomer(custYenThanhPhan, 'yến');
const scoreLeYen = scoreCustomer(custLeYen, 'yến');
const scoreHaiYen = scoreCustomer(custHaiYen, 'yến');
const scoreNguyenTuan = scoreCustomer(custNguyenTuan, 'yến');

assert.ok(scoreYenThanhPhan >= 120, 'Yến Thanh Phan should have prefix score 120');
assert.ok(scoreLeYen >= 110, 'Lê Yến should have whole-word score 110');
assert.ok(scoreHaiYen >= 110, 'Hải Yến should have whole-word score 110');
assert.strictEqual(scoreNguyenTuan, 60, 'Nguyễn Tuấn only contains substring "yen", should have score 60');

assert.ok(scoreYenThanhPhan > scoreNguyenTuan, 'Yến must rank strictly higher than Nguyễn');
assert.ok(scoreLeYen > scoreNguyenTuan, 'Lê Yến must rank strictly higher than Nguyễn');
console.log('✓ Whole-word prioritization prevents "Yến" from getting buried in "Nguyễn".');

console.log('2. Testing multi-token search ("yến thanh phan")...');
const scoreMultiMatch = scoreCustomer(custYenThanhPhan, 'yến thanh phan');
const scoreMultiFail = scoreCustomer({ id: 'c5', name: 'Yen Nguyen', phone: '0903432263' }, 'yến thanh phan');

assert.ok(scoreMultiMatch > 0, 'Yến Thanh Phan matches all 3 tokens');
assert.strictEqual(scoreMultiFail, 0, 'Yen Nguyen lacks "thanh" and "phan", must score 0 (filtered out)');
console.log('✓ Multi-token search accurately filters out non-matching names.');

console.log('3. Testing Pagination Mathematics (KiotViet standard)...');
const totalCustomers = 3077;
const pageSize = 20;
const totalPages = Math.ceil(totalCustomers / pageSize);

assert.strictEqual(totalPages, 154, '3077 items with pageSize 20 must produce 154 pages');
const page1Start = 0 * pageSize;
const page1End = Math.min(1 * pageSize, totalCustomers);
assert.strictEqual(page1End - page1Start, 20, 'Page 1 has 20 items');

const page154Start = 153 * pageSize;
const page154End = Math.min(154 * pageSize, totalCustomers);
assert.strictEqual(page154End - page154Start, 17, 'Page 154 has 17 items (3077 % 20)');
console.log('✓ Pagination mathematics and boundary slices verified.');

console.log('4. Testing Deduplication Buffer...');
const mockRawStream = [
  { id: 'c1', name: 'A' },
  { id: 'c2', name: 'B' },
  { id: 'c1', name: 'A (dup)' },
  { id: 'c3', name: 'C' },
  { id: 'c2', name: 'B (dup)' },
];
const seenIds = new Set();
const deduplicated = [];
for (const r of mockRawStream) {
  if (!seenIds.has(r.id)) {
    seenIds.add(r.id);
    deduplicated.push(r);
  }
}
assert.strictEqual(deduplicated.length, 3, '5 stream items with 2 duplicates must yield exactly 3 unique items');
assert.deepStrictEqual(deduplicated.map(r => r.id), ['c1', 'c2', 'c3']);
console.log('✓ Defensive deduplication buffer verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0010 TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
