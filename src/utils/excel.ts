import * as XLSX from 'xlsx';
import { Product, Customer, Order } from '../types';
import { removeVietnameseTones } from './vietnamese';

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
  name: ['tensanpham', 'tenmonan', 'tenmon', 'tenhang', 'mathang', 'sanpham', 'monan', 'name', 'ten'],
  category: ['danhmuc', 'nhomhang', 'nhom', 'category', 'loaihang', 'loai'],
  unit: ['donvi', 'donvitinh', 'dvt', 'unit'],
  cost: ['giavon', 'gianhap', 'giamua', 'cost', 'giagoc'],
  price: ['giaban', 'dongia', 'giale', 'gia', 'price', 'giatien'],
  stock: ['tonkho', 'soluong', 'ton', 'stock', 'qty', 'sl', 'soluongton'],
};

/**
 * Header alias dictionary for Customers
 */
export const CUSTOMER_HEADER_ALIASES = {
  name: ['tenkhachhang', 'tenkhach', 'khachhang', 'hovaten', 'hoten', 'name', 'ten', 'khach'],
  phone: ['sodienthoai', 'sdt', 'dienthoai', 'phone', 'tel', 'didong', 'so_dien_thoai'],
  address: ['diachi', 'diachigiaohang', 'address', 'noio', 'dc', 'dia_chi'],
  debt: ['dunobandau', 'duno', 'congno', 'nocu', 'tienno', 'debt', 'so_no', 'no', 'tienco'],
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
 * Normalize Vietnamese phone numbers
 * Preserves or prepends leading '0' if 9 digits or starts with '84' / '+84'
 */
export function normalizeVietnamesePhone(phone: any): string {
  if (phone === null || phone === undefined) return '';
  let str = String(phone).replace(/[^0-9+]/g, '').trim();
  if (!str) return '';

  if (str.startsWith('+84')) {
    str = '0' + str.slice(3);
  } else if (str.startsWith('84') && str.length >= 10) {
    str = '0' + str.slice(2);
  }

  // If 9 digits (Excel truncated leading 0, e.g. 904047976 -> 0904047976)
  if (str.length === 9 && /^[35789]/.test(str)) {
    str = '0' + str;
  }

  return str;
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
  for (let r = 0; r < maxScanRows; r++) {
    const row = sheetRows[r];
    if (!Array.isArray(row)) continue;
    const colMap = new Map<number, keyof T>();
    let hasRequiredField = false;

    row.forEach((cell, colIdx) => {
      const matched = matchHeaderField(cell, aliasMap);
      if (matched) {
        colMap.set(colIdx, matched);
        if (matched === primaryRequiredField) {
          hasRequiredField = true;
        }
      }
    });

    if (hasRequiredField) {
      return {
        headerRowIndex: r,
        columnMap: colMap,
      };
    }
  }
  return null;
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
    'Món Đã Mua': o.items.map(i => `${i.name} (x${i.qty} - ${i.price.toLocaleString('vi-VN')}đ)`).join(', '),
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
