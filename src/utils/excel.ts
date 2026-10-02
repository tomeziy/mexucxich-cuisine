import * as XLSX from 'xlsx';
import { Product, Customer, Order } from '../types';

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

/**
 * Download sample template Excel for Products
 */
export function downloadProductTemplate(): void {
  const sampleData = [
    {
      'Tên Món Ăn': 'Xúc xích Gà Nấm (500g)',
      'Danh Mục': 'Đồ tự làm',
      'Đơn Vị': 'Gói 500g',
      'Giá Vốn (VNĐ)': 80000,
      'Giá Bán (VNĐ)': 130000,
      'Tồn Kho': 20,
    },
    {
      'Tên Món Ăn': 'Chả Mực Giã Tay (500g)',
      'Danh Mục': 'Đặc sản tuyển chọn',
      'Đơn Vị': 'Khay 500g',
      'Giá Vốn (VNĐ)': 160000,
      'Giá Bán (VNĐ)': 240000,
      'Tồn Kho': 10,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_San_Pham');
  XLSX.writeFile(wb, 'mexucxich_mau_nhap_san_pham.xlsx');
}

/**
 * Parse uploaded Excel file for Products
 */
export async function parseProductsExcel(file: File): Promise<Partial<Product>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const products: Partial<Product>[] = json.map(row => {
          return {
            name: String(row['Tên Món Ăn'] || row['Tên'] || row['name'] || '').trim(),
            category: String(row['Danh Mục'] || row['category'] || 'Đồ tự làm').trim(),
            unit: String(row['Đơn Vị'] || row['unit'] || 'Gói 500g').trim(),
            cost: Number(row['Giá Vốn (VNĐ)'] || row['Giá Vốn'] || row['cost'] || 0),
            price: Number(row['Giá Bán (VNĐ)'] || row['Giá Bán'] || row['price'] || 0),
            stock: Number(row['Tồn Kho'] || row['stock'] || 0),
            image: '🌭',
          };
        }).filter(p => p.name);

        resolve(products);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Download sample template Excel for Customers
 */
export function downloadCustomerTemplate(): void {
  const sampleData = [
    {
      'Tên Khách Hàng (*)': 'Chị Hoàng Mai (Khách quen)',
      'Số Điện Thoại': '0904047976',
      'Địa Chỉ': '12 Tràng Thi, Hoàn Kiếm, Hà Nội',
      'Dư Nợ Ban Đầu (VNĐ)': 250000,
    },
    {
      'Tên Khách Hàng (*)': 'Anh Nguyễn Tuấn',
      'Số Điện Thoại': '0912345678',
      'Địa Chỉ': 'Căn 1205 Tòa S2, Vinhomes Ocean Park',
      'Dư Nợ Ban Đầu (VNĐ)': 0,
    },
    {
      'Tên Khách Hàng (*)': 'Cô Lan (Bán sỉ)',
      'Số Điện Thoại': '0988776655',
      'Địa Chỉ': 'Ki-ốt 15 Chợ Hôm, Hà Nội',
      'Dư Nợ Ban Đầu (VNĐ)': 500000,
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Nhap_Khach_Hang');
  XLSX.writeFile(wb, 'mexucxich_mau_nhap_khach_hang.xlsx');
}

export interface ParsedCustomerRow {
  name: string;
  phone: string;
  address: string;
  debt: number;
}

/**
 * Parse uploaded Excel file for Customers
 */
export async function parseCustomersExcel(file: File): Promise<ParsedCustomerRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const customers: ParsedCustomerRow[] = json.map(row => {
          const rawName = String(
            row['Tên Khách Hàng (*)'] ||
            row['Tên Khách Hàng'] ||
            row['Tên'] ||
            row['Họ và Tên'] ||
            row['name'] ||
            ''
          ).trim();

          const rawPhone = String(
            row['Số Điện Thoại'] ||
            row['SĐT'] ||
            row['Điện Thoại'] ||
            row['phone'] ||
            ''
          ).replace(/[^0-9+]/g, '').trim();

          const rawAddress = String(
            row['Địa Chỉ'] ||
            row['Địa chỉ'] ||
            row['address'] ||
            ''
          ).trim();

          const rawDebt = Number(
            row['Dư Nợ Ban Đầu (VNĐ)'] ||
            row['Dư Nợ Ban Đầu'] ||
            row['Dư Nợ'] ||
            row['Nợ'] ||
            row['debt'] ||
            0
          );

          return {
            name: rawName,
            phone: rawPhone,
            address: rawAddress,
            debt: isNaN(rawDebt) ? 0 : Math.max(0, rawDebt),
          };
        }).filter(c => c.name);

        resolve(customers);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
