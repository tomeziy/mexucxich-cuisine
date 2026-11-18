// scripts/test_adr0020.js
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import {
  segmentFusedPhone,
  analyzeFusedPhone,
  repairCustomerFusedPhones,
  repairFusedPhonesBatch,
} from '../src/utils/phoneRecovery.ts';
import {
  normalizeAddressList,
  getAllCustomerAddresses,
  isAddressMatching,
  extractIndividualAddresses,
  convertAddressToExtraAddresses,
} from '../src/utils/addressUtils.ts';
import {
  normalizeVietnamesePhone,
  parseCustomersWorkbook,
  buildCustomerExportRows,
  CUSTOMER_HEADER_ALIASES,
  normalizeHeaderKey,
} from '../src/utils/excel.ts';
import {
  extractIndividualPhones,
  auditCustomerData,
  mergeDuplicateCustomers,
  restoreCustomerFromOrderSnapshot,
} from '../src/utils/customerSentinel.ts';
import { scoreCustomer, filterAndRankCustomers } from '../src/utils/customerSearch.ts';
import {
  transformCustomerToDb,
  transformCustomerFromDb,
  safeUpsert,
  isCloudExtraAddressesUnsupported,
  setCloudExtraAddressesUnsupported,
  mergeCustomersWithConflictResolution,
} from '../src/services/supabase.ts';

console.log('--- RUNNING ADR-0020 DETERMINISTIC PHONE RECOVERY & EXTRA ADDRESSES TESTS ---');

// ============================================================================
// 1. All 61 Real Fused Phone Strings from Live Supabase
// ============================================================================
console.log('1. Testing all 61 real fused phone strings from Supabase...');

const ALL_61_FUSED_CASES = [
  ['024625150300903212503', ['02462515030', '0903212503']],
  ['09865668960398233749', ['0986566896', '0398233749']],
  ['09338491860936488483', ['0933849186', '0936488483']],
  ['08490453330369098988', ['0849045333', '0369098988']],
  ['09638891190862316618', ['0963889119', '0862316618']],
  ['09034400560989071379', ['0903440056', '0989071379']],
  ['09160676260938093902', ['0916067626', '0938093902']],
  ['09351855550906005277', ['0935185555', '0906005277']],
  ['09789123150367133042', ['0978912315', '0367133042']],
  ['09126063330827833338', ['0912606333', '0827833338']],
  ['09160655510336221066', ['0916065551', '0336221066']],
  ['08481305660326998959', ['0848130566', '0326998959']],
  ['08526067680965596186', ['0852606768', '0965596186']],
  ['09457868860946341983', ['0945786886', '0946341983']],
  ['09730869870906568466', ['0973086987', '0906568466']],
  ['09845080580328019199', ['0984508058', '0328019199']],
  ['09032982940904840523', ['0903298294', '0904840523']],
  ['09416512250395035258', ['0941651225', '0395035258']],
  ['09767586880986151611', ['0976758688', '0986151611']],
  ['09046809660355916886', ['0904680966', '0355916886']],
  ['09482863930919291533', ['0948286393', '0919291533']],
  ['09857296750833698099', ['0985729675', '0833698099']],
  ['09032285800933274268', ['0903228580', '0933274268']],
  ['09173412340819017954', ['0917341234', '0819017954']],
  ['09885958820932234549', ['0988595882', '0932234549']],
  ['09093986890326683518', ['0909398689', '0326683518']],
  ['09681221120988132525', ['0968122112', '0988132525']],
  ['091534333202438398660', ['0915343332', '02438398660']],
  ['03573701660989404363', ['0357370166', '0989404363']],
  ['09755557960982741868', ['0975555796', '0982741868']],
  ['08692291600986476328', ['0869229160', '0986476328']],
  ['09044477660904446677', ['0904447766', '0904446677']],
  ['09133077860915345305', ['0913307786', '0915345305']],
  ['09490390130857713988', ['0949039013', '0857713988']],
  ['03547717800984731650', ['0354771780', '0984731650']],
  ['09886595540988659553', ['0988659554', '0988659553']],
  ['09128812180915568696', ['0912881218', '0915568696']],
  ['09133975750333205438', ['0913397575', '0333205438']],
  ['09044019150346983509', ['0904401915', '0346983509']],
  ['09125514200978318531', ['0912551420', '0978318531']],
  ['07622536860983170707', ['0762253686', '0983170707']],
  ['09822719650986287196', ['0982271965', '0986287196']],
  ['09830509840913596990', ['0983050984', '0913596990']],
  ['09034454980903449198', ['0903445498', '0903449198']],
  ['09840458090962826819', ['0984045809', '0962826819']],
  ['090329215102438641648', ['0903292151', '02438641648']],
  ['09161046780982591189', ['0916104678', '0982591189']],
  ['09781034680942466979', ['0978103468', '0942466979']],
  ['09661615380978555968', ['0966161538', '0978555968']],
  ['07627531390904936396', ['0762753139', '0904936396']],
  ['09669110210344774975', ['0966911021', '0344774975']],
  ['03872881650589838838', ['0387288165', '0589838838']],
  ['09797915730982362977', ['0979791573', '0982362977']],
  ['03831746320943203883', ['0383174632', '0943203883']],
  ['09133933970988742231', ['0913393397', '0988742231']],
  ['09154109600941601644', ['0915410960', '0941601644']],
  ['09181762220366712868', ['0918176222', '0366712868']],
  ['09045075590904507559', ['0904507559']], // duplicate collapses to 1
  ['09021761430773303626', ['0902176143', '0773303626']],
  ['09132424310966342889', ['0913242431', '0966342889']],
  ['09798419930983248575', ['0979841993', '0983248575']],
];

assert.strictEqual(ALL_61_FUSED_CASES.length, 61, 'Must test all 61 real fused cases');

for (const [fused, expected] of ALL_61_FUSED_CASES) {
  assert.deepStrictEqual(segmentFusedPhone(fused), expected, `segmentFusedPhone failed on ${fused}`);
  assert.strictEqual(
    normalizeVietnamesePhone(fused),
    expected.join(' / '),
    `normalizeVietnamesePhone failed on ${fused}`
  );
  assert.deepStrictEqual(
    extractIndividualPhones(fused),
    expected,
    `extractIndividualPhones failed on ${fused}`
  );
}

console.log('✓ All 61 real fused phone strings split deterministically and identically.');

// ============================================================================
// 2. Phone Recovery Edge Cases, Rejection & Batch Repair
// ============================================================================
console.log('2. Testing phone recovery edge cases & batch repair...');

assert.strictEqual(segmentFusedPhone(''), null);
assert.strictEqual(segmentFusedPhone('0904047976'), null); // single mobile
assert.strictEqual(segmentFusedPhone('02438641648'), null); // single landline
assert.strictEqual(segmentFusedPhone('01234567890123456789'), null); // invalid prefix 01
assert.strictEqual(segmentFusedPhone('09032921510243864164'), null); // 20 digits with truncated landline

// 3-number fused phone
assert.deepStrictEqual(
  segmentFusedPhone('0903111222091234567802438641648'),
  ['0903111222', '0912345678', '02438641648']
);

const invalidAnalysis = analyzeFusedPhone('01234567890987654321');
assert.strictEqual(invalidAnalysis.isFused, true);
assert.strictEqual(invalidAnalysis.status, 'invalid');

const intlAnalysis = analyzeFusedPhone('8490329215102438641648');
assert.strictEqual(intlAnalysis.isFused, true);
assert.strictEqual(intlAnalysis.status, 'ok');
assert.deepStrictEqual(intlAnalysis.phones, ['0903292151', '02438641648']);

const batchInput = [
  { id: 'C1', name: 'Do Huyen Anh', phone: '090329215102438641648', address: 'HN', debt: 0 },
  { id: 'C2', name: 'Van Anh Nguyen', phone: '09045075590904507559', address: 'HN', debt: 0 },
  { id: 'C3', name: 'Clean Customer', phone: '0904047976', address: 'HN', debt: 0 },
  { id: 'C4', name: 'Invalid Fused', phone: '01234567890987654321', address: 'HN', debt: 0 },
  { id: 'C5', name: 'Three Phones', phone: '0903111222091234567802438641648', address: 'HN', debt: 0 },
];

const batchRes = repairFusedPhonesBatch(batchInput, '2026-11-18T10:00:00Z');
assert.strictEqual(batchRes.changedCustomers.length, 3, 'Only C1, C2, C5 should change');
assert.strictEqual(batchRes.customers[0].phone, '0903292151');
assert.strictEqual(batchRes.customers[0].phone2, '02438641648');
assert.strictEqual(batchRes.customers[1].phone, '0904507559');
assert.strictEqual(batchRes.customers[1].phone2, undefined);
assert.strictEqual(batchRes.customers[2].phone, '0904047976');
assert.strictEqual(batchRes.customers[3].phone, '01234567890987654321', 'Invalid fused must be left untouched');
assert.strictEqual(batchRes.customers[4].phone, '0903111222');
assert.strictEqual(batchRes.customers[4].phone2, '0912345678 / 02438641648');

// Verify Sentinel no longer flags repaired C1 & C2 as multiPhoneAnomalies, while C4 remains flagged
const sentinelAfterPhoneRepair = auditCustomerData(batchRes.customers, []);
assert.strictEqual(sentinelAfterPhoneRepair.multiPhoneAnomalies.length, 2, 'C4 (invalid >11 digits) + C5 (3 numbers) remain visible');
assert.ok(!sentinelAfterPhoneRepair.multiPhoneAnomalies.some(a => a.customer.id === 'C1'));
assert.ok(!sentinelAfterPhoneRepair.multiPhoneAnomalies.some(a => a.customer.id === 'C2'));

console.log('✓ Phone recovery edge cases & batch repair verified.');

// ============================================================================
// 3. Smart Address Splitter: House-Number Protection vs Real Multi-Address
// ============================================================================
console.log('3. Testing house-number protection & multi-address extraction...');

const HOUSE_NUMBER_FALSE_POSITIVES = [
  '8 ngách 40/26 Kim Giang',
  '8 ngách 40 / 26 Kim Giang',
  'Số 8 ngõ 40 / 26 Kim Giang',
  'P516/ 16 ngách 48 ngõ 420 Kim Giang 0833008585',
  '4/7/188 Vương Thừa Vũ',
  'Số 19 Hẻm 75/69/25 Phú Diễn, Quận Bắc Từ Liêm, TP Hà Nội',
  '914/k3 Kpark Khu đô thị Văn Phú, Hà Đông',
  '14/222F ngõ 260 Đội Cấn',
  'Lô C1 ngõ 10 Đặng Thai mai, Khu 1C/106',
  'P512 / CT5B mễ trì hạ, nam từ liêm',
  '30//67A Trương Định',
  '79 ngõ 59 Hoàng Cầu (mặt vườn hoa 1/6)',
  'Chung Cư Vườn đào 689 Lạc Long Quân\r\nPhú Thượng',
  'N02 LB - P1903/2 Trần Hưng Đạo',
  '\\ A4 tòa nhà tân hoàng minh, 66 Nguyễn Văn Huyên',
];

for (const addr of HOUSE_NUMBER_FALSE_POSITIVES) {
  const extracted = extractIndividualAddresses(addr);
  assert.strictEqual(extracted.length, 1, `House-number address MUST NOT split: "${addr}" -> ${JSON.stringify(extracted)}`);
}

const REAL_MULTI_ADDRESS_CASES = [
  ['1 Trần Huy Liệu/ 83 Hào Nam', ['1 Trần Huy Liệu', '83 Hào Nam']],
  ['19 Lý Thường Kiệt/ A1/78 Trung Tiền (Khâm Thiên)', ['19 Lý Thường Kiệt', 'A1/78 Trung Tiền (Khâm Thiên)']],
  ['8/35 Kim Mã Thượng/ 35/260 Đội Cấn', ['8/35 Kim Mã Thượng', '35/260 Đội Cấn']],
  ['1 Trần Huy Liệu/ 4/7/188 Vương Thừa Vũ', ['1 Trần Huy Liệu', '4/7/188 Vương Thừa Vũ']],
  ['18/121 Chùa Láng / Đại Học Ngoại Thương - 91 Chùa láng', ['18/121 Chùa Láng', 'Đại Học Ngoại Thương - 91 Chùa láng']],
  ['53 Quang Trung/38 LK5 Khu đô thị Đại Thanh', ['53 Quang Trung', '38 LK5 Khu đô thị Đại Thanh']],
  ['số 50 vườn hoa 1/6/ 200 Nguyễn Sơn', ['số 50 vườn hoa 1/6', '200 Nguyễn Sơn']],
  ['số 6 ngõ 75/5/2 Ngọc Thụy/ 66 Trần Hưng Đạo', ['số 6 ngõ 75/5/2 Ngọc Thụy', '66 Trần Hưng Đạo']],
  [
    'K11 Khu đô thị Việt Hưng/ Văn Phòng Bamboo Airway Tầng 1 sân golf Long biên, khu 918 Phúc đồng/12 Hoàng Hoa Thám',
    [
      'K11 Khu đô thị Việt Hưng',
      'Văn Phòng Bamboo Airway Tầng 1 sân golf Long biên, khu 918 Phúc đồng',
      '12 Hoàng Hoa Thám',
    ],
  ],
  ['91 Nguyễn Chí Thanh, sảnh A tòa M3-M4/90 Ngõ Trung Tả', ['91 Nguyễn Chí Thanh, sảnh A tòa M3-M4', '90 Ngõ Trung Tả']],
  ['Thapd đông; chung cư hancorp plaza 72D trần đăng ninh', ['Thapd đông', 'chung cư hancorp plaza 72D trần đăng ninh']],
];

for (const [raw, expected] of REAL_MULTI_ADDRESS_CASES) {
  assert.deepStrictEqual(extractIndividualAddresses(raw), expected, `Failed splitting real multi-address: ${raw}`);
}

// Verify auditCustomerData does NOT flag false-positive house numbers
const houseNumberCustomers = HOUSE_NUMBER_FALSE_POSITIVES.map((addr, idx) => ({
  id: `HN_${idx}`,
  name: `Khách ${idx}`,
  phone: `090000000${idx}`,
  address: addr,
  debt: 0,
}));
const auditHouseNumbers = auditCustomerData(houseNumberCustomers, []);
assert.strictEqual(
  auditHouseNumbers.multiAddressAnomalies.length,
  0,
  'House-number addresses must produce 0 multiAddressAnomalies'
);

console.log('✓ House-number false-positive protection & multi-address splitting verified.');

// ============================================================================
// 4. Extra Addresses Normalization, Sentinel Conversion, Discrepancy & Merge
// ============================================================================
console.log('4. Testing extraAddresses normalization, Sentinel conversion, discrepancy suppression & merge...');

// 4.1 Normalization & primary promotion
const norm1 = normalizeAddressList('1 Trần Huy Liệu', ['  83 Hào Nam  ', '1 trần huy liệu', '', '83 Hào Nam']);
assert.strictEqual(norm1.address, '1 Trần Huy Liệu');
assert.deepStrictEqual(norm1.extraAddresses, ['83 Hào Nam']);

const normPromote = normalizeAddressList('', ['83 Hào Nam', '10 Tôn Thất Thuyết']);
assert.strictEqual(normPromote.address, '83 Hào Nam');
assert.deepStrictEqual(normPromote.extraAddresses, ['10 Tôn Thất Thuyết']);

// 4.2 Convert multi-address into primary + extraAddresses on SAME customer
const multiAddrCust = {
  id: 'KH_MULTI_ADDR',
  name: 'Minh Ngọc',
  phone: '0904401915',
  address: '21 ngõ 198 Trần Cung/ 35 Trần Thái Tông',
  debt: 0,
};
const converted = convertAddressToExtraAddresses(multiAddrCust, '2026-11-18T10:00:00Z');
assert.strictEqual(converted.changed, true);
assert.strictEqual(converted.customer.id, 'KH_MULTI_ADDR', 'Must stay the same customer');
assert.strictEqual(converted.customer.address, '21 ngõ 198 Trần Cung');
assert.deepStrictEqual(converted.customer.extraAddresses, ['35 Trần Thái Tông']);

// 4.3 Search matches extraAddresses at same tier as primary address & multi-token Name + ExtraAddress
const primaryEquivCust = {
  id: 'KH_PRIMARY_EQUIV',
  name: 'Minh Ngọc',
  phone: '0904401915',
  address: '35 Trần Thái Tông',
  debt: 0,
};
assert.strictEqual(
  scoreCustomer(converted.customer, 'Tong'),
  40,
  'Single-token extra address match must score 40 (Tier 10)'
);
assert.strictEqual(
  scoreCustomer(converted.customer, 'Trần Thái Tông'),
  scoreCustomer(primaryEquivCust, 'Trần Thái Tông'),
  'Extra address match must score identically to primary address match'
);
const scoreNamePlusExtra = scoreCustomer(converted.customer, 'Minh Ngoc Thai Tong');
assert.ok(scoreNamePlusExtra > 0, 'Multi-token name + extra address search must match');

// 4.4 Historical order using extraAddresses MUST NOT trigger "Lệch với đơn cũ"
const orderAtOffice = {
  id: 'ORD_OFFICE_1',
  createdAt: '2026-11-15T10:00:00Z',
  customerId: converted.customer.id,
  customerName: converted.customer.name,
  customerPhone: converted.customer.phone,
  customerAddress: '35 Trần Thái Tông',
  orderType: 'delivery',
  status: 'completed',
  items: [],
  subtotal: 200000,
  discountType: 'cash',
  discountValue: 0,
  discountAmount: 0,
  shippingFee: 0,
  total: 200000,
  paymentMethod: 'cash',
  paidAmount: 200000,
  debtAmount: 0,
};
const auditWithExtraOrder = auditCustomerData([converted.customer], [orderAtOffice]);
assert.strictEqual(auditWithExtraOrder.orderDiscrepancies.length, 0, 'Order matching extraAddresses must not trigger discrepancy');
assert.strictEqual(auditWithExtraOrder.multiAddressAnomalies.length, 0, 'Converted customer must not trigger multiAddressAnomalies');

// 4.5 Merge customers combines both address lists without duplicates
const mergePrimary = {
  id: 'KH_M1',
  name: 'Chị Hương',
  phone: '0912345678',
  address: '10 Hàng Gai',
  extraAddresses: ['25 Tràng Thi'],
  debt: 100000,
  totalSpent: 500000,
  orderCount: 2,
};
const mergeDup = {
  id: 'KH_M2',
  name: 'Chị Hương (CQ)',
  phone: '0988777666',
  address: '25 Tràng Thi', // duplicate of primary extra
  extraAddresses: ['83 Hào Nam'],
  debt: 50000,
  totalSpent: 200000,
  orderCount: 1,
};
const mergeRes = mergeDuplicateCustomers(mergePrimary, mergeDup, []);
assert.strictEqual(mergeRes.mergedCustomer.address, '10 Hàng Gai');
assert.deepStrictEqual(mergeRes.mergedCustomer.extraAddresses, ['25 Tràng Thi', '83 Hào Nam']);

// 4.6 POS delivery address chip selection invariant
function simulatePosDeliveryAddressSelection(customer, idx) {
  const all = getAllCustomerAddresses(customer);
  return all[idx] || customer.address;
}
assert.strictEqual(simulatePosDeliveryAddressSelection(converted.customer, 0), '21 ngõ 198 Trần Cung');
assert.strictEqual(simulatePosDeliveryAddressSelection(converted.customer, 1), '35 Trần Thái Tông');
assert.strictEqual(isAddressMatching('35 trần thái tông', '  35  Trần Thái Tông '), true);

// 4.7 Restore from order snapshot preserves unrelated extraAddresses
const restoredCust = restoreCustomerFromOrderSnapshot(converted.customer, {
  ...orderAtOffice,
  customerAddress: '35 Trần Thái Tông',
});
assert.strictEqual(restoredCust.updatedCustomer.address, '35 Trần Thái Tông');
assert.strictEqual(restoredCust.updatedCustomer.extraAddresses, undefined);

console.log('✓ Extra addresses normalization, Sentinel, search, discrepancy, merge & POS verified.');

// ============================================================================
// 5. Excel Import / Export Round-Trip with Địa chỉ 2, Địa chỉ 3
// ============================================================================
console.log('5. Testing Excel import/export round-trip with Địa chỉ 2, Địa chỉ 3...');

assert.ok(CUSTOMER_HEADER_ALIASES.address2.includes(normalizeHeaderKey('Địa chỉ 2')));
assert.ok(CUSTOMER_HEADER_ALIASES.address3.includes(normalizeHeaderKey('Địa chỉ 3')));

const exportCustomers = [
  {
    id: 'KH_EX_1',
    name: 'Chị Mai',
    phone: '0904047976',
    phone2: '0988123456',
    address: '12 Tràng Thi',
    extraAddresses: ['83 Hào Nam', '10 Tôn Thất Thuyết'],
    debt: 150000,
    orderCount: 3,
    totalSpent: 900000,
  },
  {
    id: 'KH_EX_2',
    name: 'Anh Tuấn',
    phone: '0912345678',
    address: '50 Kim Mã',
    debt: 0,
    orderCount: 1,
    totalSpent: 200000,
  },
];

const exportRows = buildCustomerExportRows(exportCustomers);
assert.strictEqual(exportRows[0]['Địa Chỉ'], '12 Tràng Thi');
assert.strictEqual(exportRows[0]['Địa Chỉ 2'], '83 Hào Nam');
assert.strictEqual(exportRows[0]['Địa Chỉ 3'], '10 Tôn Thất Thuyết');
assert.strictEqual(exportRows[1]['Địa Chỉ 2'], '');

const ws = XLSX.utils.json_to_sheet(exportRows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Khách Hàng');
const parsedBack = parseCustomersWorkbook(wb);

assert.strictEqual(parsedBack.length, 2);
assert.strictEqual(parsedBack[0].address, '12 Tràng Thi');
assert.deepStrictEqual(parsedBack[0].extraAddresses, ['83 Hào Nam', '10 Tôn Thất Thuyết']);
assert.strictEqual(parsedBack[1].address, '50 Kim Mã');
assert.strictEqual(parsedBack[1].extraAddresses, undefined);

console.log('✓ Excel import/export round-trip with extra addresses verified.');

// ============================================================================
// 6. Supabase Backward Compatibility, Generalized safeUpsert & Conflict Guard
// ============================================================================
console.log('6. Testing Supabase backward-compatible serialization & generalized safeUpsert...');

// 6.1 Round-trip serialization
const dbRow = transformCustomerToDb(exportCustomers[0]);
assert.deepStrictEqual(dbRow.extra_addresses, ['83 Hào Nam', '10 Tôn Thất Thuyết']);
const fromDb = transformCustomerFromDb(dbRow);
assert.deepStrictEqual(fromDb.extraAddresses, ['83 Hào Nam', '10 Tôn Thất Thuyết']);

// 6.2 Legacy row without extra_addresses column
const legacyRow = {
  id: 'KH_LEG',
  name: 'Legacy',
  phone: '0904047976',
  address: '12 Tràng Thi',
  debt: 0,
  created_at: '2026-10-12T08:39:32Z',
};
const fromLegacy = transformCustomerFromDb(legacyRow);
assert.strictEqual(fromLegacy.extraAddresses, undefined);

// 6.3 safeUpsert iteratively strips BOTH extra_addresses AND updated_at when missing on Cloud
let upsertPayloads = [];
const mockClientMissingTwoCols = {
  from: () => ({
    upsert: async (rows) => {
      upsertPayloads.push(rows);
      const sample = Array.isArray(rows) ? rows[0] : rows;
      if ('extra_addresses' in sample) {
        return {
          data: null,
          error: {
            code: 'PGRST204',
            message: "Could not find the 'extra_addresses' column of 'customers' in the schema cache",
          },
        };
      }
      if ('updated_at' in sample) {
        return {
          data: null,
          error: {
            code: 'PGRST204',
            message: "Could not find the 'updated_at' column of 'customers' in the schema cache",
          },
        };
      }
      return { data: rows, error: null };
    },
  }),
};

setCloudExtraAddressesUnsupported(false);
const upsertRes = await safeUpsert(mockClientMissingTwoCols, 'customers', [dbRow]);
assert.strictEqual(upsertRes.error, null, 'safeUpsert must succeed after stripping missing columns');
assert.strictEqual(upsertRes.stripped, true);
assert.deepStrictEqual(upsertRes.strippedColumns, ['extra_addresses', 'updated_at']);
assert.strictEqual(upsertPayloads.length, 3);
assert.strictEqual(isCloudExtraAddressesUnsupported(), true, 'Must flag extra_addresses unsupported when stripped');

// Reset flag when column becomes available
const mockClientModern = {
  from: () => ({
    upsert: async (rows) => ({ data: rows, error: null }),
  }),
};
const modernRes = await safeUpsert(mockClientModern, 'customers', [dbRow]);
assert.strictEqual(modernRes.error, null);
assert.strictEqual(modernRes.stripped, false);
assert.strictEqual(isCloudExtraAddressesUnsupported(), false, 'Flag must clear once extra_addresses upsert succeeds');

// 6.4 Conflict resolution preserves local extraAddresses when cloud lacks extra_addresses column
const localCustWithExtra = {
  id: 'KH_SYNC_1',
  name: 'Chị Lan',
  phone: '0904047976',
  address: '12 Tràng Thi',
  extraAddresses: ['83 Hào Nam'],
  debt: 0,
  createdAt: '2026-10-12T08:39:32Z',
  updatedAt: '2026-10-12T08:39:32Z', // same timestamp as cloud
};
const cloudCustWithoutCol = {
  id: 'KH_SYNC_1',
  name: 'Chị Lan',
  phone: '0904047976',
  address: '12 Tràng Thi',
  debt: 0,
  createdAt: '2026-10-12T08:39:32Z',
  updatedAt: '2026-10-12T08:39:32Z',
};
const mergeSyncRes = mergeCustomersWithConflictResolution([localCustWithExtra], [cloudCustWithoutCol], {
  preserveLocalExtraAddressesWhenCloudLacksColumn: true,
});
assert.deepStrictEqual(
  mergeSyncRes.merged[0].extraAddresses,
  ['83 Hào Nam'],
  'Local extraAddresses must not be wiped when cloud schema lacks extra_addresses'
);

console.log('✓ Supabase backward-compatible serialization, safeUpsert & conflict guard verified.');

// ============================================================================
// 7. UI Integration Contract Checks
// ============================================================================
console.log('7. Checking UI integration points...');
const posPage = fs.readFileSync(path.resolve('src/pages/PosPage.tsx'), 'utf8');
const customersPage = fs.readFileSync(path.resolve('src/pages/CustomersPage.tsx'), 'utf8');
const sentinelModal = fs.readFileSync(path.resolve('src/components/customers/CustomerSentinelModal.tsx'), 'utf8');
const schemaSql = fs.readFileSync(path.resolve('supabase_schema.sql'), 'utf8');

assert.ok(posPage.includes('Đ/c {idx + 1}'), 'PosPage must render Đ/c 1, Đ/c 2... chips');
assert.ok(customersPage.includes('AddressListEditor'), 'CustomersPage must use AddressListEditor');
assert.ok(customersPage.includes('chưa đồng bộ Cloud'), 'CustomersPage must show cloud pending notice when column missing');
assert.ok(sentinelModal.includes('Chấp nhận SĐT 1 & 2'), 'Sentinel must offer 1-click phone split accept');
assert.ok(sentinelModal.includes('repairCustomerFusedPhones'), 'Sentinel must gate 1-click phone accept on repairCustomerFusedPhones');
assert.ok(sentinelModal.includes('Chuyển thành địa chỉ phụ'), 'Sentinel must offer primary move-to-extra-address action');
assert.ok(schemaSql.includes('extra_addresses jsonb'), 'supabase_schema.sql must define extra_addresses');

console.log('✓ UI integration points & schema SQL verified.');
console.log('================================================================');
console.log('🎉 ALL ADR-0020 PHONE RECOVERY & EXTRA ADDRESSES TESTS PASSED!');
console.log('================================================================');
