// scripts/test_adr0009.js
import assert from 'node:assert';
import { removeVietnameseTones } from '../src/utils/vietnamese.ts';
import { DEFAULT_RECEIPT_SETTINGS } from '../src/data/initialData.ts';

function rankCustomer(customer, rawQuery) {
  const cleanQuery = removeVietnameseTones(rawQuery.trim());
  const numericQuery = rawQuery.trim().replace(/\D/g, '');

  const nameClean = removeVietnameseTones(customer.name);
  const phone = customer.phone || '';
  const addressClean = customer.address ? removeVietnameseTones(customer.address) : '';

  let score = 0;

  const isNamePrefix = nameClean.startsWith(cleanQuery);
  const isPhonePrefix = numericQuery.length > 0 && phone.startsWith(numericQuery);
  const isNameSubstring = nameClean.includes(cleanQuery);
  const isPhoneSubstring = numericQuery.length > 0 && phone.includes(numericQuery);
  const isAddrSubstring = addressClean.includes(cleanQuery);

  if (isNamePrefix || isPhonePrefix) {
    score = 100;
  } else if (customer.debt > 0 && (isNameSubstring || isPhoneSubstring)) {
    score = 80;
  } else if (isNameSubstring || isPhoneSubstring) {
    score = 60;
  } else if (isAddrSubstring) {
    score = 40;
  }

  return score;
}

console.log('--- RUNNING ADR-0009 CUSTOMER COMBOBOX & MINIMAL RECEIPT UNIT TESTS ---');

// Test 1: Diacritics Insensitive Search
console.log('1. Testing Vietnamese Diacritics Insensitivity...');
assert.strictEqual(removeVietnameseTones('Nguyễn Ngọc Tùng'), 'nguyen ngoc tung');
assert.strictEqual(removeVietnameseTones('Hoàng Minh Hằng'), 'hoang minh hang');
assert.strictEqual(removeVietnameseTones('Đỗ Thu Hà'), 'do thu ha');
assert.strictEqual(removeVietnameseTones('Phạm Tuấn Đạt'), 'pham tuan dat');
console.log('✓ Vietnamese tone normalization works perfectly.');

// Test 2: Ranking Algorithm (Prefix > Debtor > Substring > Address)
console.log('2. Testing Customer Ranking Algorithm (Decision 2a)...');

const custPrefix = { id: 'c1', name: 'Lan Anh (Đội Cấn)', phone: '0912345678', debt: 0 };
const custDebtor = { id: 'c2', name: 'Ngọc Lan', phone: '0988776655', debt: 150000 };
const custSubstring = { id: 'c3', name: 'Bùi Thị Lan', phone: '0901234567', debt: 0 };
const custAddress = { id: 'c4', name: 'Hoàng Minh', phone: '0944556677', address: 'Ngõ Lan Ba Đình', debt: 0 };
const custNonMatch = { id: 'c5', name: 'Trần Văn Nam', phone: '0977889900', debt: 0 };

assert.strictEqual(rankCustomer(custPrefix, 'lan'), 100, 'Prefix match should have score 100');
assert.strictEqual(rankCustomer(custDebtor, 'lan'), 80, 'Debtor substring match should have score 80');
assert.strictEqual(rankCustomer(custSubstring, 'lan'), 60, 'Normal substring match should have score 60');
assert.strictEqual(rankCustomer(custAddress, 'lan'), 40, 'Address substring match should have score 40');
assert.strictEqual(rankCustomer(custNonMatch, 'lan'), 0, 'Non match should have score 0');

// Phone search ranking
assert.strictEqual(rankCustomer(custDebtor, '0988'), 100, 'Phone prefix match should have score 100');
assert.strictEqual(rankCustomer(custDebtor, '7766'), 80, 'Debtor phone substring match should have score 80');
assert.strictEqual(rankCustomer(custSubstring, '2345'), 60, 'Phone substring match should have score 60');

console.log('✓ Customer ranking prioritization (Prefix > Debtor > Substring > Address) verified.');

// Test 3: Thermal Receipt Default Settings (4-Line Omission)
console.log('3. Testing Thermal Receipt Settings Defaults...');
assert.strictEqual(DEFAULT_RECEIPT_SETTINGS.showOrderType, false, 'showOrderType must default to false');
assert.strictEqual(DEFAULT_RECEIPT_SETTINGS.showPaymentMethod, false, 'showPaymentMethod must default to false');
assert.strictEqual(DEFAULT_RECEIPT_SETTINGS.showDebtInfo, false, 'showDebtInfo must default to false');
console.log('✓ Thermal receipt default settings verify 4-line omission (showOrderType, showPaymentMethod, showDebtInfo are false).');

console.log('================================================================');
console.log('🎉 ALL ADR-0009 UNIT TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
