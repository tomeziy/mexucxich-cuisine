export interface Product {
  id: string;
  name: string;
  category: string;
  unit: string;
  price: number;
  cost: number;
  stock: number;
  image: string;
  createdAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  debt: number;
  totalSpent?: number;
  orderCount?: number;
  createdAt?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  unit: string;
  price: number;
  cost: number;
  qty: number;
  image: string;
}

export type OrderType = 'direct' | 'delivery';
export type OrderStatus = 'preparing' | 'delivering' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'transfer' | 'debt' | 'partial';

export interface Order {
  id: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  orderType: OrderType;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  discountType: 'cash' | 'percent';
  discountValue: number;
  discountAmount: number;
  shippingFee: number;
  shippingNote?: string;
  total: number;
  paymentMethod: PaymentMethod;
  cashGiven?: number;
  change?: number;
  paidAmount: number;
  debtAmount: number;
}

export interface DebtPayment {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'cash' | 'transfer';
  note?: string;
  createdAt: string;
}

export type PaperSize = 'k80' | 'k57' | 'a5' | 'a4';

export interface ReceiptSettings {
  storeName: string;
  storeSubtitle: string;
  address: string;
  hotline: string;
  footerMessage: string;
  paperSize: PaperSize;
  bankCode: string;
  bankAccount: string;
  bankAccountName: string;
  showLogo: boolean;
  showStaff: boolean;
  showCustomer: boolean;
  showVietQR: boolean;
  logoUrl?: string;
}
