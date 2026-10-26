// scripts/test_adr0012.js
import assert from 'node:assert';
import {
  calculateEffectiveWeight,
  formatEffectiveUnit,
  getDeliveryCalloutConfig,
} from '../src/utils/format.ts';

console.log('--- RUNNING ADR-0012 DYNAMIC PORTION WEIGHT & TYPOGRAPHY TESTS ---');

// -------------------------------------------------------------
// 1. Dynamic Portion Weight Calculation Tests
// -------------------------------------------------------------
console.log('1. Testing calculateEffectiveWeight...');

// Case 1: Standard 500g pack with 0.5 qty => 250g (Hằng's core test case)
assert.strictEqual(
  calculateEffectiveWeight('Gói 500g', 'Xúc xích Bò Tiêu Đen (500g)', 0.5),
  '250g',
  '500g * 0.5 must be exactly 250g'
);

// Case 2: 500g pack with 0.56 qty => 280g (Hằng's screenshot test case)
assert.strictEqual(
  calculateEffectiveWeight('Gói 500g', 'Xúc xích Bò Tiêu Đen (500g)', 0.56),
  '280g',
  '500g * 0.56 must be exactly 280g'
);

// Case 3: 250g jar with 0.5 qty => 125g
assert.strictEqual(
  calculateEffectiveWeight('Hũ 250g', 'Pate Gan Gà Truffle (250g)', 0.5),
  '125g',
  '250g * 0.5 must be 125g'
);

// Case 4: 1kg pack with fractional qty => grams conversion
assert.strictEqual(
  calculateEffectiveWeight('Khay 1kg', 'Lõi vai bò vân tuyết Aukobe 1kg', 0.59),
  '590g',
  '1kg * 0.59 must convert to 590g'
);
assert.strictEqual(
  calculateEffectiveWeight('Khay 1kg', 'Lõi vai bò vân tuyết Aukobe 1kg', 0.5),
  '500g',
  '1kg * 0.5 must convert to 500g'
);
assert.strictEqual(
  calculateEffectiveWeight('Khay 1kg', 'Lõi vai bò vân tuyết Aukobe 1kg', 1.25),
  '1.25kg',
  '1kg * 1.25 must be 1.25kg'
);

// Case 5: Weight in product name, unit is generic (e.g. Hộp)
assert.strictEqual(
  calculateEffectiveWeight('Hộp', 'Sốt mỳ ý bò bằm 600g', 0.5),
  '300g',
  '600g * 0.5 must extract from name and be 300g'
);

// Case 6: Liquid volume in ml / l
assert.strictEqual(
  calculateEffectiveWeight('Chai 300ml', 'Sốt Chấm Thịt Nướng (300ml)', 0.5),
  '150ml',
  '300ml * 0.5 must be 150ml'
);
assert.strictEqual(
  calculateEffectiveWeight('Chai 1l', 'Nước mắm cá cơm 1l', 0.5),
  '500ml',
  '1l * 0.5 must convert to 500ml'
);

// Case 7: Inactive when qty is 1 (standard whole pack)
assert.strictEqual(
  calculateEffectiveWeight('Gói 500g', 'Xúc xích Bò Tiêu Đen (500g)', 1),
  null,
  'When qty is 1, effective weight must be null (no portion scaling needed)'
);

// Case 8: Non-weight items (e.g. pieces, sets)
assert.strictEqual(
  calculateEffectiveWeight('Túi', 'Bánh mỳ tươi mini (set 20c)', 0.5),
  null,
  'Count-based sets (20c) must not match weight'
);
assert.strictEqual(
  calculateEffectiveWeight('Cái', 'Bánh bao trứng sữa', 2),
  null,
  'Items without grams or kilograms must return null'
);

// Case 9: Zero, negative or invalid qty
assert.strictEqual(calculateEffectiveWeight('Gói 500g', 'Xúc xích', 0), null);
assert.strictEqual(calculateEffectiveWeight('Gói 500g', 'Xúc xích', -1), null);
assert.strictEqual(calculateEffectiveWeight('Gói 500g', 'Xúc xích', null), null);

console.log('✓ All calculateEffectiveWeight tests passed.');

// -------------------------------------------------------------
// 2. Testing formatEffectiveUnit (Display String)
// -------------------------------------------------------------
console.log('2. Testing formatEffectiveUnit...');

// When unit has weight: "Gói 500g" -> "Gói 500g → 250g"
const formatted1 = formatEffectiveUnit('Gói 500g', 0.5, 'Xúc xích Bò Tiêu Đen (500g)');
assert.strictEqual(formatted1.displayUnit, 'Gói 500g → 250g');
assert.strictEqual(formatted1.effectiveWeight, '250g');
assert.strictEqual(formatted1.isScaled, true);

// Screenshot case: 0.56 -> "Gói 500g → 280g"
const formatted2 = formatEffectiveUnit('Gói 500g', 0.56, 'Xúc xích Bò Tiêu Đen (500g)');
assert.strictEqual(formatted2.displayUnit, 'Gói 500g → 280g');
assert.strictEqual(formatted2.effectiveWeight, '280g');
assert.strictEqual(formatted2.isScaled, true);

// Generic unit with weight in name: "Hộp" -> "Hộp (300g)"
const formatted3 = formatEffectiveUnit('Hộp', 0.5, 'Sốt mỳ ý bò bằm 600g');
assert.strictEqual(formatted3.displayUnit, 'Hộp (300g)');
assert.strictEqual(formatted3.effectiveWeight, '300g');
assert.strictEqual(formatted3.isScaled, true);

// Unchanged when qty is 1
const formattedWhole = formatEffectiveUnit('Gói 500g', 1, 'Xúc xích Bò Tiêu Đen (500g)');
assert.strictEqual(formattedWhole.displayUnit, 'Gói 500g');
assert.strictEqual(formattedWhole.effectiveWeight, null);
assert.strictEqual(formattedWhole.isScaled, false);

console.log('✓ All formatEffectiveUnit tests passed.');

// -------------------------------------------------------------
// 3. Testing Delivery Callout Typography (Eliminating Faux-Bold Smear)
// -------------------------------------------------------------
console.log('3. Testing Delivery Callout Typography...');

const standardCallout = getDeliveryCalloutConfig('standard_large');
assert.strictEqual(
  standardCallout.fontWeightClass,
  'font-bold',
  'Callout must use font-bold (700) instead of font-black (900) to prevent faux-bold smudging'
);

const extraCallout = getDeliveryCalloutConfig('extra_large');
assert.strictEqual(
  extraCallout.fontWeightClass,
  'font-bold',
  'Extra large callout must also use font-bold (700)'
);

console.log('✓ All Typography & Callout tests passed.');

console.log('================================================================');
console.log('🎉 ALL ADR-0012 TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
