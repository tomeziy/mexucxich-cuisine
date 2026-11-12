import * as XLSX from 'xlsx';
import type { Product, Customer, Order } from '../types/index.ts';
import { removeVietnameseTones } from './vietnamese.ts';
import { formatDisplayQty } from './format.ts';

/**
 * Normalize header string to lowercase alphanumeric without Vietnamese tones
 */
export function normalizeHeaderKey(header: any): string {
  if (!header) return '';
  return removeVietnameseTones(String(header).toLowerCase())
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Header alias dictionary for Products
 */
export const PRODUCT_HEADER_ALIASES = {
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

/**
 * Header alias dictionary for Customers
 */
export const CUSTOMER_HEADER_ALIASES = {
  name: [
    'tenkhachhang', 'tenkhach', 'khachhang', 'hovaten', 'hoten',
    'name', 'ten', 'khach', 'nguoimua', 'nguoilienhe'
  ],
  phone: [
    'sodienthoai', 'sdt', 'dienthoai', 'phone', 'tel', 'didong', 'sodt',
    'dienthoaididong', 'sdtlienhe', 'dt', 'dthoai', 'mobile', 'sdtlh'
  ],
  address: [
    'diachi', 'diachigiaohang', 'address', 'noio', 'dc', 'diachinhanhang',
    'diachinhan', 'diachigiao'
  ],
  debt: [
    'dunobandau', 'duno', 'congno', 'nocu', 'tienno', 'debt',
    'sono', 'no', 'tienco', 'nohientai', 'dunohientai', 'tongno', 'conno'
  ],
};

/**
 * Header alias dictionary for Orders (ADR-0018)
 */
export const ORDER_HEADER_ALIASES = {
  stt: ['stt', 'sothutu', 'sohang'],
  id: ['madonhang', 'madon', 'mahd', 'id', 'orderid', 'code'],
  createdAt: ['thoigian', 'ngaytao', 'ngay', 'thoigiangiaodich', 'createdat', 'time', 'date'],
  customerName: ['khachhang', 'tenkhachhang', 'tenkhach', 'nguoimua', 'customer', 'customername'],
  customerPhone: ['sodienthoai', 'sdt', 'dienthoai', 'phone', 'tel', 'customerphone'],
  orderType: ['hinhthuc', 'loaidon', 'loaihinh', 'ordertype', 'type'],
  status: ['trangthai', 'tinhtrang', 'status'],
  items: ['mondamua', 'sanpham', 'chitiet', 'danhsachmon', 'items', 'mon', 'hanghoa'],
  subtotal: ['tienhang', 'tongtienhang', 'tientruocgiam', 'subtotal'],
  discountAmount: ['giamgia', 'chietkhau', 'tiengiam', 'discount'],
  shippingFee: ['phiship', 'phivanchuyen', 'tienship', 'shippingfee', 'ship'],
  total: ['khachphaitra', 'tongcong', 'tongtien', 'thanhtien', 'total'],
  paymentMethod: ['phuongthuc', 'phuongthucthanhtoan', 'hinhthucthanhtoan', 'paymentmethod'],
  paidAmount: ['tiendathu', 'dathanhtoan', 'khachtra', 'tiendatra', 'paidamount'],
  debtAmount: ['ghino', 'tienno', 'conno', 'nohang', 'debtamount'],
};

/**
 * Parse Vietnamese currency and number strings accurately
 * Handles dots/commas as thousand separators: '130.000' -> 130000, '130,000' -> 130000,
 * strips 'đ', 'VNĐ', 'vnd', spaces, and respects decimals and 'k' suffix.
 */
export function parseVietnameseNumber(value: any): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : Math.max(0, value);
  }
  let str = String(value).trim().toLowerCase();
  // Strip currency words/symbols
  str = str.replace(/vnd|vnđ|đồng|dong|đ/g, '').trim();
  if (!str) return 0;

  const hasK = str.endsWith('k');
  if (hasK) {
    str = str.slice(0, -1).trim();
  }

  // Strip any remaining characters except digits, dots, and commas
  str = str.replace(/[^\d.,]/g, '');
  if (!str) return 0;

  // Handle dots and commas
  if (str.includes('.') && str.includes(',')) {
    if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
      // e.g. 130.000,50 -> 130000.50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // e.g. 130,000.50 -> 130000.50
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // e.g. 130.000 or 1.300.000
      str = str.replace(/\./g, '');
    }
  } else if (str.includes(',')) {
    const parts = str.split(',');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      // e.g. 130,000 or 1,300,000
      str = str.replace(/,/g, '');
    } else if (parts.length === 2 && parts[1].length !== 3) {
      // decimal comma e.g. 1,5 -> 1.5
      str = str.replace(',', '.');
    }
  }

  let num = parseFloat(str);
  if (isNaN(num)) return 0;
  if (hasK) num *= 1000;
  return Math.max(0, num);
}

/**
 * Normalize a single candidate Vietnamese phone number string
 */
export function normalizeSinglePhone(phone: any): string {
  if (phone === null || phone === undefined) return '';
  let str = String(phone).replace(/[^0-9+]/g, '').trim();
  if (!str) return '';

  // Reject dummy zero-only phones (e.g. 0, 00, 000 from Excel empty cells)
  if (str === '0' || /^0+$/.test(str)) {
    return '';
  }

  if (str.startsWith('+84')) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('84') && str.length >= 10) {
    str = '0' + str.slice(2);
  }

  // If 9 digits (Excel truncated leading 0, e.g. 904047976 -> 0904047976)
  if (str.length === 9 && !str.startsWith('0')) {
    str = '0' + str;
  }

  return str;
}

/**
 * Normalize Vietnamese phone numbers (single or multiple phones)
 * If cell contains multiple phones (separated by /, ,, ;, -, newline),
 * parses each, deduplicates, and formats as "0869229160 / 0986476328".
 * Also recovers 20-digit concatenated phones resulting from prior faulty strip.
 */
export function normalizeVietnamesePhone(phone: any): string {
  if (phone === null || phone === undefined) return '';
  const raw = String(phone).trim();
  if (!raw) return '';

  // Split by common delimiters: slash, comma, semicolon, newline, pipe, or dash surrounded by whitespace/digits
  const parts = raw.split(/[\/,;\n\r|]|\s+-\s+/).map(p => p.trim()).filter(Boolean);

  const validPhones: string[] = [];

  for (const part of parts) {
    // If the part contains multiple 10-digit numbers run together or space separated
    const subParts = part.match(/(?:\+84|0|\b)[0-9]{9,11}\b/g);
    if (subParts && subParts.length > 1) {
      for (const sp of subParts) {
        const norm = normalizeSinglePhone(sp);
        if (norm && !validPhones.includes(norm)) validPhones.push(norm);
      }
    } else {
      const norm = normalizeSinglePhone(part);
      if (norm) {
        // Recovery: if someone passed 20 digits like 08692291600986476328 from past concatenated imports
        if (norm.length === 20 && norm.startsWith('0')) {
          const p1 = normalizeSinglePhone(norm.slice(0, 10));
          const p2 = normalizeSinglePhone(norm.slice(10));
          if (p1 && !validPhones.includes(p1)) validPhones.push(p1);
          if (p2 && !validPhones.includes(p2)) validPhones.push(p2);
        } else if (!validPhones.includes(norm)) {
          validPhones.push(norm);
        }
      }
    }
  }

  if (validPhones.length === 0) {
    const single = normalizeSinglePhone(raw);
    if (single.length === 20 && single.startsWith('0')) {
      return `${single.slice(0, 10)} / ${single.slice(10)}`;
    }
    return single;
  }

  return validPhones.join(' / ');
}

/**
 * Check if two phone strings share any matching normalized phone number
 */
export function isPhoneMatching(phoneA: string, phoneB: string): boolean {
  if (!phoneA || !phoneB) return false;
  const normA = normalizeVietnamesePhone(phoneA);
  const normB = normalizeVietnamesePhone(phoneB);
  if (!normA || !normB) return false;
  const listA = normA.split(' / ').map(p => p.trim()).filter(Boolean);
  const listB = normB.split(' / ').map(p => p.trim()).filter(Boolean);
  return listA.some(pa => listB.includes(pa));
}

function matchHeaderField<T extends Record<string, string[]>>(
  headerCell: any,
  aliasMap: T
): keyof T | null {
  const normalized = normalizeHeaderKey(headerCell);
  if (!normalized) return null;
  for (const [field, aliases] of Object.entries(aliasMap)) {
    if (aliases.includes(normalized)) {
      return field as keyof T;
    }
  }
  return null;
}

interface SheetHeaderScanResult<T extends Record<string, string[]>> {
  headerRowIndex: number;
  columnMap: Map<number, keyof T>;
}

function findHeaderRowInSheet<T extends Record<string, string[]>>(
  sheetRows: any[][],
  aliasMap: T,
  primaryRequiredField: keyof T
): SheetHeaderScanResult<T> | null {
  const maxScanRows = Math.min(sheetRows.length, 11); // scan rows 0 to 10
  let bestResult: SheetHeaderScanResult<T> | null = null;
  let maxMatchedCount = 0;

  for (let r = 0; r < maxScanRows; r++) {
    const row = sheetRows[r];
    if (!Array.isArray(row)) continue;
    const colMap = new Map<number, keyof T>();
    const mappedFields = new Set<keyof T>();
    let hasRequiredField = false;

    row.forEach((cell, colIdx) => {
      const matched = matchHeaderField(cell, aliasMap);
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

export interface ParsedProductRow {
  name: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  image: string;
}

/**
 * Parse uploaded Excel file for Products with fuzzy matching across all sheets and rows 0-10
 */
export async function parseProductsExcel(file: File): Promise<ParsedProductRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const allProducts: ParsedProductRow[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!rawRows || rawRows.length === 0) continue;

          const scan = findHeaderRowInSheet(rawRows, PRODUCT_HEADER_ALIASES, 'name');
          if (!scan) continue;

          const dataRows = rawRows.slice(scan.headerRowIndex + 1);
          for (const row of dataRows) {
            if (!Array.isArray(row) || row.length === 0) continue;

            const item: Partial<ParsedProductRow> = {
              category: 'Đồ tự làm',
              unit: 'Gói 500g',
              cost: 0,
              price: 0,
              stock: 0,
              image: '🌭',
            };

            scan.columnMap.forEach((field, colIdx) => {
              const val = row[colIdx];
              if (field === 'name') {
                item.name = String(val || '').trim();
              } else if (field === 'category') {
                const cat = String(val || '').trim();
                if (cat) item.category = cat;
              } else if (field === 'unit') {
                const u = String(val || '').trim();
                if (u) item.unit = u;
              } else if (field === 'cost') {
                item.cost = parseVietnameseNumber(val);
              } else if (field === 'price') {
                item.price = parseVietnameseNumber(val);
              } else if (field === 'stock') {
                item.stock = parseVietnameseNumber(val);
              }
            });

            if (item.name) {
              allProducts.push(item as ParsedProductRow);
            }
          }
        }

        resolve(allProducts);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export interface ParsedCustomerRow {
  name: string;
  phone: string;
  address: string;
  debt: number;
}

/**
 * Parse uploaded Excel file for Customers with fuzzy matching across all sheets and rows 0-10
 */
export async function parseCustomersExcel(file: File): Promise<ParsedCustomerRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const allCustomers: ParsedCustomerRow[] = [];

        for (const sheetName of workbook.SheetNames) {
          const worksheet = workbook.Sheets[sheetName];
          if (!worksheet) continue;

          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!rawRows || rawRows.length === 0) continue;

          const scan = findHeaderRowInSheet(rawRows, CUSTOMER_HEADER_ALIASES, 'name');
          if (!scan) continue;

          const dataRows = rawRows.slice(scan.headerRowIndex + 1);
          for (const row of dataRows) {
            if (!Array.isArray(row) || row.length === 0) continue;

            const item: ParsedCustomerRow = {
              name: '',
              phone: '',
              address: '',
              debt: 0,
            };

            scan.columnMap.forEach((field, colIdx) => {
              const val = row[colIdx];
              if (field === 'name') {
                item.name = String(val || '').trim();
              } else if (field === 'phone') {
                item.phone = normalizeVietnamesePhone(val);
              } else if (field === 'address') {
                item.address = String(val || '').trim();
              } else if (field === 'debt') {
                item.debt = parseVietnameseNumber(val);
              }
            });

            if (item.name) {
              allCustomers.push(item);
            }
          }
        }

        resolve(allCustomers);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Download sample template Excel for Products
 */
export function downloadProductTemplate(): void {
  const sampleData = [
    {
      'Tên sản phẩm': 'Xúc xích Gà Nấm (500g)',
      'Danh mục': 'Đồ tự làm',
      'Đơn vị': 'Gói 500g',
      'Giá vốn': 80000,
      'Đơn giá': 130000,
      'Tồn kho': 20,
    },
    {
      'Tên sản phẩm': 'Chả Mực Giã Tay (500g)',
      'Danh mục': 'Đặc sản tuyển chọn',
      'Đơn vị': 'Khay 500g',
      'Giá vốn': 160000,
      'Đơn giá': 240000,
      'Tồn kho': 10,
    },
    {
      'Tên sản phẩm': 'Pate Heo Quế Thơm',
      'Danh mục': 'Đồ tự làm',
      'Đơn vị': 'Hũ 200g',
      'Giá vốn': 45000,
      'Đơn giá': 75000,
      'Tồn kho': 15,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_San_Pham');
  XLSX.writeFile(wb, 'mexucxich_mau_nhap_san_pham.xlsx');
}

/**
 * Download sample template Excel for Customers
 */
export function downloadCustomerTemplate(): void {
  const sampleData = [
    {
      'Tên khách hàng': 'Chị Hoàng Mai (Khách quen)',
      'Số điện thoại': '0904047976',
      'Địa chỉ': '12 Tràng Thi, Hoàn Kiếm, Hà Nội',
      'Dư nợ ban đầu': 250000,
    },
    {
      'Tên khách hàng': 'Anh Nguyễn Tuấn',
      'Số điện thoại': '0912345678',
      'Địa chỉ': 'Căn 1205 Tòa S2, Vinhomes Ocean Park',
      'Dư nợ ban đầu': 0,
    },
    {
      'Tên khách hàng': 'Cô Lan (Bán sỉ)',
      'Số điện thoại': '0988776655',
      'Địa chỉ': 'Ki-ốt 15 Chợ Hôm, Hà Nội',
      'Dư nợ ban đầu': 500000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Khach_Hang');
  XLSX.writeFile(wb, 'mexucxich_mau_nhap_khach_hang.xlsx');
}

/**
 * Export products to Excel file (.xlsx)
 */
export function exportProductsToExcel(products: Product[]): void {
  const data = products.map((p, idx) => ({
    'STT': idx + 1,
    'Mã Sản Phẩm': p.id,
    'Tên Món Ăn': p.name,
    'Danh Mục': p.category,
    'Đơn Vị': p.unit,
    'Giá Vốn (VNĐ)': p.cost,
    'Giá Bán (VNĐ)': p.price,
    'Tồn Kho': p.stock,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Thực Đơn Sản Phẩm');
  
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `mexucxich_san_pham_${dateStr}.xlsx`);
}

/**
 * Export orders history to Excel file (.xlsx)
 */
export function exportOrdersToExcel(orders: Order[]): void {
  const data = orders.map((o, idx) => ({
    'STT': idx + 1,
    'Mã Đơn Hàng': o.id,
    'Thời Gian': o.createdAt,
    'Khách Hàng': o.customerName,
    'Số Điện Thoại': o.customerPhone || '',
    'Hình Thức': o.orderType === 'direct' ? 'Tại chỗ' : 'Giao hàng',
    'Trạng Thái': o.status,
    'Món Đã Mua': o.items.map(i => `${i.name} (x${formatDisplayQty(i.qty)} - ${i.price.toLocaleString('vi-VN')}đ)`).join(', '),
    'Tiền Hàng': o.subtotal,
    'Giảm Giá': o.discountAmount,
    'Phí Ship': o.shippingFee,
    'Khách Phải Trả': o.total,
    'Phương Thức': o.paymentMethod,
    'Tiền Đã Thu': o.paidAmount,
    'Ghi Nợ': o.debtAmount,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch Sử Đơn Hàng');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `mexucxich_bao_cao_${dateStr}.xlsx`);
}

/**
 * Export customer debt list to Excel
 */
export function exportCustomersToExcel(customers: Customer[]): void {
  const data = customers.map((c, idx) => ({
    'STT': idx + 1,
    'Mã Khách Hàng': c.id,
    'Tên Khách Hàng': c.name,
    'Số Điện Thoại': c.phone || '',
    'Địa Chỉ': c.address || '',
    'Số Đơn Đã Mua': c.orderCount || 0,
    'Tổng Tiền Đã Mua': c.totalSpent || 0,
    'Dư Nợ Hiện Tại': c.debt || 0,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Khách Hàng & Công Nợ');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `mexucxich_cong_no_${dateStr}.xlsx`);
}

/**
 * Infer item emoji based on dish name keywords
 */
export function inferEmojiFromName(name: string): string {
  const lower = removeVietnameseTones(name.toLowerCase());
  if (lower.includes('pate')) return '🥣';
  if (lower.includes('xuc xich') || lower.includes('sausage')) return '🌭';
  if (lower.includes('bo') || lower.includes('beef') || lower.includes('steak') || lower.includes('aukobe')) return '🥩';
  if (lower.includes('ga') || lower.includes('chicken')) return '🍗';
  if (lower.includes('heo') || lower.includes('lon') || lower.includes('pork') || lower.includes('sui cao')) return '🥟';
  if (lower.includes('muc') || lower.includes('squid')) return '🦑';
  if (lower.includes('tom') || lower.includes('shrimp')) return '🦐';
  if (lower.includes('ca') || lower.includes('fish')) return '🐟';
  if (lower.includes('lau') || lower.includes('hotpot') || lower.includes('soup')) return '🍲';
  if (lower.includes('banh') || lower.includes('bread')) return '🥖';
  return '🌭';
}

/**
 * Infer unit string based on dish name keywords
 */
export function inferUnitFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('500g')) return 'Gói 500g';
  if (lower.includes('250g')) return 'Hũ 250g';
  if (lower.includes('200g')) return 'Hũ 200g';
  if (lower.includes('1kg')) return 'Gói 1kg';
  if (lower.includes('kg') || lower.includes('ký') || lower.includes('ky') || lower.includes('can ky')) return 'kg';
  if (lower.includes('hu') || lower.includes('hũ')) return 'Hũ';
  if (lower.includes('khay')) return 'Khay';
  if (lower.includes('hop') || lower.includes('hộp')) return 'Hộp';
  if (lower.includes('chai')) return 'Chai';
  if (lower.includes('set')) return 'Set';
  return 'Gói';
}

/**
 * Parses a combined "Món Đã Mua" string into individual order items with name, qty, price.
 * Handles formats like:
 * "Xúc xích Heo Thảo Mộc (x1 - 145.000đ), Lõi vai bò vân tuyết Aukobe (Cân ký lẻ) (x0.59 - 380.000đ)"
 */
export function parseOrderItemsString(
  itemsStr: string
): Array<{ name: string; qty: number; price: number }> {
  if (!itemsStr || typeof itemsStr !== 'string') return [];
  const trimmed = itemsStr.trim();
  if (!trimmed) return [];

  // Split on item boundaries: typically "), "
  const rawParts = trimmed.split(/\)\s*,\s*/);
  const items: Array<{ name: string; qty: number; price: number }> = [];

  for (let idx = 0; idx < rawParts.length; idx++) {
    let part = rawParts[idx].trim();
    if (!part) continue;
    // Re-attach closing paren if not the last or if stripped by split
    if (!part.endsWith(')')) {
      part += ')';
    }

    // Match "Name (xQty - Price)"
    const matchWithPrice = part.match(/^(.*?)\s*\(\s*x\s*([\d.,]+)\s*-\s*([^)]+)\)$/i);
    if (matchWithPrice) {
      const name = matchWithPrice[1].trim();
      const qty = parseFloat(matchWithPrice[2].replace(',', '.')) || 1;
      const price = parseVietnameseNumber(matchWithPrice[3]);
      if (name) {
        items.push({ name, qty, price });
        continue;
      }
    }

    // Match "Name (xQty)"
    const matchQtyOnly = part.match(/^(.*?)\s*\(\s*x\s*([\d.,]+)\s*\)$/i);
    if (matchQtyOnly) {
      const name = matchQtyOnly[1].trim();
      const qty = parseFloat(matchQtyOnly[2].replace(',', '.')) || 1;
      if (name) {
        items.push({ name, qty, price: 0 });
        continue;
      }
    }

    // Fallback: whole part as name
    const cleanedName = part.replace(/\)$/, '').trim();
    if (cleanedName) {
      items.push({ name: cleanedName, qty: 1, price: 0 });
    }
  }

  return items;
}

/**
 * Parse an uploaded daily Excel report file (e.g. mexucxich_bao_cao_*.xlsx)
 * Reconstructs Order[] with full items, customer information, and financial details.
 */
export async function parseOrdersExcel(
  file: File | ArrayBuffer | Uint8Array
): Promise<Order[]> {
  return new Promise((resolve, reject) => {
    const processWorkbook = (wb: XLSX.WorkBook) => {
      try {
        const allOrders: Order[] = [];

        // Scan sheets: prefer sheets with "don hang" or "bao cao", otherwise all sheets
        const targetSheetNames = wb.SheetNames.filter(n => {
          const clean = removeVietnameseTones(n.toLowerCase());
          return clean.includes('don hang') || clean.includes('bao cao') || clean.includes('lich su');
        });

        const sheetNamesToScan = targetSheetNames.length > 0 ? targetSheetNames : wb.SheetNames;

        for (const sheetName of sheetNamesToScan) {
          const worksheet = wb.Sheets[sheetName];
          if (!worksheet) continue;

          const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          if (!rawRows || rawRows.length === 0) continue;

          const scan = findHeaderRowInSheet(rawRows, ORDER_HEADER_ALIASES, 'items');
          if (!scan) continue;

          const dataRows = rawRows.slice(scan.headerRowIndex + 1);
          for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
            const row = dataRows[rIdx];
            if (!Array.isArray(row) || row.length === 0) continue;

            let id = '';
            let createdAt = '';
            let customerName = 'Khách lẻ';
            let customerPhone = '';
            let orderType: 'direct' | 'delivery' = 'direct';
            let status: any = 'completed';
            let itemsRaw = '';
            let subtotal = 0;
            let discountAmount = 0;
            let shippingFee = 0;
            let total = 0;
            let paymentMethod: 'cash' | 'transfer' | 'debt' = 'cash';
            let paidAmount = 0;
            let debtAmount = 0;

            scan.columnMap.forEach((field, colIdx) => {
              const val = row[colIdx];
              if (field === 'id') {
                const rawId = String(val || '').trim();
                if (rawId && !isNaN(Number(rawId)) && Number(rawId) < 1000) {
                  // STT number like 1, 2, 3...
                  id = `HD_${Date.now()}_${rIdx}`;
                } else if (rawId) {
                  id = rawId;
                }
              } else if (field === 'createdAt') {
                if (typeof val === 'number') {
                  // Excel date serial number
                  try {
                    const dateObj = new Date(Math.round((val - 25569) * 86400 * 1000));
                    createdAt = !isNaN(dateObj.getTime()) ? dateObj.toISOString() : new Date().toISOString();
                  } catch {
                    createdAt = new Date().toISOString();
                  }
                } else if (val) {
                  const d = new Date(String(val).trim());
                  createdAt = !isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString();
                }
              } else if (field === 'customerName') {
                const name = String(val || '').trim();
                if (name) customerName = name;
              } else if (field === 'customerPhone') {
                customerPhone = normalizeSinglePhone(val);
              } else if (field === 'orderType') {
                const typeStr = removeVietnameseTones(String(val || '').toLowerCase());
                if (typeStr.includes('giao') || typeStr.includes('ship') || typeStr.includes('delivery')) {
                  orderType = 'delivery';
                } else {
                  orderType = 'direct';
                }
              } else if (field === 'status') {
                const st = removeVietnameseTones(String(val || '').toLowerCase());
                if (st.includes('huy') || st.includes('cancel')) status = 'cancelled';
                else if (st.includes('dang giao') || st.includes('delivering')) status = 'delivering';
                else if (st.includes('chuan bi') || st.includes('preparing')) status = 'preparing';
                else status = 'completed';
              } else if (field === 'items') {
                itemsRaw = String(val || '').trim();
              } else if (field === 'subtotal') {
                subtotal = parseVietnameseNumber(val);
              } else if (field === 'discountAmount') {
                discountAmount = parseVietnameseNumber(val);
              } else if (field === 'shippingFee') {
                shippingFee = parseVietnameseNumber(val);
              } else if (field === 'total') {
                total = parseVietnameseNumber(val);
              } else if (field === 'paymentMethod') {
                const pm = removeVietnameseTones(String(val || '').toLowerCase());
                if (pm.includes('no') || pm.includes('debt')) paymentMethod = 'debt';
                else if (pm.includes('chuyen') || pm.includes('ck') || pm.includes('transfer')) paymentMethod = 'transfer';
                else paymentMethod = 'cash';
              } else if (field === 'paidAmount') {
                paidAmount = parseVietnameseNumber(val);
              } else if (field === 'debtAmount') {
                debtAmount = parseVietnameseNumber(val);
              }
            });

            if (!itemsRaw && total === 0) continue;

            const parsedItems = parseOrderItemsString(itemsRaw);
            if (parsedItems.length === 0 && !itemsRaw) continue;

            if (!id) {
              id = `HD_${Date.now()}_${rIdx}_${Math.floor(100 + Math.random() * 900)}`;
            }
            if (!createdAt) {
              createdAt = new Date().toISOString();
            }
            if (!subtotal) {
              subtotal = parsedItems.reduce((s, it) => s + it.price * it.qty, 0);
            }
            if (!total) {
              total = Math.max(0, subtotal - discountAmount + shippingFee);
            }
            if (debtAmount > 0 && paymentMethod === 'cash') {
              paymentMethod = 'debt';
            }

            const orderItems = parsedItems.map((pi, pIdx) => ({
              productId: `SP_REC_${Date.now()}_${pIdx}`,
              name: pi.name,
              unit: inferUnitFromName(pi.name),
              price: pi.price,
              cost: Math.round(pi.price * 0.65),
              qty: pi.qty,
              image: inferEmojiFromName(pi.name),
            }));

            allOrders.push({
              id,
              createdAt,
              updatedAt: createdAt,
              customerId: customerPhone ? `KH_${customerPhone}` : 'KH_RETAIL',
              customerName,
              customerPhone,
              customerAddress: '',
              orderType,
              status,
              items: orderItems,
              subtotal,
              discountType: 'cash',
              discountValue: discountAmount,
              discountAmount,
              shippingFee,
              total,
              paymentMethod,
              paidAmount,
              debtAmount,
            });
          }
        }

        resolve(allOrders);
      } catch (err) {
        reject(err);
      }
    };

    if (file instanceof Uint8Array) {
      const wb = XLSX.read(file, { type: 'array' });
      processWorkbook(wb);
    } else if (file instanceof ArrayBuffer) {
      const wb = XLSX.read(new Uint8Array(file), { type: 'array' });
      processWorkbook(wb);
    } else if (typeof File !== 'undefined' && file instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          processWorkbook(wb);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Invalid file or buffer provided to parseOrdersExcel'));
    }
  });
}

/**
 * Extracts any dishes/products mentioned in imported orders that are not present
 * in the existing product catalog, ready to be restored into the store menu.
 */
export function extractMissingProductsFromOrders(
  orders: Order[],
  existingProducts: Product[] = []
): Array<Omit<Product, 'id'>> {
  const existingNames = new Set(
    existingProducts.map(p => removeVietnameseTones((p.name || '').toLowerCase()).trim())
  );

  const missingMap = new Map<string, Omit<Product, 'id'>>();

  for (const o of orders) {
    for (const item of o.items || []) {
      if (!item || !item.name) continue;
      const normalized = removeVietnameseTones(item.name.toLowerCase()).trim();
      if (!normalized) continue;

      if (!existingNames.has(normalized) && !missingMap.has(normalized)) {
        missingMap.set(normalized, {
          name: item.name.trim(),
          category: 'Đặc sản tuyển chọn',
          unit: item.unit || inferUnitFromName(item.name),
          price: item.price || 0,
          cost: item.cost || Math.round((item.price || 0) * 0.65),
          stock: 20,
          image: item.image || inferEmojiFromName(item.name),
          createdAt: o.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return Array.from(missingMap.values());
}
