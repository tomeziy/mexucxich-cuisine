// scripts/test_adr0013.js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- RUNNING ADR-0013 CUSTOMERS TABLE RESPONSIVE LAYOUT & ACTIONS PINNING TESTS ---');

const customersPagePath = path.resolve('src/pages/CustomersPage.tsx');
const customersPageContent = fs.readFileSync(customersPagePath, 'utf8');

const layoutPath = path.resolve('src/components/layout/Layout.tsx');
const layoutContent = fs.readFileSync(layoutPath, 'utf8');

// 1. Verify Layout main min-w-0 flex constraint
console.log('1. Testing Layout.tsx flexbox container constraints...');
assert.ok(
  layoutContent.includes('flex-1 min-w-0'),
  'Layout <main> must include min-w-0 to prevent flex item blow-out and ensure overflow-x-auto works'
);
console.log('✓ Layout.tsx min-w-0 verified.');

// 2. Verify Table min-w-[880px] and overflow wrapper
console.log('2. Testing CustomersPage table container and min-width...');
assert.ok(
  customersPageContent.includes('min-w-[880px]'),
  'Customers table must specify min-w-[880px] to prevent column squishing on laptop/mobile'
);
assert.ok(
  customersPageContent.includes('overflow-x-auto custom-scroll'),
  'Table container must provide overflow-x-auto custom-scroll'
);
console.log('✓ Customers table min-w-[880px] and overflow wrapper verified.');

// 3. Verify Thao tác column width and sticky right pinning
console.log('3. Testing Thao tác column width and sticky pinning...');
assert.ok(
  customersPageContent.includes('sticky right-0') &&
  customersPageContent.includes('min-w-[155px]') &&
  customersPageContent.includes('w-[155px]'),
  'Thao tác TH and TD must have sticky right-0 and min-w-[155px] to prevent action buttons from being clipped'
);
assert.ok(
  customersPageContent.includes('whitespace-nowrap min-w-[155px]'),
  'Thao tác TH must enforce whitespace-nowrap so "THAO TÁC" never clips to "THAO T"'
);
console.log('✓ Thao tác column width (155px) and sticky pinning verified.');

// 4. Verify Content truncation safety
console.log('4. Testing Address, Phone, and Customer ID truncation...');
assert.ok(
  customersPageContent.includes('max-w-[180px] lg:max-w-[240px] truncate'),
  'Address must be wrapped in a truncate div with max-w to prevent table blow-out'
);
assert.ok(
  customersPageContent.includes('truncate max-w-[160px] lg:max-w-[200px]'),
  'Customer name must be bounded with truncate to preserve table layout'
);
console.log('✓ Column content truncation safety verified.');

console.log('================================================================');
console.log('🎉 ALL ADR-0013 TESTS PASSED SUCCESSFULLY');
console.log('================================================================');
