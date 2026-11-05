// scripts/test_adr0014.js
import assert from 'node:assert';
import fs from 'node:fs';
import {
  calculateEffectiveWeight,
  formatEffectiveUnit,
  formatReceiptQty,
} from '../src/utils/format.ts';

console.log('--- RUNNING ADR-0014 RECEIPT QUANTITY NORMALIZATION & UNICODE TESTS ---');

// -------------------------------------------------------------
// 1. Integer Quantity Immunity (No More Weird Packaging Multiplication)
// -------------------------------------------------------------
console.log('1. Testing Integer Quantity Immunity (Hằng’s Feedback Test)...');

// All real items from Hằng's production screenshot
const hangProductionItems = [
  { name: 'Khoai Lang kén (Gói 500g)', unit: 'Gói 500g', qty: 1, expectedUnit: 'Gói 500g' },
  { name: 'Hành ta phi giòn gói 300g', unit: 'gói', qty: 2, expectedUnit: 'gói' },
  { name: 'Sốt mỳ ý bò bằm 600g', unit: 'Hộp', qty: 4, expectedUnit: 'Hộp' },
  { name: 'Sốt kem nấm cô đặc (310g)', unit: 'Hộp 310g', qty: 5, expectedUnit: 'Hộp 310g' },
  { name: 'Salat rong biển HQ 1kg', unit: 'gói', qty: 1, expectedUnit: 'gói' },
  { name: 'Mọc nấm hương băm tay', unit: 'Gói 500g', qty: 2, expectedUnit: 'Gói 500g' },
  { name: 'Mỳ trộn dao cắt Sơn Tây', unit: 'set 5 gói', qty: 3, expectedUnit: 'set 5 gói' },
];

for (const item of hangProductionItems) {
  const weight = calculateEffectiveWeight(item.unit, item.name, item.qty);
  assert.strictEqual(
    weight,
    null,
    `Integer qty ${item.qty} for "${item.name}" must NOT calculate composite weight, got "${weight}"`
  );

  const formatted = formatEffectiveUnit(item.unit, item.qty, item.name);
  assert.strictEqual(
    formatted.displayUnit,
    item.expectedUnit,
    `Display unit for "${item.name}" must remain "${item.expectedUnit}", got "${formatted.displayUnit}"`
  );
  assert.strictEqual(formatted.effectiveWeight, null);
  assert.strictEqual(formatted.isScaled, false);
}
console.log('✓ All 7 items from Hằng’s production screenshot preserved exact packaging units.');

// Check standard integer range (1 to 100)
for (const q of [1, 2, 3, 4, 5, 6, 10, 12, 20, 50, 100]) {
  assert.strictEqual(
    calculateEffectiveWeight('Gói 500g', 'Xúc xích Phô mai Tươi (500g)', q),
    null,
    `Integer qty ${q} must return null`
  );
}
console.log('✓ Integer quantities from 1 to 100 verified immune to multiplication.');

// -------------------------------------------------------------
// 2. Unicode Lookahead Word-Boundary Safety
// -------------------------------------------------------------
console.log('2. Testing Unicode Lookahead Word-Boundary Safety...');

const unicodeNonWeightStrings = [
  { unit: 'set 5 gói', name: 'Mỳ trộn dao cắt Sơn Tây' },
  { unit: 'combo 3 gói', name: 'Gia vị thảo mộc' },
  { unit: 'set 2 con gà', name: 'Gà ủ muối hoa tiêu' },
  { unit: '4 ly', name: 'Trà sâm dứa' },
  { unit: '2 lọ', name: 'Mật ong hoa rừng' },
  { unit: '10 miếng', name: 'Bánh tráng nướng' },
];

for (const tc of unicodeNonWeightStrings) {
  // Test both with fractional (0.5) and integer (3)
  assert.strictEqual(
    calculateEffectiveWeight(tc.unit, tc.name, 0.5),
    null,
    `"${tc.unit}" must not be mistaken for weight even at fractional qty 0.5`
  );
  assert.strictEqual(
    calculateEffectiveWeight(tc.unit, tc.name, 3),
    null,
    `"${tc.unit}" must not be mistaken for weight at qty 3`
  );
}
console.log('✓ Unicode boundaries verified: "gói", "gà", "ly", "lọ", "miếng" never match weight.');

// -------------------------------------------------------------
// 3. Fractional Quantities Still Work for Portion Cuts (ADR-0012 Retained)
// -------------------------------------------------------------
console.log('3. Testing Fractional Cut Portions Retained...');

const fractionalCases = [
  { unit: 'Gói 500g', name: 'Khoai Lang kén (500g)', qty: 0.5, expected: '250g', expectedUnit: 'Gói 500g → 250g' },
  { unit: 'Gói 500g', name: 'Xúc xích Bò Tiêu Đen (500g)', qty: 0.56, expected: '280g', expectedUnit: 'Gói 500g → 280g' },
  { unit: 'Hũ 250g', name: 'Pate Gan Gà (250g)', qty: 0.5, expected: '125g', expectedUnit: 'Hũ 250g → 125g' },
  { unit: 'Khay 1kg', name: 'Lõi vai bò 1kg', qty: 0.59, expected: '590g', expectedUnit: 'Khay 1kg → 590g' },
  { unit: 'Hộp', name: 'Sốt mỳ ý 600g', qty: 0.5, expected: '300g', expectedUnit: 'Hộp (300g)' },
];

for (const fc of fractionalCases) {
  const weight = calculateEffectiveWeight(fc.unit, fc.name, fc.qty);
  assert.strictEqual(weight, fc.expected, `Fractional qty ${fc.qty} for ${fc.unit} must be ${fc.expected}`);

  const formatted = formatEffectiveUnit(fc.unit, fc.qty, fc.name);
  assert.strictEqual(formatted.displayUnit, fc.expectedUnit);
  assert.strictEqual(formatted.effectiveWeight, fc.expected);
  assert.strictEqual(formatted.isScaled, true);
}
console.log('✓ Fractional cut portions correctly scale and update displayUnit.');

// -------------------------------------------------------------
// 4. Verification of ThermalReceipt.tsx Clean SL Column
// -------------------------------------------------------------
console.log('4. Verifying ThermalReceipt.tsx Clean SL Column Structure...');

const receiptCode = fs.readFileSync('src/components/pos/ThermalReceipt.tsx', 'utf8');

// Ensure no effectiveWeight subline is rendered inside the SL column
assert.strictEqual(
  receiptCode.includes('{effectiveWeight &&'),
  false,
  'ThermalReceipt must NOT have {effectiveWeight &&} in SL column'
);

// Ensure formatReceiptQty is cleanly present
assert.strictEqual(
  receiptCode.includes('{formatReceiptQty(item.qty)}'),
  true,
  'ThermalReceipt must render formatReceiptQty(item.qty)'
);

console.log('✓ ThermalReceipt source verified: SL column is 100% clean of bracketed weights.');

console.log('================================================================');
console.log('🎉 ALL ADR-0014 TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
