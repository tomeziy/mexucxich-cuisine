import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, OrderStatus, CloudConfig } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, DEFAULT_RECEIPT_SETTINGS } from '../data/initialData';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  cloudSyncProduct,
  cloudDeleteProduct,
  cloudSyncCustomer,
  cloudDeleteCustomer,
  cloudSyncOrder,
  cloudDeleteOrder,
  cloudSyncDebtPayment,
  cloudSyncSettings,
  pushAllDataToCloud,
  pullAllDataFromCloud,
} from '../services/supabase';

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  receiptSettings: ReceiptSettings;
  cloudConfig: CloudConfig;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>) => Customer;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  createOrder: (orderData: Omit<Order, 'id' | 'createdAt'>) => Order;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  updateOrder: (orderId: string, updatedOrder: Order) => void;
  deleteOrder: (orderId: string) => void;
  cancelOrder: (orderId: string) => void;
  payDebt: (customerId: string, amount: number, paymentMethod: 'cash' | 'transfer', note?: string) => void;
  updateReceiptSettings: (settings: Partial<ReceiptSettings>) => void;
  updateCloudConfig: (config: CloudConfig) => void;
  syncLocalToCloud: () => Promise<{ success: boolean; message: string }>;
  syncCloudToLocal: () => Promise<{ success: boolean; message: string }>;
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
  // Cloud Config state
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(getSupabaseConfig);

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

  // Initial pull from Supabase if configured and autoSync is enabled
  useEffect(() => {
    if (cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey && cloudConfig.autoSync) {
      pullAllDataFromCloud().then(cloudData => {
        if (cloudData && (cloudData.products.length > 0 || cloudData.orders.length > 0)) {
          setProducts(cloudData.products);
          setCustomers(cloudData.customers);
          setOrders(cloudData.orders);
          setDebtPayments(cloudData.debtPayments);
          if (cloudData.settings) {
            setReceiptSettings(prev => ({ ...prev, ...cloudData.settings }));
          }
          console.log('✅ Đã đồng bộ dữ liệu mới nhất từ Supabase Cloud!');
        }
      }).catch(err => {
        console.warn('Không thể tự động đồng bộ từ Cloud lúc mở app:', err);
      });
    }
  }, [cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey, cloudConfig.autoSync]);

  const updateCloudConfig = (newConfig: CloudConfig) => {
    saveSupabaseConfig(newConfig);
    setCloudConfig(newConfig);
  };

  const syncLocalToCloud = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    return await pushAllDataToCloud({
      products,
      customers,
      orders,
      debtPayments,
      settings: receiptSettings,
    });
  }, [products, customers, orders, debtPayments, receiptSettings]);

  const syncCloudToLocal = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    const cloudData = await pullAllDataFromCloud();
    if (!cloudData) {
      return { success: false, message: 'Không thể kết nối hoặc tải dữ liệu từ Supabase Cloud!' };
    }
    setProducts(cloudData.products);
    setCustomers(cloudData.customers);
    setOrders(cloudData.orders);
    setDebtPayments(cloudData.debtPayments);
    if (cloudData.settings) {
      setReceiptSettings(cloudData.settings);
    }
    return {
      success: true,
      message: `Đã nạp thành công ${cloudData.products.length} món, ${cloudData.customers.length} khách, ${cloudData.orders.length} đơn từ Cloud về máy!`,
    };
  }, []);

  // Product actions
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newId = 'SP' + String(Date.now()).slice(-4);
    const newProduct: Product = {
      ...productData,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    setProducts(prev => [newProduct, ...prev]);
    cloudSyncProduct(newProduct);
    return newProduct;
  };

  const updateProduct = (id: string, updatedData: Partial<Product>) => {
    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updatedData };
          cloudSyncProduct(updated);
          return updated;
        }
        return p;
      })
    );
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    cloudDeleteProduct(id);
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
    cloudSyncCustomer(newCustomer);
    return newCustomer;
  };

  const updateCustomer = (id: string, updatedData: Partial<Customer>) => {
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, ...updatedData };
          cloudSyncCustomer(updated);
          return updated;
        }
        return c;
      })
    );
  };

  const deleteCustomer = (id: string) => {
    setCustomers(prev => prev.filter(c => c.id !== id));
    cloudDeleteCustomer(id);
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
          const updated = { ...prod, stock: newStock };
          cloudSyncProduct(updated);
          return updated;
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
            const updated = {
              ...cust,
              debt: newDebt,
              totalSpent: newTotalSpent,
              orderCount: newOrderCount,
            };
            cloudSyncCustomer(updated);
            return updated;
          }
          return cust;
        });
      });
    }

    // 3. Save order to list & Cloud
    setOrders(prev => [newOrder, ...prev]);
    cloudSyncOrder(newOrder);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders(prev =>
      prev.map(order => {
        if (order.id === orderId) {
          const updated = { ...order, status: newStatus };
          cloudSyncOrder(updated);
          return updated;
        }
        return order;
      })
    );
  };

  // SỬA HÓA ĐƠN TOÀN DIỆN (ADR-0006)
  const updateOrder = (orderId: string, updatedOrder: Order) => {
    const oldOrder = orders.find(o => o.id === orderId);
    if (!oldOrder) return;

    // 1. TÍNH BÙ TRỪ TỒN KHO (Stock Delta) nếu đơn không ở trạng thái 'cancelled'
    if (oldOrder.status !== 'cancelled' && updatedOrder.status !== 'cancelled') {
      setProducts(prevProducts => {
        return prevProducts.map(prod => {
          const oldItem = oldOrder.items.find(i => i.productId === prod.id);
          const newItem = updatedOrder.items.find(i => i.productId === prod.id);
          const oldQty = oldItem?.qty || 0;
          const newQty = newItem?.qty || 0;
          const delta = newQty - oldQty; // dương = mua thêm, âm = bớt đi

          if (delta !== 0) {
            const newStock = Math.max(0, prod.stock - delta);
            const updated = { ...prod, stock: newStock };
            cloudSyncProduct(updated);
            return updated;
          }
          return prod;
        });
      });
    }

    // 2. TÍNH BÙ TRỪ CÔNG NỢ & DOANH THU KHÁCH HÀNG (ADR-0002 & ADR-0006)
    setCustomers(prevCustomers => {
      // Trường hợp cùng 1 khách hàng
      if (oldOrder.customerId === updatedOrder.customerId && updatedOrder.customerId) {
        const debtDelta = (updatedOrder.debtAmount || 0) - (oldOrder.debtAmount || 0);
        const spentDelta = updatedOrder.total - oldOrder.total;

        return prevCustomers.map(cust => {
          if (cust.id === updatedOrder.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt + debtDelta),
              totalSpent: Math.max(0, (cust.totalSpent || 0) + spentDelta),
            };
            cloudSyncCustomer(updated);
            return updated;
          }
          return cust;
        });
      }

      // Trường hợp thay đổi khách hàng cho đơn
      return prevCustomers.map(cust => {
        if (oldOrder.customerId && cust.id === oldOrder.customerId) {
          // Trừ lại của khách cũ
          const updated = {
            ...cust,
            debt: Math.max(0, cust.debt - (oldOrder.debtAmount || 0)),
            totalSpent: Math.max(0, (cust.totalSpent || 0) - oldOrder.total),
            orderCount: Math.max(0, (cust.orderCount || 0) - 1),
          };
          cloudSyncCustomer(updated);
          return updated;
        }
        if (updatedOrder.customerId && cust.id === updatedOrder.customerId) {
          // Cộng sang cho khách mới
          const updated = {
            ...cust,
            debt: cust.debt + (updatedOrder.debtAmount || 0),
            totalSpent: (cust.totalSpent || 0) + updatedOrder.total,
            orderCount: (cust.orderCount || 0) + 1,
          };
          cloudSyncCustomer(updated);
          return updated;
        }
        return cust;
      });
    });

    // 3. CẬP NHẬT ĐƠN HÀNG TRONG DANH SÁCH & CLOUD
    setOrders(prev => prev.map(o => (o.id === orderId ? updatedOrder : o)));
    cloudSyncOrder(updatedOrder);
  };

  // XÓA VĨNH VIỄN HÓA ĐƠN KÈM HOÀN KHO & TRỪ NỢ (ADR-0006)
  const deleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;

    // 1. Tự động hoàn kho các món nếu đơn chưa từng bị hủy (đơn hủy trước đó đã hoàn kho rồi)
    if (orderToDelete.status !== 'cancelled') {
      setProducts(prevProducts => {
        return prevProducts.map(prod => {
          const item = orderToDelete.items.find(i => i.productId === prod.id);
          if (item) {
            const updated = { ...prod, stock: prod.stock + item.qty };
            cloudSyncProduct(updated);
            return updated;
          }
          return prod;
        });
      });

      // 2. Giảm trừ dư nợ & doanh thu lũy kế của khách hàng
      if (orderToDelete.customerId) {
        setCustomers(prevCustomers => {
          return prevCustomers.map(cust => {
            if (cust.id === orderToDelete.customerId) {
              const updated = {
                ...cust,
                debt: Math.max(0, cust.debt - (orderToDelete.debtAmount || 0)),
                totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToDelete.total),
                orderCount: Math.max(0, (cust.orderCount || 0) - 1),
              };
              cloudSyncCustomer(updated);
              return updated;
            }
            return cust;
          });
        });
      }
    }

    // 3. Xóa đơn khỏi danh sách & Cloud
    setOrders(prev => prev.filter(o => o.id !== orderId));
    cloudDeleteOrder(orderId);
  };

  // Hủy đơn hàng (Soft-cancel với auto-restock - ADR-0003)
  const cancelOrder = (orderId: string) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status === 'cancelled') return;

    // 1. Auto-restock items
    setProducts(prevProducts => {
      return prevProducts.map(prod => {
        const item = orderToCancel.items.find(i => i.productId === prod.id);
        if (item) {
          const updated = { ...prod, stock: prod.stock + item.qty };
          cloudSyncProduct(updated);
          return updated;
        }
        return prod;
      });
    });

    // 2. Reverse customer debt if order had debt
    if (orderToCancel.customerId && orderToCancel.debtAmount > 0) {
      setCustomers(prevCustomers => {
        return prevCustomers.map(cust => {
          if (cust.id === orderToCancel.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt - orderToCancel.debtAmount),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToCancel.total),
              orderCount: Math.max(0, (cust.orderCount || 0) - 1),
            };
            cloudSyncCustomer(updated);
            return updated;
          }
          return cust;
        });
      });
    }

    // 3. Mark as cancelled & Cloud
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const updated = { ...o, status: 'cancelled' as OrderStatus };
          cloudSyncOrder(updated);
          return updated;
        }
        return o;
      })
    );
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
    cloudSyncDebtPayment(newPayment);

    // 2. Reduce customer debt running balance
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === customerId) {
          const updated = {
            ...c,
            debt: Math.max(0, c.debt - amount),
          };
          cloudSyncCustomer(updated);
          return updated;
        }
        return c;
      })
    );
  };

  // Receipt settings action
  const updateReceiptSettings = (newSettings: Partial<ReceiptSettings>) => {
    setReceiptSettings(prev => {
      const updated = { ...prev, ...newSettings };
      cloudSyncSettings(updated);
      return updated;
    });
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
        cloudConfig,
        addProduct,
        updateProduct,
        deleteProduct,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        createOrder,
        updateOrderStatus,
        updateOrder,
        deleteOrder,
        cancelOrder,
        payDebt,
        updateReceiptSettings,
        updateCloudConfig,
        syncLocalToCloud,
        syncCloudToLocal,
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
