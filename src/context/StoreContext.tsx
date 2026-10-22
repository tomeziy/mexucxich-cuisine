import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Product, Customer, Order, DebtPayment, ReceiptSettings, OrderStatus, CloudConfig } from '../types';
import { INITIAL_PRODUCTS, INITIAL_CUSTOMERS, DEFAULT_RECEIPT_SETTINGS } from '../data/initialData';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  cloudSyncProduct,
  cloudDeleteProduct,
  cloudSyncProductsBatch,
  cloudSyncCustomer,
  cloudDeleteCustomer,
  cloudSyncCustomersBatch,
  cloudSyncOrder,
  cloudDeleteOrder,
  cloudSyncDebtPayment,
  cloudSyncSettings,
  pushAllDataToCloud,
  pullAllDataFromCloud,
  cloudAdjustProductStock,
  cloudAdjustProductsStockBatch,
  mergeProductsWithConflictResolution,
  mergeCustomersWithConflictResolution,
  mergeOrders,
  mergeDebtPayments,
  calculateStockDelta,
} from '../services/supabase';

interface StoreContextType {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  debtPayments: DebtPayment[];
  receiptSettings: ReceiptSettings;
  cloudConfig: CloudConfig;
  addProduct: (product: Omit<Product, 'id'>) => Product;
  addProductsBatch: (products: Array<Omit<Product, 'id'>>) => Product[];
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'debt' | 'totalSpent' | 'orderCount'>) => Customer;
  addCustomersBatch: (customers: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>) => Customer[];
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
    const initial: Product[] = saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
    return initial.map(p => ({
      ...p,
      updatedAt: p.updatedAt || p.createdAt || '2026-09-01T08:00:00Z',
    }));
  });

  // Customers state
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    const initial: Customer[] = saved ? JSON.parse(saved) : INITIAL_CUSTOMERS;
    return initial.map(c => ({
      ...c,
      updatedAt: c.updatedAt || c.createdAt || '2026-09-01T08:00:00Z',
    }));
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

  // Đồng bộ ref lưu giữ state mới nhất phục vụ pullAllDataFromCloud chống stale closure
  const stateRef = useRef({ products, customers, orders, debtPayments, receiptSettings });
  useEffect(() => {
    stateRef.current = { products, customers, orders, debtPayments, receiptSettings };
  }, [products, customers, orders, debtPayments, receiptSettings]);

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

  // Initial pull and auto-refresh on tab focus/visibility change from Supabase
  useEffect(() => {
    const refreshCloud = () => {
      if (cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey && cloudConfig.autoSync) {
        const localData = {
          products: stateRef.current.products,
          customers: stateRef.current.customers,
          orders: stateRef.current.orders,
          debtPayments: stateRef.current.debtPayments,
        };

        pullAllDataFromCloud(localData).then(cloudData => {
          if (cloudData && (cloudData.products.length > 0 || cloudData.orders.length > 0)) {
            setProducts(cloudData.products);
            setCustomers(cloudData.customers);
            setOrders(cloudData.orders);
            setDebtPayments(cloudData.debtPayments);
            if (cloudData.settings) {
              setReceiptSettings(prev => ({ ...prev, ...cloudData.settings }));
            }
            console.log('✅ Đã đồng bộ dữ liệu mới nhất từ Supabase Cloud kèm giải quyết xung đột!');
          }
        }).catch(err => {
          console.warn('Không thể tự động đồng bộ từ Cloud:', err);
        });
      }
    };

    // Run on mount
    refreshCloud();

    // Auto-refresh when user switches back to browser tab on mobile
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        refreshCloud();
      }
    };

    window.addEventListener('focus', refreshCloud);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', refreshCloud);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
    const localData = {
      products: stateRef.current.products,
      customers: stateRef.current.customers,
      orders: stateRef.current.orders,
      debtPayments: stateRef.current.debtPayments,
    };

    const pullRes = await pullAllDataFromCloud(localData);
    if (!pullRes) {
      return { success: false, message: 'Không thể kết nối hoặc tải dữ liệu từ Supabase Cloud!' };
    }

    // 1. Đồng bộ tức thời vào localStorage tránh Race Condition khi trang reload (ADR-0008)
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(pullRes.products));
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(pullRes.customers));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(pullRes.orders));
    localStorage.setItem(STORAGE_KEYS.DEBT_PAYMENTS, JSON.stringify(pullRes.debtPayments));
    if (pullRes.settings) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(pullRes.settings));
    }

    // 2. Cập nhật React state
    setProducts(pullRes.products);
    setCustomers(pullRes.customers);
    setOrders(pullRes.orders);
    setDebtPayments(pullRes.debtPayments);
    if (pullRes.settings) {
      setReceiptSettings(pullRes.settings);
    }

    const preservedCount = pullRes.localPreservedCount || 0;
    const note = preservedCount > 0
      ? ` (Đã bảo toàn ${preservedCount} bản ghi có cập nhật mới hơn trên máy)`
      : '';

    return {
      success: true,
      message: `Đã nạp thành công ${pullRes.products.length} món, ${pullRes.customers.length} khách, ${pullRes.orders.length} đơn từ Cloud về máy!${note}`,
    };
  }, []);

  // Product actions
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newId = `SP_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newProduct: Product = {
      ...productData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };
    setProducts(prev => [newProduct, ...prev]);
    cloudSyncProduct(newProduct);
    return newProduct;
  };

  const addProductsBatch = (productsData: Array<Omit<Product, 'id'>>): Product[] => {
    const timestamp = Date.now();
    const now = new Date().toISOString();
    const newProducts: Product[] = productsData.map((p, idx) => ({
      ...p,
      id: `SP_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: now,
      updatedAt: now,
    }));
    setProducts(prev => [...newProducts, ...prev]);
    cloudSyncProductsBatch(newProducts);
    return newProducts;
  };

  const updateProduct = (id: string, updatedData: Partial<Product>) => {
    const now = new Date().toISOString();
    setProducts(prev =>
      prev.map(p => {
        if (p.id === id) {
          const updated = { ...p, ...updatedData, updatedAt: now };
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
    const newId = `KH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      ...customerData,
      id: newId,
      debt: 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    setCustomers(prev => [newCustomer, ...prev]);
    cloudSyncCustomer(newCustomer);
    return newCustomer;
  };

  const addCustomersBatch = (customersData: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>>): Customer[] => {
    const timestamp = Date.now();
    const now = new Date().toISOString();
    const newCustomers: Customer[] = customersData.map((c, idx) => ({
      ...c,
      id: `KH_${timestamp}_${idx}_${Math.random().toString(36).substring(2, 6)}`,
      debt: c.debt || 0,
      totalSpent: 0,
      orderCount: 0,
      createdAt: now,
      updatedAt: now,
    }));
    setCustomers(prev => [...newCustomers, ...prev]);
    cloudSyncCustomersBatch(newCustomers);
    return newCustomers;
  };

  const updateCustomer = (id: string, updatedData: Partial<Customer>) => {
    const now = new Date().toISOString();
    setCustomers(prev =>
      prev.map(c => {
        if (c.id === id) {
          const updated = { ...c, ...updatedData, updatedAt: now };
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
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...orderData,
      id: newId,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Trừ tồn kho nguyên tử chống Race Condition (ADR-0003 & ADR-0008)
    // Gom nhóm số lượng theo productId để xử lý chính xác nhiều dòng cùng 1 món
    const qtyByProduct = new Map<string, number>();
    for (const item of newOrder.items || []) {
      if (item && item.productId) {
        qtyByProduct.set(
          item.productId,
          Math.round(((qtyByProduct.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
        );
      }
    }

    if (qtyByProduct.size > 0) {
      setProducts(prevProducts =>
        prevProducts.map(prod => {
          const qty = qtyByProduct.get(prod.id);
          if (qty && qty > 0) {
            const newStock = calculateStockDelta(prod.stock, -qty);
            return { ...prod, stock: newStock, updatedAt: now };
          }
          return prod;
        })
      );

      const adjustments = Array.from(qtyByProduct.entries()).map(([productId, qty]) => ({
        productId,
        delta: Math.round(-qty * 10000) / 10000,
      }));

      cloudAdjustProductsStockBatch(adjustments).then(results => {
        if (results && results.length > 0) {
          setProducts(prev =>
            prev.map(p => {
              const match = results.find(r => r.productId === p.id && r.success && typeof r.newStock === 'number');
              if (match && typeof match.newStock === 'number') {
                return { ...p, stock: Math.round(match.newStock * 10000) / 10000 };
              }
              return p;
            })
          );
        }
      });
    }

    // 2. Update customer metrics & debt if applicable (ADR-0002)
    if (newOrder.customerId) {
      setCustomers(prevCustomers => {
        let updatedCust: Customer | null = null;
        const nextList = prevCustomers.map(cust => {
          if (cust.id === newOrder.customerId) {
            const newDebt = cust.debt + (newOrder.debtAmount || 0);
            const newTotalSpent = (cust.totalSpent || 0) + newOrder.total;
            const newOrderCount = (cust.orderCount || 0) + 1;
            const updated = {
              ...cust,
              debt: newDebt,
              totalSpent: newTotalSpent,
              orderCount: newOrderCount,
              updatedAt: now,
            };
            updatedCust = updated;
            return updated;
          }
          return cust;
        });
        if (updatedCust) {
          cloudSyncCustomer(updatedCust);
        }
        return nextList;
      });
    }

    // 3. Save order to list & Cloud
    setOrders(prev => [newOrder, ...prev]);
    cloudSyncOrder(newOrder);
    return newOrder;
  };

  const updateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    const now = new Date().toISOString();
    let updatedOrder: Order | null = null;
    setOrders(prev =>
      prev.map(order => {
        if (order.id === orderId) {
          const updated = { ...order, status: newStatus, updatedAt: now };
          updatedOrder = updated;
          return updated;
        }
        return order;
      })
    );
    if (updatedOrder) {
      cloudSyncOrder(updatedOrder);
    }
  };

  // SỬA HÓA ĐƠN TOÀN DIỆN (ADR-0006 & ADR-0008)
  const updateOrder = (orderId: string, updatedOrder: Order) => {
    const oldOrder = orders.find(o => o.id === orderId);
    if (!oldOrder) return;
    const now = new Date().toISOString();

    // 1. TÍNH BÙ TRỪ TỒN KHO NGUYÊN TỬ (ADR-0006 & ADR-0008) nếu đơn không ở trạng thái 'cancelled'
    if (oldOrder.status !== 'cancelled' && updatedOrder.status !== 'cancelled') {
      const oldQtyMap = new Map<string, number>();
      for (const item of oldOrder.items || []) {
        if (item && item.productId) {
          oldQtyMap.set(
            item.productId,
            Math.round(((oldQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const newQtyMap = new Map<string, number>();
      for (const item of updatedOrder.items || []) {
        if (item && item.productId) {
          newQtyMap.set(
            item.productId,
            Math.round(((newQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const allProdIds = new Set([...oldQtyMap.keys(), ...newQtyMap.keys()]);
      const adjustments: Array<{ productId: string; delta: number }> = [];

      for (const pId of allProdIds) {
        const oldQ = oldQtyMap.get(pId) || 0;
        const newQ = newQtyMap.get(pId) || 0;
        const qtyDiff = Math.round((newQ - oldQ) * 10000) / 10000; // dương = mua thêm (delta = -qtyDiff), âm = bớt đi (delta = +)
        if (qtyDiff !== 0) {
          adjustments.push({ productId: pId, delta: Math.round(-qtyDiff * 10000) / 10000 });
        }
      }

      if (adjustments.length > 0) {
        const deltaMap = new Map(adjustments.map(a => [a.productId, a.delta]));
        setProducts(prevProducts =>
          prevProducts.map(prod => {
            const delta = deltaMap.get(prod.id);
            if (delta !== undefined && delta !== 0) {
              const newStock = calculateStockDelta(prod.stock, delta);
              return { ...prod, stock: newStock, updatedAt: now };
            }
            return prod;
          })
        );

        cloudAdjustProductsStockBatch(adjustments).then(results => {
          if (results && results.length > 0) {
            setProducts(prev =>
              prev.map(p => {
                const match = results.find(r => r.productId === p.id && r.success && typeof r.newStock === 'number');
                if (match && typeof match.newStock === 'number') {
                  return { ...p, stock: Math.round(match.newStock * 10000) / 10000 };
                }
                return p;
              })
            );
          }
        });
      }
    }

    // 2. TÍNH BÙ TRỪ CÔNG NỢ & DOANH THU KHÁCH HÀNG (ADR-0002 & ADR-0006)
    setCustomers(prevCustomers => {
      const customersToSync: Customer[] = [];
      let nextList = prevCustomers;

      // Trường hợp cùng 1 khách hàng
      if (oldOrder.customerId === updatedOrder.customerId && updatedOrder.customerId) {
        const debtDelta = (updatedOrder.debtAmount || 0) - (oldOrder.debtAmount || 0);
        const spentDelta = updatedOrder.total - oldOrder.total;

        nextList = prevCustomers.map(cust => {
          if (cust.id === updatedOrder.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt + debtDelta),
              totalSpent: Math.max(0, (cust.totalSpent || 0) + spentDelta),
              updatedAt: now,
            };
            customersToSync.push(updated);
            return updated;
          }
          return cust;
        });
      } else {
        // Trường hợp thay đổi khách hàng cho đơn
        nextList = prevCustomers.map(cust => {
          if (oldOrder.customerId && cust.id === oldOrder.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt - (oldOrder.debtAmount || 0)),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - oldOrder.total),
              orderCount: Math.max(0, (cust.orderCount || 0) - 1),
              updatedAt: now,
            };
            customersToSync.push(updated);
            return updated;
          }
          if (updatedOrder.customerId && cust.id === updatedOrder.customerId) {
            const updated = {
              ...cust,
              debt: cust.debt + (updatedOrder.debtAmount || 0),
              totalSpent: (cust.totalSpent || 0) + updatedOrder.total,
              orderCount: (cust.orderCount || 0) + 1,
              updatedAt: now,
            };
            customersToSync.push(updated);
            return updated;
          }
          return cust;
        });
      }

      for (const c of customersToSync) {
        cloudSyncCustomer(c);
      }
      return nextList;
    });

    // 3. CẬP NHẬT ĐƠN HÀNG TRONG DANH SÁCH & CLOUD
    const orderToSave: Order = { ...updatedOrder, updatedAt: now };
    setOrders(prev => prev.map(o => (o.id === orderId ? orderToSave : o)));
    cloudSyncOrder(orderToSave);
  };

  // XÓA VĨNH VIỄN HÓA ĐƠN KÈM HOÀN KHO & TRỪ NỢ (ADR-0006 & ADR-0008)
  const deleteOrder = (orderId: string) => {
    const orderToDelete = orders.find(o => o.id === orderId);
    if (!orderToDelete) return;
    const now = new Date().toISOString();

    // 1. Tự động hoàn kho các món nguyên tử nếu đơn chưa từng bị hủy
    if (orderToDelete.status !== 'cancelled') {
      const returnQtyMap = new Map<string, number>();
      for (const item of orderToDelete.items || []) {
        if (item && item.productId) {
          returnQtyMap.set(
            item.productId,
            Math.round(((returnQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
          );
        }
      }

      const adjustments = Array.from(returnQtyMap.entries()).map(([productId, qty]) => ({
        productId,
        delta: Math.round(qty * 10000) / 10000, // hoàn kho: delta dương
      }));

      if (adjustments.length > 0) {
        const deltaMap = new Map(adjustments.map(a => [a.productId, a.delta]));
        setProducts(prevProducts =>
          prevProducts.map(prod => {
            const delta = deltaMap.get(prod.id);
            if (delta !== undefined && delta !== 0) {
              const newStock = calculateStockDelta(prod.stock, delta);
              return { ...prod, stock: newStock, updatedAt: now };
            }
            return prod;
          })
        );

        cloudAdjustProductsStockBatch(adjustments).then(results => {
          if (results && results.length > 0) {
            setProducts(prev =>
              prev.map(p => {
                const match = results.find(r => r.productId === p.id && r.success && typeof r.newStock === 'number');
                if (match && typeof match.newStock === 'number') {
                  return { ...p, stock: Math.round(match.newStock * 10000) / 10000 };
                }
                return p;
              })
            );
          }
        });
      }

      // 2. Giảm trừ dư nợ & doanh thu lũy kế của khách hàng
      if (orderToDelete.customerId) {
        setCustomers(prevCustomers => {
          let updatedCust: Customer | null = null;
          const nextList = prevCustomers.map(cust => {
            if (cust.id === orderToDelete.customerId) {
              const updated = {
                ...cust,
                debt: Math.max(0, cust.debt - (orderToDelete.debtAmount || 0)),
                totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToDelete.total),
                orderCount: Math.max(0, (cust.orderCount || 0) - 1),
                updatedAt: now,
              };
              updatedCust = updated;
              return updated;
            }
            return cust;
          });
          if (updatedCust) {
            cloudSyncCustomer(updatedCust);
          }
          return nextList;
        });
      }
    }

    // 3. Xóa đơn khỏi danh sách & Cloud
    setOrders(prev => prev.filter(o => o.id !== orderId));
    cloudDeleteOrder(orderId);
  };

  // Hủy đơn hàng (Soft-cancel với auto-restock nguyên tử - ADR-0003 & ADR-0008)
  const cancelOrder = (orderId: string) => {
    const orderToCancel = orders.find(o => o.id === orderId);
    if (!orderToCancel || orderToCancel.status === 'cancelled') return;
    const now = new Date().toISOString();

    // 1. Auto-restock items nguyên tử
    const returnQtyMap = new Map<string, number>();
    for (const item of orderToCancel.items || []) {
      if (item && item.productId) {
        returnQtyMap.set(
          item.productId,
          Math.round(((returnQtyMap.get(item.productId) || 0) + (Number(item.qty) || 0)) * 10000) / 10000
        );
      }
    }

    const adjustments = Array.from(returnQtyMap.entries()).map(([productId, qty]) => ({
      productId,
      delta: Math.round(qty * 10000) / 10000, // restock
    }));

    if (adjustments.length > 0) {
      const deltaMap = new Map(adjustments.map(a => [a.productId, a.delta]));
      setProducts(prevProducts =>
        prevProducts.map(prod => {
          const delta = deltaMap.get(prod.id);
          if (delta !== undefined && delta !== 0) {
            const newStock = calculateStockDelta(prod.stock, delta);
            return { ...prod, stock: newStock, updatedAt: now };
          }
          return prod;
        })
      );

      cloudAdjustProductsStockBatch(adjustments).then(results => {
        if (results && results.length > 0) {
          setProducts(prev =>
            prev.map(p => {
              const match = results.find(r => r.productId === p.id && r.success && typeof r.newStock === 'number');
              if (match && typeof match.newStock === 'number') {
                return { ...p, stock: Math.round(match.newStock * 10000) / 10000 };
              }
              return p;
            })
          );
        }
      });
    }

    // 2. Reverse customer debt if order had debt
    if (orderToCancel.customerId && orderToCancel.debtAmount > 0) {
      setCustomers(prevCustomers => {
        let updatedCust: Customer | null = null;
        const nextList = prevCustomers.map(cust => {
          if (cust.id === orderToCancel.customerId) {
            const updated = {
              ...cust,
              debt: Math.max(0, cust.debt - orderToCancel.debtAmount),
              totalSpent: Math.max(0, (cust.totalSpent || 0) - orderToCancel.total),
              orderCount: Math.max(0, (cust.orderCount || 0) - 1),
              updatedAt: now,
            };
            updatedCust = updated;
            return updated;
          }
          return cust;
        });
        if (updatedCust) {
          cloudSyncCustomer(updatedCust);
        }
        return nextList;
      });
    }

    // 3. Mark as cancelled & Cloud
    setOrders(prev =>
      prev.map(o => {
        if (o.id === orderId) {
          const updated = { ...o, status: 'cancelled' as OrderStatus, updatedAt: now };
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
    const now = new Date().toISOString();

    // 1. Record debt payment
    const newPayment: DebtPayment = {
      id: 'PT' + Math.floor(1000 + Math.random() * 9000),
      customerId,
      customerName: targetCust.name,
      amount,
      paymentMethod,
      note,
      createdAt: now,
      updatedAt: now,
    };
    setDebtPayments(prev => [newPayment, ...prev]);
    cloudSyncDebtPayment(newPayment);

    // 2. Reduce customer debt running balance
    setCustomers(prev => {
      let updatedCust: Customer | null = null;
      const nextList = prev.map(c => {
        if (c.id === customerId) {
          const updated = {
            ...c,
            debt: Math.max(0, c.debt - amount),
            updatedAt: now,
          };
          updatedCust = updated;
          return updated;
        }
        return c;
      });
      if (updatedCust) {
        cloudSyncCustomer(updatedCust);
      }
      return nextList;
    });
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
        addProductsBatch,
        updateProduct,
        deleteProduct,
        addCustomer,
        addCustomersBatch,
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
