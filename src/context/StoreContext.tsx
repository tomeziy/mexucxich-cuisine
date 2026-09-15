import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, OrderStatus } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, DEFAULT_RECEIPT_SETTINGS } from '../data/initialData';

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  receiptSettings: ReceiptSettings;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>) => Customer;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  cancelOrder: (orderId: string) => void;
  payDebt: (customerId: string, amount: number, paymentMethod: 'cash' | 'transfer', note?: string) => void;
  updateReceiptSettings: (settings: Partial<ReceiptSettings>) => void;
  resetToMockData: () => void;
  importAllData: (jsonData: any) => boolean;
  exportAllData: () => any;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

const STORAGE_KEYS = {
  PRODUCTS: 'mxc_products',
  CUSTOMERS: 'mxc_customers',
  ORDERS: 'mxc_orders',
  DEBT_PAYMENTS: 'mxc_debt_payments',
  SETTINGS: 'mxc_receipt_settings',
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Products state
  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    return saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
  });

  // Orders state
  const [orders, setOrders] = useState<Order[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ORDERS);
    return saved ? JSON.parse(saved) : [];
  });

  // Debt payments state
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DEBT_PAYMENTS);
    return saved ? JSON.parse(saved) : [];
  });

  // Receipt settings state
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!saved) return DEFAULT_RECEIPT_SETTINGS;
    try {
      const parsed = JSON.parse(saved);
      // Auto-migrate legacy placeholder data to Hang's actual shop info
      if (parsed.bankAccount === '0859136899' || parsed.bankCode === 'MB' || !parsed.bankNote) {
        return {
          ...DEFAULT_RECEIPT_SETTINGS,
          ...parsed,
          bankCode: 'TCB',
          bankAccount: '10520110621010',
          bankAccountName: 'BÙI THỊ TUYẾT MAI',
          storeName: 'MEXUCXICH CUISINE',
          storeSubtitle: 'Đồ ăn homemade và đặc sản vùng miền',
          facebook: 'Hoàng Minh Hằng - 0904047976',
          bankNote: 'Nội dung: ghi rõ tên / Facebook / Sđt và gửi bill cho chủ shop ạ',
          footerMessage: 'Chúc quý khách có một bữa ăn hạnh phúc!',
        };
      }
      return { ...DEFAULT_RECEIPT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_RECEIPT_SETTINGS;
    }
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(debtPayments));
  }, [debtPayments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(receiptSettings));
  }, [receiptSettings]);

  // Product actions
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newId = 'SP' + String(Date.now()).slice(-4);
    const newProduct: Product = {
      ...productData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setProducts(prev => [newProduct, ...prev]);
    return newProduct;
  };

  const updateProduct = (id: string, updatedData: Partial<Product>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // Customer actions
  const addCustomer = (customerData: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>): Customer => {
    const newId = 'KH' + String(Date.now()).slice(-4);
    const newCustomer: Customer = {
      ...customerData,
      id: newId,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: new Date().toISOString(),
    };
    setCustomers(prev => [newCustomer, ...prev]);
    return newCustomer;
  };

  const updateCustomer = (id: string, updatedData: Partial<Customer>) => {
    setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updatedData } : c));
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
  };

  // Order actions
  const createOrder = (orderData: Omit<Order, 'id' | 'createdAt'>): Order => {
    const newId = 'HD' + Math.floor(1000 + Math.random() * 9000);
    const newOrder: Order = {
      ...orderData,
      id: newId,
      createdAt: new Date().toISOString(),
    };

    // 1. Deduct stock immediately (ADR-0003)
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = newOrder.items.find(i => i.productId === prod.id);
        if (item) {
          const newStock = Math.max(0, prod.stock - item.qty);
          return { ...prod, stock: newStock };
        }
        return prod;
      });
    });

    // 2. Update customer metrics & debt if applicable (ADR-0002)
    if (newOrder.customerId) {
      setCustomers(prevCustomers => {
        return prevCustomers.map(cust => {
          if (cust.id === newOrder.customerId) {
            const newDebt = cust.debt + (newOrder.debtAmount || 0);
            const newTotalSpent = (cust.totalSpent || 0) + newOrder.total;
            const newOrderCount = (cust.orderCount || 0) + 1;
            return {
              ...cust,
              debt: newDebt,
              totalSpent: newTotalSpent,
              orderCount: newOrderCount,
            };
          }
          return cust;
        });
      });
    }

    // 3. Save order to list
    setOrders(prev => [newOrder, ...prev]);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        return { ...order, status: newStatus };
      }
      return order;
    }));
  };

  // Cancel order with auto-restock (ADR-0003)
  const cancelOrder = (orderId: string) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status === 'cancelled') return;

    // 1. Auto-restock items
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = orderToCancel.items.find(i => i.productId === prod.id);
        if (item) {
          return { ...prod, stock: prod.stock + item.qty };
        }
        return prod;
      });
    });

    // 2. Reverse customer debt if order had debt
    if (orderToCancel.customerId && orderToCancel.debtAmount > 0) {
      setCustomers(prevCustomers => {
        return prevCustomers.map(cust => {
          if (cust.id === orderToCancel.customerId) {
            return {
              ...cust,
              debt: Math.max(0, cust.debt - orderToCancel.debtAmount),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToCancel.total),
              orderCount: Math.max(0, (cust.orderCount || 0) - 1),
            };
          }
          return cust;
        });
      });
    }

    // 3. Mark as cancelled
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
  };

  // Debt payment action (ADR-0002 - Running Balance)
  const payDebt = (customerId: string, amount: number, paymentMethod: 'cash' | 'transfer', note?: string) => {
    const targetCust = customers.find(c => c.id === customerId);
    if (!targetCust || amount <= 0) return;

    // 1. Record debt payment
    const newPayment: DebtPayment = {
      id: 'PT' + String(Date.now()).slice(-4),
      customerId,
      customerName: targetCust.name,
      amount,
      paymentMethod,
      note,
      createdAt: new Date().toISOString(),
    };
    setDebtPayments(prev => [newPayment, ...prev]);

    // 2. Reduce customer debt running balance
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return {
          ...c,
          debt: Math.max(0, c.debt - amount),
        };
      }
      return c;
    }));
  };

  // Receipt settings action
  const updateReceiptSettings = (newSettings: Partial<ReceiptSettings>) => {
    setReceiptSettings(prev => ({ ...prev, ...newSettings }));
  };

  // Reset data to mock
  const resetToMockData = () => {
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setOrders([]);
    setDebtPayments([]);
    setReceiptSettings(DEFAULT_RECEIPT_SETTINGS);
    localStorage.clear();
  };

  // Import / Export all
  const exportAllData = () => {
    return {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      products,
      customers,
      orders,
      debtPayments,
      receiptSettings,
    };
  };

  const importAllData = (jsonData: any): boolean => {
    try {
      if (!jsonData || typeof jsonData !== 'object') return false;
      if (Array.isArray(jsonData.products)) setProducts(jsonData.products);
      if (Array.isArray(jsonData.customers)) setCustomers(jsonData.customers);
      if (Array.isArray(jsonData.orders)) setOrders(jsonData.orders);
      if (Array.isArray(jsonData.debtPayments)) setDebtPayments(jsonData.debtPayments);
      if (jsonData.receiptSettings) setReceiptSettings(jsonData.receiptSettings);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <StoreContext.Provider
      value={{
        products,
        customers,
        orders,
        debtPayments,
        receiptSettings,
        addProduct,
        updateProduct,
        deleteProduct,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        createOrder,
        updateOrderStatus,
        cancelOrder,
        payDebt,
        updateReceiptSettings,
        resetToMockData,
        importAllData,
        exportAllData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = (): StoreContextType => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
