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
    'Món Đã Mua': o.items.map(i => `${i.name} (x${i.qty})`).join(', '),
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
