import type { Product, Customer, ReceiptSettings } from '../types/index.ts';

export const DEMO_PRODUCT_IDS = new Set([
  'SP01',
  'SP02',
  'SP03',
  'SP04',
  'SP05',
  'SP06',
  'SP07',
  'SP08',
]);

export const DEMO_CUSTOMER_IDS = new Set(['KH02', 'KH03', 'KH04']);

export const INITIAL_PRODUCTS: Product[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'KH01',
    name: 'Khách lẻ tại quầy',
    phone: '',
    address: '',
    debt: 0,
    totalSpent: 0,
    orderCount: 0,
    createdAt: '2026-09-01T08:00:00Z',
    updatedAt: '2026-09-01T08:00:00Z',
  },
];

export const DEFAULT_RECEIPT_SETTINGS: ReceiptSettings = {
  storeName: 'MEXUCXICH CUISINE',
  storeSubtitle: 'Đồ ăn homemade và đặc sản vùng miền',
  address: '',
  hotline: '0904047976',
  facebook: 'Hoàng Minh Hằng - 0904047976',
  footerMessage: 'Chúc quý khách có một bữa ăn hạnh phúc!',
  paperSize: 'k80',
  fontSize: 'small',
  deliveryCalloutSize: 'standard_large',
  fontFamily: 'plus_jakarta',
  printCopies: 1,
  bankCode: 'TCB', // Techcombank
  bankAccount: '10520110621010',
  bankAccountName: 'BÙI THỊ TUYẾT MAI',
  bankNote: 'Nội dung: ghi rõ tên / Facebook / Sđt và gửi bill cho chủ shop ạ',
  showLogo: false,
  showStaff: false,
  showCustomer: true,
  showVietQR: true,
  showOrderType: false,
  showPaymentMethod: false,
  showDebtInfo: false,
};
