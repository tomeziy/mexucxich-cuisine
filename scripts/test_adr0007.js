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
  name: ['tensanpham', 'tenmonan', 'tenmon', 'tenhang', 'mathang', 'sanpham', 'monan', 'name', 'ten'],
  category: ['danhmuc', 'nhomhang', 'nhom', 'category', 'loaihang', 'loai'],
  unit: ['donvi', 'donvitinh', 'dvt', 'unit'],
  cost: ['giavon', 'gianhap', 'giamua', 'cost', 'giagoc'],
  price: ['giaban', 'dongia', 'giale', 'gia', 'price', 'giatien'],
  stock: ['tonkho', 'soluong', 'ton', 'stock', 'qty', 'sl', 'soluongton'],
};

const CUSTOMER_HEADER_ALIASES = {
  name: ['tenkhachhang', 'tenkhach', 'khachhang', 'hovaten', 'hoten', 'name', 'ten', 'khach'],
  phone: ['sodienthoai', 'sdt', 'dienthoai', 'phone', 'tel', 'didong', 'so_dien_thoai'],
  address: ['diachi', 'diachigiaohang', 'address', 'noio', 'dc', 'dia_chi'],
  debt: ['dunobandau', 'duno', 'congno', 'nocu', 'tienno', 'debt', 'so_no', 'no', 'tienco'],
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

  if (str.startsWith('+84')) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('84') && str.length >= 10) {
    str = '0' + str.slice(2);
  }

  if (str.length === 9 && /^[35789]/.test(str)) {
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
console.log('✓ All 16 currency & number tests passed');

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
assert.strictEqual(normalizeVietnamesePhone(''), '');
assert.strictEqual(normalizeVietnamesePhone(null), '');
assert.strictEqual(normalizeVietnamesePhone(undefined), '');
console.log('✓ All 16 phone normalization tests passed');

// 3. Header Fuzzy Matching Edge Cases
assert.strictEqual(matchField('Tên sản phẩm', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên món ăn', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên món', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Mặt hàng', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Sản phẩm', PRODUCT_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Đơn giá', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá bán', PRODUCT_HEADER_ALIASES), 'price');
assert.strictEqual(matchField('Giá vốn', PRODUCT_HEADER_ALIASES), 'cost');
assert.strictEqual(matchField('Giá nhập', PRODUCT_HEADER_ALIASES), 'cost');
assert.strictEqual(matchField('Tồn kho', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Số lượng', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Số lượng tồn', PRODUCT_HEADER_ALIASES), 'stock');
assert.strictEqual(matchField('Đơn vị tính', PRODUCT_HEADER_ALIASES), 'unit');
assert.strictEqual(matchField('ĐVT', PRODUCT_HEADER_ALIASES), 'unit');
assert.strictEqual(matchField('Danh mục', PRODUCT_HEADER_ALIASES), 'category');
assert.strictEqual(matchField('Nhóm hàng', PRODUCT_HEADER_ALIASES), 'category');

assert.strictEqual(matchField('Tên khách hàng (*)', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Tên khách', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Họ và tên', CUSTOMER_HEADER_ALIASES), 'name');
assert.strictEqual(matchField('Số điện thoại', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('SĐT', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Điện thoại', CUSTOMER_HEADER_ALIASES), 'phone');
assert.strictEqual(matchField('Địa chỉ', CUSTOMER_HEADER_ALIASES), 'address');
assert.strictEqual(matchField('Địa chỉ giao hàng', CUSTOMER_HEADER_ALIASES), 'address');
assert.strictEqual(matchField('Dư nợ ban đầu', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Dư nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Công nợ', CUSTOMER_HEADER_ALIASES), 'debt');
assert.strictEqual(matchField('Nợ cũ', CUSTOMER_HEADER_ALIASES), 'debt');
console.log('✓ All 28 fuzzy header alias tests passed');

console.log('====================================');
console.log('🎉 60/60 UNIT TESTS PASSED SUCCESSFULLY');
console.log('====================================');
