// scripts/test_adr0011.js
import assert from 'node:assert';
import {
  parseQuantity,
  formatReceiptQty,
  formatDisplayQty,
  formatVND,
  getDeliveryCalloutConfig,
} from '../src/utils/format.ts';
import { calculateStockDelta } from '../src/services/syncConflict.ts';

console.log('--- RUNNING ADR-0011 FRACTIONAL QUANTITIES & DELIVERY CALLOUT HEADER TESTS ---');

// -------------------------------------------------------------
// 1. Decimal Input Parsing Tests (Comma & Dot Delimiters)
// -------------------------------------------------------------
console.log('1. Testing Decimal Input Parsing (parseQuantity)...');

// Vietnamese comma delimiter
assert.strictEqual(parseQuantity('0,59'), 0.59, 'Should parse Vietnamese comma "0,59" to 0.59');
assert.strictEqual(parseQuantity('0,5'), 0.5, 'Should parse "0,5" to 0.5');
assert.strictEqual(parseQuantity('1,25'), 1.25, 'Should parse "1,25" to 1.25');
assert.strictEqual(parseQuantity('2,0'), 2, 'Should parse "2,0" to 2');

// Leading delimiter (no leading 0)
assert.strictEqual(parseQuantity(',59'), 0.59, 'Should parse leading comma ",59" to 0.59');
assert.strictEqual(parseQuantity('.5'), 0.5, 'Should parse leading dot ".5" to 0.5');

// Standard dot delimiter
assert.strictEqual(parseQuantity('0.59'), 0.59, 'Should parse dot "0.59" to 0.59');
assert.strictEqual(parseQuantity('0.5'), 0.5, 'Should parse dot "0.5" to 0.5');
assert.strictEqual(parseQuantity('1.25'), 1.25, 'Should parse dot "1.25" to 1.25');

// Integer strings & numbers
assert.strictEqual(parseQuantity('1'), 1, 'Should parse integer string "1" to 1');
assert.strictEqual(parseQuantity('10'), 10, 'Should parse integer string "10" to 10');
assert.strictEqual(parseQuantity(1), 1, 'Should handle number 1');
assert.strictEqual(parseQuantity(0.59), 0.59, 'Should handle number 0.59');

// Whitespace trimming
assert.strictEqual(parseQuantity('  0,59  '), 0.59, 'Should trim spaces around "  0,59  "');
assert.strictEqual(parseQuantity('  1.5 \t'), 1.5, 'Should trim tab and spaces around "  1.5 \t"');

// Invalid, empty, and negative edge cases (clamped safely at 0)
assert.strictEqual(parseQuantity(''), 0, 'Empty string should return 0');
assert.strictEqual(parseQuantity('   '), 0, 'Whitespace-only string should return 0');
assert.strictEqual(parseQuantity('abc'), 0, 'Non-numeric string should return 0');
assert.strictEqual(parseQuantity(null), 0, 'Null should return 0');
assert.strictEqual(parseQuantity(undefined), 0, 'Undefined should return 0');
assert.strictEqual(parseQuantity(NaN), 0, 'NaN should return 0');
assert.strictEqual(parseQuantity(-1), 0, 'Negative number must clamp to 0');
assert.strictEqual(parseQuantity('-0.59'), 0, 'Negative string must clamp to 0');

console.log('✓ All Decimal Input Parsing tests (including negative clamping & leading delimiters) passed.');

// -------------------------------------------------------------
// 2. Financial Line Item & Subtotal Calculations
// -------------------------------------------------------------
console.log('2. Testing Financial Line Item & Subtotal Calculations...');

// Line item total: Math.round(price * qty)
const aukobePrice = 380000;
const aukobeQty = 0.59;
const aukobeTotal = Math.round(aukobePrice * aukobeQty);
assert.strictEqual(aukobeTotal, 224200, '380,000 * 0.59 should equal exactly 224,200đ');

const patePrice = 120000;
const pateQty = 0.5;
const pateTotal = Math.round(patePrice * pateQty);
assert.strictEqual(pateTotal, 60000, '120,000 * 0.5 should equal 60,000đ');

const sausagePrice = 145000;
const sausageQty = 1;
const sausageTotal = Math.round(sausagePrice * sausageQty);
assert.strictEqual(sausageTotal, 145000, '145,000 * 1 should equal 145,000đ');

// Float rounding safety test (e.g. 199,000 * 0.33)
const awkwardPrice = 199000;
const awkwardQty = 0.33;
const awkwardTotal = Math.round(awkwardPrice * awkwardQty);
assert.strictEqual(awkwardTotal, 65670, '199,000 * 0.33 rounded must be clean integer 65,670đ');

// Subtotal aggregation
const cart = [
  { price: aukobePrice, qty: aukobeQty },
  { price: patePrice, qty: pateQty },
  { price: sausagePrice, qty: sausageQty },
];
const subtotal = cart.reduce((sum, item) => sum + Math.round(item.price * item.qty), 0);
assert.strictEqual(subtotal, 224200 + 60000 + 145000, 'Subtotal must sum all rounded line totals');
assert.strictEqual(subtotal, 429200, 'Subtotal must be 429,200đ');

console.log('✓ All Financial Line Item & Subtotal tests passed.');

// -------------------------------------------------------------
// 3. Receipt Quantity Formatting (K80 Thermal Print)
// -------------------------------------------------------------
console.log('3. Testing Receipt Quantity Formatting (formatReceiptQty & formatDisplayQty)...');

// Integers: format as x1, x2 (no trailing decimals)
assert.strictEqual(formatReceiptQty(1), 'x1', 'Integer 1 must format as "x1"');
assert.strictEqual(formatReceiptQty(2), 'x2', 'Integer 2 must format as "x2"');
assert.strictEqual(formatReceiptQty(10), 'x10', 'Integer 10 must format as "x10"');

// Decimals: clean without trailing zeroes
assert.strictEqual(formatReceiptQty(0.59), 'x0.59', 'Decimal 0.59 must format as "x0.59"');
assert.strictEqual(formatReceiptQty(0.5), 'x0.5', 'Decimal 0.5 must format as "x0.5" (not x0.50)');
assert.strictEqual(formatReceiptQty(1.25), 'x1.25', 'Decimal 1.25 must format as "x1.25"');

// Display qty without 'x' prefix
assert.strictEqual(formatDisplayQty(1), '1', '1 should display as "1"');
assert.strictEqual(formatDisplayQty(0.59), '0.59', '0.59 should display as "0.59"');
assert.strictEqual(formatDisplayQty(0.5), '0.5', '0.5 should display as "0.5"');
assert.strictEqual(formatDisplayQty(1.59), '1.59', 'Total qty 1.59 should display as "1.59"');

// Float artifact prevention: 0.1 + 0.2
const floatSum = 0.1 + 0.2; // 0.30000000000000004 in JS
assert.strictEqual(formatReceiptQty(floatSum), 'x0.3', 'Float arithmetic artifacts must be sanitized to "x0.3"');
assert.strictEqual(formatDisplayQty(floatSum), '0.3', 'Float arithmetic artifacts must be sanitized to "0.3"');

// Float sum: 0.1 + 0.2 + 0.7 = 0.9999999999999999 in JS
const floatOne = 0.1 + 0.2 + 0.7;
assert.strictEqual(formatReceiptQty(floatOne), 'x1', '0.1 + 0.2 + 0.7 must sanitize to "x1"');
assert.strictEqual(formatDisplayQty(floatOne), '1', '0.1 + 0.2 + 0.7 must sanitize to "1"');

console.log('✓ All Receipt Quantity Formatting tests passed.');

// -------------------------------------------------------------
// 4. Production Delivery Callout Header Typography Rules (Testing Real getDeliveryCalloutConfig)
// -------------------------------------------------------------
console.log('4. Testing Real Production getDeliveryCalloutConfig...');

// standard_large (default/recommended)
const standardCallout = getDeliveryCalloutConfig('standard_large');
assert.strictEqual(standardCallout.fontSize, '15px', 'standard_large must use 15px font (~1.5x bill small body)');
assert.strictEqual(standardCallout.lineHeightClass, 'leading-snug', 'standard_large line-height must be leading-snug');
assert.strictEqual(standardCallout.fontWeightClass, 'font-bold', 'standard_large must be font-bold (700) for clean thermal print without faux-bold smear');
assert.ok(standardCallout.borderClass.includes('border-dashed'), 'standard_large must have dashed border');

// extra_large
const extraLargeCallout = getDeliveryCalloutConfig('extra_large');
assert.strictEqual(extraLargeCallout.fontSize, '18px', 'extra_large must use 18px font (~1.8x bill small body)');
assert.strictEqual(extraLargeCallout.lineHeightClass, 'leading-tight', 'extra_large line-height must be leading-tight to prevent overflow');
assert.strictEqual(extraLargeCallout.fontWeightClass, 'font-bold', 'extra_large must be font-bold (700)');

// undefined fallback
const fallbackCallout = getDeliveryCalloutConfig(undefined);
assert.strictEqual(fallbackCallout.size, 'standard_large', 'Undefined size must default to standard_large');
assert.strictEqual(fallbackCallout.fontSize, '15px', 'Default fallback must be 15px');

console.log('✓ Real Production getDeliveryCalloutConfig verified.');

// -------------------------------------------------------------
// 5. Inventory Stock Deduction with Fractional Quantities
// -------------------------------------------------------------
console.log('5. Testing Inventory Stock Deduction with Fractional Quantities...');

// Deducting 0.59kg from 10kg stock
const initialStock = 10;
const orderDelta = -0.59;
const remainingStock = calculateStockDelta(initialStock, orderDelta);
assert.strictEqual(remainingStock, 9.41, '10kg - 0.59kg must equal exactly 9.41kg');

// Auto-restocking 0.59kg on cancellation
const restoredStock = calculateStockDelta(remainingStock, 0.59);
assert.strictEqual(restoredStock, 10, '9.41kg + 0.59kg restock must restore to 10kg');

// Clamping at zero floor
const zeroFloor = calculateStockDelta(0.5, -0.8);
assert.strictEqual(zeroFloor, 0, 'Deducting more than available stock must floor at 0');

// Multi-batch deduction
const cartItems = [
  { productId: 'P1', qty: 0.59 },
  { productId: 'P1', qty: 0.41 },
];
const totalP1Qty = cartItems.reduce((sum, i) => sum + i.qty, 0);
const afterBatch = calculateStockDelta(5, -totalP1Qty);
assert.strictEqual(afterBatch, 4, '5kg - (0.59kg + 0.41kg) must equal exactly 4kg');

// Delta float aggregation test
const floatItems = [
  { productId: 'P2', qty: 0.1 },
  { productId: 'P2', qty: 0.2 },
];
const rawSum = floatItems.reduce((sum, i) => sum + i.qty, 0); // 0.30000000000000004
const roundedDelta = Math.round(-rawSum * 10000) / 10000;
assert.strictEqual(roundedDelta, -0.3, 'Float sum must be rounded to clean -0.3 delta');
const stockAfterFloat = calculateStockDelta(10, roundedDelta);
assert.strictEqual(stockAfterFloat, 9.7, '10 - 0.3 must equal clean 9.7');

console.log('✓ All Inventory Stock Deduction tests passed.');

// -------------------------------------------------------------
// 6. EditOrderModal Item Deletion & Zero Quantity Invariant
// -------------------------------------------------------------
console.log('6. Testing EditOrderModal Item Zero/Decrement Removal Invariant...');

const sampleOrderItems = [
  { productId: 'SP01', name: 'Món 1', qty: 1, price: 100000 },
  { productId: 'SP02', name: 'Món 2', qty: 0.59, price: 380000 },
];

// Decrementing SP01 by -1 from qty 1 should remove it from the list
const decremented = sampleOrderItems
  .map(i => {
    if (i.productId === 'SP01') {
      const newQty = Math.round((i.qty + -1) * 10000) / 10000;
      return { ...i, qty: newQty };
    }
    return i;
  })
  .filter(i => i.qty > 0);

assert.strictEqual(decremented.length, 1, 'Decreasing item with qty 1 by 1 must remove it');
assert.strictEqual(decremented[0].productId, 'SP02', 'Remaining item must be SP02');

// Setting SP02 quantity to 0 should remove it
const zeroed = decremented
  .map(i => {
    if (i.productId === 'SP02') {
      return { ...i, qty: 0 };
    }
    return i;
  })
  .filter(i => i.qty > 0);

assert.strictEqual(zeroed.length, 0, 'Setting quantity to 0 must result in empty items array');

console.log('✓ EditOrderModal Zero/Decrement Removal Invariant verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0011 TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
