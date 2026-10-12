import assert from 'node:assert';

function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeHeaderKey(header) {
  if (!header) return '';
  return removeVietnameseTones(String(header).toLowerCase())
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

const PRODUCT_HEADER_ALIASES = {
  name: [
    'tensanpham', 'tenmonan', 'tenmon', 'tenhang', 'tenhanghoa',
    'mathang', 'sanpham', 'monan', 'hanghoa', 'name', 'ten'
  ],
  category: [
    'danhmuc', 'nhomhang', 'nhom', 'category', 'loaihang', 'loai', 'nhomsanpham'
  ],
  unit: [
    'donvi', 'donvitinh', 'dvt', 'unit', 'quycach'
  ],
  cost: [
    'giavon', 'gianhap', 'giamua', 'cost', 'giagoc'
  ],
  price: [
    'giaban', 'dongia', 'giale', 'giabanle', 'gia', 'price', 'giatien'
  ],
  stock: [
    'tonkho', 'soluong', 'ton', 'stock', 'qty', 'sl', 'soluongton', 'soluongtonkho'
  ],
};

const CUSTOMER_HEADER_ALIASES = {
  name: [
    'tenkhachhang', 'tenkhach', 'khachhang', 'hovaten', 'hoten',
    'name', 'ten', 'khach', 'nguoimua', 'nguoilienhe'
  ],
  phone: [
    'sodienthoai', 'sdt', 'dienthoai', 'phone', 'tel', 'didong', 'sodt', 'dienthoaididong', 'sdtlienhe'
  ],
  address: [
    'diachi', 'diachigiaohang', 'address', 'noio', 'dc', 'diachinhanhang'
  ],
  debt: [
    'dunobandau', 'duno', 'congno', 'nocu', 'tienno', 'debt',
    'sono', 'no', 'tienco', 'nohientai', 'dunohientai', 'tongno', 'conno'
  ],
};

function parseVietnameseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.max(0, value);
  }
  let str = String(value).trim().toLowerCase();
  str = str.replace(/vnd|vnđ|đồng|dong|đ/g, '').trim();
  if (!str) return 0;

  const hasK = str.endsWith('k');
  if (hasK) {
    str = str.slice(0, -1).trim();
  }

  str = str.replace(/[^\d.,]/g, '');
  if (!str) return 0;

  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/,/g, '');
    } else if (parts.length === 2 && parts[1].length !== 3) {
      str = str.replace(',', '.');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (hasK) num *= 1000;
  return Math.max(0, num);
}

function normalizeVietnamesePhone(phone) {
  if (phone === null || phone === undefined) return '';
  let str = String(phone).replace(/[^0-9+]/g, '').trim();
  if (!str) return '';

  if (str === '0' || /^0+$/.test(str)) {
    return '';
  }

  if (str.startsWith('+84')) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('84') && str.length >= 10) {
    str = '0' + str.slice(2);
  }

  if (str.length === 9 && !str.startsWith('0')) {
    str = '0' + str;
  }

  return str;
}

function matchField(header, aliasMap) {
  const norm = normalizeHeaderKey(header);
  for (const [k, aliases] of Object.entries(aliasMap)) {
    if (aliases.includes(norm)) return k;
  }
  return null;
}

function findHeaderRowInSheet(sheetRows, aliasMap, primaryRequiredField) {
  const maxScanRows = Math.min(sheetRows.length, 11);
  let bestResult = null;
  let maxMatchedCount = 0;

  for (let r = 0; r < maxScanRows; r++) {
    const row = sheetRows[r];
    if (!Array.isArray(row)) continue;
    const colMap = new Map();
    const mappedFields = new Set();
    let hasRequiredField = false;

    row.forEach((cell, colIdx) => {
      const matched = matchField(cell, aliasMap);
      if (matched && !mappedFields.has(matched)) {
        mappedFields.add(matched);
        colMap.set(colIdx, matched);
        if (matched === primaryRequiredField) {
          hasRequiredField = true;
        }
      }
    });

    if (hasRequiredField && colMap.size > maxMatchedCount) {
      maxMatchedCount = colMap.size;
      bestResult = {
        headerRowIndex: r,
        columnMap: colMap,
      };
    }
  }
  return bestResult;
}

console.log('--- RUNNING EXTENSIVE ADR-0007 UNIT TESTS ---');

// 1. Currency & Number Parsing Edge Cases
assert.strictEqual(parseVietnameseNumber('130.000'), 130000);
assert.strictEqual(parseVietnameseNumber('130.000đ'), 130000);
assert.strictEqual(parseVietnameseNumber('130.000 đ'), 130000);
assert.strictEqual(parseVietnameseNumber('130,000 VNĐ'), 130000);
assert.strictEqual(parseVietnameseNumber('130.000 đồng'), 130000);
assert.strictEqual(parseVietnameseNumber('1.300.000'), 1300000);
assert.strictEqual(parseVietnameseNumber('50k'), 50000);
assert.strictEqual(parseVietnameseNumber('2.5k'), 2500);
assert.strictEqual(parseVietnameseNumber('2,5k'), 2500);
assert.strictEqual(parseVietnameseNumber('1.5'), 1.5);
assert.strictEqual(parseVietnameseNumber('1,5'), 1.5);
assert.strictEqual(parseVietnameseNumber('130.000,50'), 130000.5);
assert.strictEqual(parseVietnameseNumber('0'), 0);
assert.strictEqual(parseVietnameseNumber(''), 0);
assert.strictEqual(parseVietnameseNumber(null), 0);
assert.strictEqual(parseVietnameseNumber(undefined), 0);
assert.strictEqual(parseVietnameseNumber('text only'), 0);
console.log('✓ All 17 currency & number tests passed');

// 2. Phone Normalization Edge Cases
assert.strictEqual(normalizeVietnamesePhone('904047976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('+84904047976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('84904047976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('0904 047 976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('090-404-7976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('(090) 404.7976'), '0904047976');
assert.strictEqual(normalizeVietnamesePhone('0988123456'), '0988123456');
assert.strictEqual(normalizeVietnamesePhone('0351234567'), '0351234567');
assert.strictEqual(normalizeVietnamesePhone('351234567'), '0351234567');
assert.strictEqual(normalizeVietnamesePhone('0791234567'), '0791234567');
assert.strictEqual(normalizeVietnamesePhone('791234567'), '0791234567');
assert.strictEqual(normalizeVietnamesePhone('0861234567'), '0861234567');
assert.strictEqual(normalizeVietnamesePhone('861234567'), '0861234567');
assert.strictEqual(normalizeVietnamesePhone('212345678'), '0212345678');
assert.strictEqual(normalizeVietnamesePhone(''), '');
assert.strictEqual(normalizeVietnamesePhone(null), '');
assert.strictEqual(normalizeVietnamesePhone(undefined), '');
assert.strictEqual(normalizeVietnamesePhone('0'), '');
assert.strictEqual(normalizeVietnamesePhone(0), '');
assert.strictEqual(normalizeVietnamesePhone('000'), '');
console.log('✓ All 20 phone normalization tests passed');

// 3. Header Fuzzy Matching Edge Cases (Products & Customers)
assert.strictEqual(matchField('Tên sản phẩm', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên món ăn', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên món', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên hàng hóa', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Mặt hàng', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Sản phẩm', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Hàng hóa', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Đơn giá', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá bán', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá bán lẻ', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá tiền', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá vốn', PRODUCT_HEADER_ALIASES), 'cost');
assert.strictEqual(matchField('Giá nhập', PRODUCT_HEADER_ALIASES), 'cost');
assert.strictEqual(matchField('Tồn kho', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Số lượng', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Số lượng tồn', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Số lượng tồn kho', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Đơn vị tính', PRODUCT_HEADER_ALIASES), 'unit');
assert.strictEqual(matchField('ĐVT', PRODUCT_HEADER_ALIASES), 'unit');
assert.strictEqual(matchField('Quy cách', PRODUCT_HEADER_ALIASES), 'unit');
assert.strictEqual(matchField('Danh mục', PRODUCT_HEADER_ALIASES), 'category');
assert.strictEqual(matchField('Nhóm hàng', PRODUCT_HEADER_ALIASES), 'category');
assert.strictEqual(matchField('Nhóm sản phẩm', PRODUCT_HEADER_ALIASES), 'category');

assert.strictEqual(matchField('Tên khách hàng (*)', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên khách', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Họ và tên', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Người mua', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Người liên hệ', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Số điện thoại', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('SĐT', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Điện thoại', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Số ĐT', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Điện thoại di động', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('SĐT liên hệ', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Địa chỉ', CUSTOMER_HEADER_ALIASES), 'address');
assert.strictEqual(matchField('Địa chỉ giao hàng', CUSTOMER_HEADER_ALIASES), 'address');
assert.strictEqual(matchField('Địa chỉ nhận hàng', CUSTOMER_HEADER_ALIASES), 'address');
assert.strictEqual(matchField('Dư nợ ban đầu', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Dư nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Công nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Nợ cũ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Số nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Nợ hiện tại', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Dư nợ hiện tại', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Tổng nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Còn nợ', CUSTOMER_HEADER_ALIASES), 'debt');
console.log('✓ All 46 fuzzy header alias tests passed');

// 4. Best Header Row Detection Test (skipping title rows with few matches)
const mockSheet = [
  ['BẢNG KÊ SẢN PHẨM CỬA HÀNG ME XÚC XÍCH', null, null], // Row 0: might match 'sanpham' (1 column)
  ['Ngày tạo: 12/10/2026', 'Người lập: Tung Nguyen'],   // Row 1: no matches
  ['STT', 'Mặt hàng', 'Nhóm hàng', 'ĐVT', 'Giá vốn', 'Giá bán lẻ', 'Tồn kho'], // Row 2: matches 6 columns!
  [1, 'Xúc xích nướng lu', 'Xúc xích', 'Cây', 12000, 20000, 50],
];
const scanResult = findHeaderRowInSheet(mockSheet, PRODUCT_HEADER_ALIASES, 'name');
assert(scanResult !== null, 'Scan result should not be null');
assert.strictEqual(scanResult.headerRowIndex, 2, 'Should pick Row 2 as the header row because it has 6 matches, not Row 0');
assert.strictEqual(scanResult.columnMap.size, 6, 'Should detect 6 recognized product columns');

// 4b. Header row with duplicate aliases (ensures first column wins and doesn't map twice)
const mockDuplicateHeaderSheet = [
  ['Tên hàng', 'Mặt hàng', 'Giá bán', 'Đơn vị tính'],
  ['Xúc xích Đức', '', 120000, 'Gói'],
];
const dupScanResult = findHeaderRowInSheet(mockDuplicateHeaderSheet, PRODUCT_HEADER_ALIASES, 'name');
assert(dupScanResult !== null, 'Scan result should not be null');
assert.strictEqual(dupScanResult.columnMap.get(0), 'name', 'Column 0 should map to name');
assert.strictEqual(dupScanResult.columnMap.has(1), false, 'Column 1 should NOT map to name because name is already mapped');
assert.strictEqual(dupScanResult.columnMap.size, 3, 'Should only map 3 distinct fields (name, price, unit)');
console.log('✓ Best header row selection and duplicate column protection tests passed');

// 5. Intra-file Product Aggregation Simulation Test
const existingProducts = [
  { id: 'p1', name: 'Xúc xích phô mai', stock: 10, price: 25000, cost: 15000, unit: 'Cây', category: 'Xúc xích' }
];

const mockProductRows = [
  // Two duplicate rows for existing product (both accumulate)
  { isDuplicate: true, existingProduct: existingProducts[0], action: 'accumulate', name: 'Xúc xích phô mai', stock: 5, price: 25000, cost: 15000, unit: 'Cây', category: 'Xúc xích' },
  { isDuplicate: true, existingProduct: existingProducts[0], action: 'accumulate', name: 'Xúc xích phô mai', stock: 15, price: 25000, cost: 15000, unit: 'Cây', category: 'Xúc xích' },
  // Two duplicate rows for NEW product (should aggregate within file)
  { isDuplicate: false, existingProduct: null, action: 'accumulate', name: 'Trà chanh giã tay', stock: 20, price: 15000, cost: 5000, unit: 'Cốc', category: 'Đồ uống' },
  { isDuplicate: false, existingProduct: null, action: 'accumulate', name: 'Trà chanh giã tay', stock: 30, price: 15000, cost: 5000, unit: 'Cốc', category: 'Đồ uống' },
];

const updatedProductsMap = new Map();
const newProductsMap = new Map();

mockProductRows.forEach(row => {
  if (row.isDuplicate && row.existingProduct) {
    if (row.action === 'accumulate') {
      const existingAcc = updatedProductsMap.get(row.existingProduct.id);
      const baseStock = existingAcc ? existingAcc.stock : row.existingProduct.stock;
      updatedProductsMap.set(row.existingProduct.id, {
        id: row.existingProduct.id,
        stock: baseStock + row.stock,
      });
    }
  } else {
    const key = removeVietnameseTones(row.name);
    const existingNew = newProductsMap.get(key);
    if (existingNew) {
      newProductsMap.set(key, {
        ...existingNew,
        stock: existingNew.stock + row.stock,
      });
    } else {
      newProductsMap.set(key, {
        name: row.name,
        stock: row.stock,
      });
    }
  }
});

assert.strictEqual(updatedProductsMap.get('p1').stock, 30, 'Existing product stock should accumulate: 10 + 5 + 15 = 30');
assert.strictEqual(newProductsMap.get('Tra chanh gia tay').stock, 50, 'New product stock should accumulate across rows: 20 + 30 = 50');
console.log('✓ Intra-file product duplicate aggregation test passed');

// 6. Intra-file Customer Aggregation Simulation Test (Dual-index Phone & Name Cross-matching)
const existingCustomers = [
  { id: 'c1', name: 'Chị Mai', phone: '0901234567', debt: 100000, address: 'Hà Nội' }
];

const mockCustomerRows = [
  // Duplicate rows for existing customer
  { isDuplicate: true, existingCustomer: existingCustomers[0], action: 'accumulate', name: 'Chị Mai', phone: '0901234567', debt: 50000, address: 'Hà Nội' },
  { isDuplicate: true, existingCustomer: existingCustomers[0], action: 'accumulate', name: 'Chị Mai', phone: '0901234567', debt: 70000, address: 'Hà Nội' },
  // Duplicate rows for NEW customer in file:
  // Row A has phone, Row B omits phone (same name), Row C has same phone (different name string)
  { isDuplicate: false, existingCustomer: null, action: 'accumulate', name: 'Anh Hùng', phone: '0988776655', debt: 200000, address: 'Cầu Giấy' },
  { isDuplicate: false, existingCustomer: null, action: 'accumulate', name: 'Anh Hùng', phone: '', debt: 100000, address: '' },
  { isDuplicate: false, existingCustomer: null, action: 'accumulate', name: 'Hùng Vũ', phone: '0988776655', debt: 50000, address: 'Số 10 Cầu Giấy' },
];

const updatedCustomersMap = new Map();
const newCustomersMap = new Map();
const phoneToNewCustKey = new Map();
const nameToNewCustKey = new Map();

mockCustomerRows.forEach((row, idx) => {
  if (row.isDuplicate && row.existingCustomer) {
    if (row.action === 'accumulate') {
      const existingAcc = updatedCustomersMap.get(row.existingCustomer.id);
      const baseDebt = existingAcc ? existingAcc.debt : row.existingCustomer.debt;
      updatedCustomersMap.set(row.existingCustomer.id, {
        id: row.existingCustomer.id,
        debt: baseDebt + row.debt,
      });
    }
  } else {
    const normPhone = row.phone ? normalizeVietnamesePhone(row.phone) : '';
    const normName = row.name ? removeVietnameseTones(row.name).trim().toLowerCase() : '';

    let targetKey = null;
    if (normPhone && phoneToNewCustKey.has(normPhone)) {
      targetKey = phoneToNewCustKey.get(normPhone);
    } else if (normName && nameToNewCustKey.has(normName)) {
      targetKey = nameToNewCustKey.get(normName);
    }

    if (targetKey && newCustomersMap.has(targetKey)) {
      const existingNew = newCustomersMap.get(targetKey);
      const mergedPhone = existingNew.phone || normPhone;
      const mergedAddress = row.address || existingNew.address;
      const mergedDebt = existingNew.debt + row.debt;

      newCustomersMap.set(targetKey, {
        ...existingNew,
        phone: mergedPhone,
        address: mergedAddress,
        debt: mergedDebt,
      });

      if (mergedPhone) phoneToNewCustKey.set(mergedPhone, targetKey);
      if (normName) nameToNewCustKey.set(normName, targetKey);
    } else {
      const newCustKey = `new_cust_${idx}`;
      newCustomersMap.set(newCustKey, {
        name: row.name,
        phone: normPhone,
        address: row.address,
        debt: row.debt,
      });

      if (normPhone) phoneToNewCustKey.set(normPhone, newCustKey);
      if (normName) nameToNewCustKey.set(normName, newCustKey);
    }
  }
});

assert.strictEqual(updatedCustomersMap.get('c1').debt, 220000, 'Existing customer debt should accumulate: 100000 + 50000 + 70000 = 220000');
assert.strictEqual(newCustomersMap.size, 1, 'All 3 rows of new customer should group into exactly 1 customer record');
const groupedNewCustomer = Array.from(newCustomersMap.values())[0];
assert.strictEqual(groupedNewCustomer.phone, '0988776655', 'Phone should be preserved from first/third rows');
assert.strictEqual(groupedNewCustomer.debt, 350000, 'New customer debt should accumulate: 200000 + 100000 + 50000 = 350000');
console.log('✓ Intra-file customer duplicate aggregation (dual-index cross-match) test passed');

console.log('====================================');
console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY');
console.log('====================================');
