import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, OrderItem, Order, OrderType, PaymentMethod, OrderStatus } from '../types';
import { matchesSearch } from '../utils/vietnamese';
import { formatVND, formatDate } from '../utils/format';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { QuickAddCustomerModal } from '../components/pos/QuickAddCustomerModal';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  UserPlus,
  QrCode,
  AlertTriangle,
  Receipt,
  Truck,
  Store,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface CartItem extends OrderItem {}

export const PosPage: React.FC = () => {
  const {
    products,
    customers,
    orders,
    receiptSettings,
    createOrder,
    updateOrderStatus,
    cancelOrder,
  } = useStore();

  // Mode & Tabs
  const [activeTab, setActiveTab] = useState<'pos' | 'preparing' | 'delivering'>('pos');
  const [orderType, setOrderType] = useState<OrderType>('direct');

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || 'KH01');
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountType, setDiscountType] = useState<'cash' | 'percent'>('cash');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingNote, setShippingNote] = useState<string>('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashGiven, setCashGiven] = useState<number>(0);
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(0);

  // Receipt Modal state
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Categories
  const categories = ['Tất cả', 'Đồ tự làm', 'Đặc sản tuyển chọn', 'Ăn vặt & Khô', 'Gia vị & Sốt'];

  // Orders counts
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const deliveringOrders = orders.filter(o => o.status === 'delivering');

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
    const matchesQuery = matchesSearch(p.name, searchQuery) || matchesSearch(p.id, searchQuery);
    const matchesStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'in_stock'
        ? p.stock > 0
        : p.stock <= 5;
    return matchesCat && matchesQuery && matchesStock;
  });

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

  // Cart Actions
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`Món "${product.name}" hiện đã hết hàng trong kho!`);
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          alert(`Món "${product.name}" chỉ còn ${product.stock} ${product.unit} trong kho!`);
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          price: product.price,
          cost: product.cost,
          qty: 1,
          image: product.image,
        },
      ];
    });
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    setCart(prev => {
      const existing = prev.find(item => item.productId === productId);
      if (!existing) return prev;

      const newQty = existing.qty + delta;
      if (newQty <= 0) {
        return prev.filter(item => item.productId !== productId);
      }
      if (newQty > product.stock) {
        alert(`Món "${product.name}" chỉ còn ${product.stock} ${product.unit} trong kho!`);
        return prev;
      }
      return prev.map(item =>
        item.productId === productId ? { ...item, qty: newQty } : item
      );
    });
  };

  const handleRemoveItem = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountValue(0);
    setShippingFee(0);
    setShippingNote('');
    setCashGiven(0);
    setPartialPaidAmount(0);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100);
  } else {
    discountAmount = Math.min(subtotal, Math.max(0, discountValue));
  }

  const effectiveShippingFee = orderType === 'delivery' ? Math.max(0, shippingFee) : 0;
  const totalToPay = Math.max(0, subtotal - discountAmount) + effectiveShippingFee;

  let finalPaidAmount = totalToPay;
  let finalDebtAmount = 0;
  let changeAmount = 0;

  if (paymentMethod === 'cash') {
    changeAmount = Math.max(0, cashGiven - totalToPay);
    finalPaidAmount = totalToPay;
    finalDebtAmount = 0;
  } else if (paymentMethod === 'transfer') {
    finalPaidAmount = totalToPay;
    finalDebtAmount = 0;
  } else if (paymentMethod === 'debt') {
    finalPaidAmount = 0;
    finalDebtAmount = totalToPay;
  } else if (paymentMethod === 'partial') {
    finalPaidAmount = Math.min(totalToPay, Math.max(0, partialPaidAmount));
    finalDebtAmount = Math.max(0, totalToPay - finalPaidAmount);
  }

  const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Checkout
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Vui lòng chọn món ăn vào giỏ trước khi thanh toán!');
      return;
    }

    if (orderType === 'delivery' && !selectedCustomer?.phone && !selectedCustomer?.address) {
      if (!window.confirm('Đơn giao hàng chưa có SĐT hoặc địa chỉ khách. Bạn vẫn muốn tiếp tục?')) {
        return;
      }
    }

    const orderStatus: OrderStatus = orderType === 'direct' ? 'completed' : 'preparing';

    const newOrder = createOrder({
      customerId: selectedCustomer?.id || 'KH01',
      customerName: selectedCustomer?.name || 'Khách lẻ tại quầy',
      customerPhone: selectedCustomer?.phone || '',
      customerAddress: selectedCustomer?.address || '',
      orderType,
      status: orderStatus,
      items: [...cart],
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      shippingFee: effectiveShippingFee,
      shippingNote: orderType === 'delivery' ? shippingNote : undefined,
      total: totalToPay,
      paymentMethod,
      cashGiven: paymentMethod === 'cash' ? (cashGiven > 0 ? cashGiven : totalToPay) : undefined,
      change: paymentMethod === 'cash' ? changeAmount : 0,
      paidAmount: finalPaidAmount,
      debtAmount: finalDebtAmount,
    });

    setCompletedOrder(newOrder);
    setIsReceiptOpen(true);
    handleClearCart();
  };

  return (
    <div className="space-y-3.5">
      {/* TOP STATUS PILL TABS */}
      <div className="grid grid-cols-3 bg-white p-1 rounded-2xl border border-slate-200 text-xs font-bold shadow-xs">
        <button
          onClick={() => setActiveTab('pos')}
          className={`py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 ${
            activeTab === 'pos'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Store className="w-4 h-4" />
          <span>Bán tại quầy</span>
        </button>

        <button
          onClick={() => setActiveTab('preparing')}
          className={`py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 ${
            activeTab === 'preparing'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Đang chuẩn bị ({preparingOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('delivering')}
          className={`py-2 rounded-xl text-center transition flex items-center justify-center gap-1.5 ${
            activeTab === 'delivering'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Đang giao ({deliveringOrders.length})</span>
        </button>
      </div>

      {/* VIEW: ACTIVE DELIVERY ORDERS (PREPARING OR DELIVERING) */}
      {activeTab !== 'pos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              {activeTab === 'preparing' ? (
                <>
                  <Clock className="w-4 h-4 text-amber-500" />
                  <span>Danh sách đơn đang chuẩn bị ({preparingOrders.length})</span>
                </>
              ) : (
                <>
                  <Truck className="w-4 h-4 text-blue-500" />
                  <span>Danh sách đơn đang giao ({deliveringOrders.length})</span>
                </>
              )}
            </h3>
            <button
              onClick={() => setActiveTab('pos')}
              className="text-xs font-bold text-amber-600 hover:underline"
            >
              + Tạo đơn mới
            </button>
          </div>

          {(activeTab === 'preparing' ? preparingOrders : deliveringOrders).length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <p className="text-3xl mb-1.5">📦</p>
              <p>Hiện không có đơn hàng nào ở trạng thái này</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(activeTab === 'preparing' ? preparingOrders : deliveringOrders).map(order => (
                <div
                  key={order.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-amber-400 transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900 text-xs">#{order.id}</strong>
                      <span className="text-[10px] text-slate-400">{formatDate(order.createdAt)}</span>
                      <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                        {order.customerName}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 font-medium line-clamp-1">
                      {order.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
                    </p>

                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Tổng: <strong className="text-amber-700 font-bold">{formatVND(order.total)}</strong></span>
                      {order.shippingFee > 0 && <span>Ship: {formatVND(order.shippingFee)}</span>}
                      {order.shippingNote && <span className="italic">({order.shippingNote})</span>}
                      {order.debtAmount > 0 && (
                        <span className="text-rose-600 font-bold">Nợ: {formatVND(order.debtAmount)}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for this delivery order */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => {
                        setCompletedOrder(order);
                        setIsReceiptOpen(true);
                      }}
                      className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600"
                      title="Xem hóa đơn K80"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {order.status === 'preparing' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'delivering')}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Bắt đầu giao</span>
                      </button>
                    )}

                    {order.status === 'delivering' && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hoàn thành</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (window.confirm(`Hủy đơn #${order.id}? Hệ thống sẽ TỰ ĐỘNG HOÀN KHO lại các món ăn!`)) {
                          cancelOrder(order.id);
                        }
                      }}
                      className="p-2 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="Hủy đơn & Hoàn kho"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: MAIN POS CREATION TAB */}
      {activeTab === 'pos' && (
        <>
          {/* Search and Filters Bar */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="🔍 Tìm nhanh món ăn, đặc sản (gõ 'xuc xich', 'pate', 'sp01'...)"
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Stock Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0 text-[11px] font-bold">
                <button
                  onClick={() => setStockFilter('all')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    stockFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Tất cả
                </button>
                <button
                  onClick={() => setStockFilter('in_stock')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    stockFilter === 'in_stock'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Còn hàng
                </button>
                <button
                  onClick={() => setStockFilter('low_stock')}
                  className={`px-2.5 py-1 rounded-lg transition flex items-center gap-1 ${
                    stockFilter === 'low_stock'
                      ? 'bg-rose-500 text-white shadow-xs'
                      : 'text-rose-600 hover:text-rose-700'
                  }`}
                >
                  <span>Sắp hết (≤5)</span>
                </button>
              </div>
            </div>

            {/* Categories Horizontal Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll">
              {categories.map(cat => {
                const count =
                  cat === 'Tất cả'
                    ? products.length
                    : products.filter(p => p.category === cat).length;
                const active = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`
                      shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5
                      ${active
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                    `}
                  >
                    <span>{cat}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Grid: Products (Left) + Cart Bill (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
            {/* LEFT: PRODUCTS LIST (7 Cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
              <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
                <span>Danh sách thực đơn ({filteredProducts.length} món)</span>
                <span className="text-[11px] text-slate-400">Chạm món để thêm vào giỏ</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <p className="text-2xl mb-1">🔍</p>
                  <p>Không tìm thấy món ăn nào phù hợp</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const inCartItem = cart.find(i => i.productId === product.id);
                  const isLowStock = product.stock <= 5;
                  const isOutOfStock = product.stock <= 0;

                  return (
                    <div
                      key={product.id}
                      onClick={() => !isOutOfStock && handleAddToCart(product)}
                      className={`
                        p-3 flex items-center justify-between gap-3 transition cursor-pointer
                        ${isOutOfStock ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-amber-50/40'}
                      `}
                    >
                      <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                        {product.image}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {product.name}
                          </h4>
                          {isOutOfStock ? (
                            <span className="text-[9px] font-extrabold bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded-md shrink-0">
                              Hết hàng
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-md shrink-0 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Còn {product.stock}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
                          <span>{product.unit}</span>
                          <span>•</span>
                          <span>Tồn kho: <strong className={isLowStock ? 'text-rose-600 font-bold' : 'text-slate-600 font-semibold'}>{product.stock}</strong></span>
                        </div>

                        <div className="mt-1">
                          <span className="text-xs font-black text-amber-600">
                            {formatVND(product.price)}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-1.5">
                        {inCartItem && (
                          <span className="bg-amber-500 text-white text-[11px] font-extrabold px-2 py-1 rounded-lg shadow-2xs">
                            x{inCartItem.qty}
                          </span>
                        )}
                        <button
                          disabled={isOutOfStock}
                          className="w-8 h-8 rounded-xl bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-800 font-extrabold flex items-center justify-center transition disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* RIGHT: BILLING & CHECKOUT (5 Cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sticky top-[72px] space-y-3">
              {/* Customer Selector + Quick Add */}
              <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Khách hàng & Công nợ
                  </label>
                  <button
                    onClick={() => setIsQuickAddCustomerOpen(true)}
                    className="text-[11px] font-bold text-amber-600 hover:underline flex items-center gap-1"
                  >
                    <UserPlus className="w-3 h-3" />
                    <span>Thêm nhanh</span>
                  </button>
                </div>

                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ''} {c.debt > 0 ? `• Nợ: ${formatVND(c.debt)}` : ''}
                    </option>
                  ))}
                </select>

                {selectedCustomer?.debt > 0 && (
                  <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1 bg-rose-50 px-2 py-1 rounded-lg">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Khách đang có dư nợ cũ: {formatVND(selectedCustomer.debt)}</span>
                  </div>
                )}
              </div>

              {/* Order Type Selector (Tại chỗ vs Giao hàng) */}
              <div className="space-y-1.5 pb-2.5 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Hình thức bán hàng
                  </span>
                  <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                    <button
                      onClick={() => setOrderType('direct')}
                      className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                        orderType === 'direct'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Tại chỗ</span>
                    </button>
                    <button
                      onClick={() => setOrderType('delivery')}
                      className={`px-3 py-1 rounded-md transition flex items-center gap-1 ${
                        orderType === 'delivery'
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'text-slate-600'
                      }`}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Giao hàng</span>
                    </button>
                  </div>
                </div>

                {/* Delivery details if selected */}
                {orderType === 'delivery' && (
                  <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-700 font-bold">Phí ship (thu hộ):</span>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        value={shippingFee || ''}
                        onChange={e => setShippingFee(Number(e.target.value) || 0)}
                        placeholder="25000"
                        className="w-24 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right font-black text-slate-900 focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      value={shippingNote}
                      onChange={e => setShippingNote(e.target.value)}
                      placeholder="Ghi chú ship (Ahamove, Grab, Shipper quen...)"
                      className="w-full bg-white border border-amber-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="py-1 min-h-[140px] max-h-[220px] overflow-y-auto custom-scroll divide-y divide-slate-100">
                {cart.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-slate-400 text-xs">
                    <ShoppingBag className="w-8 h-8 text-slate-200 mb-1" />
                    <span>Chưa có món nào trong giỏ</span>
                  </div>
                ) : (
                  cart.map(item => (
                    <div key={item.productId} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 truncate">{item.name}</h5>
                        <div className="text-[10px] text-slate-400">
                          {item.unit} • <span className="text-amber-700 font-bold">{formatVND(item.price)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
                        <button
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800 text-xs">{item.qty}</span>
                        <button
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="w-16 text-right font-black text-slate-900 shrink-0">
                        {formatVND(item.price * item.qty)}
                      </div>

                      <button
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-slate-300 hover:text-rose-500 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Pricing Breakdown */}
              <div className="pt-2 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Tiền hàng ({totalItemCount} món):</span>
                  <span className="font-bold text-slate-900">{formatVND(subtotal)}</span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-600">Giảm giá:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      value={discountValue || ''}
                      onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 text-right font-bold text-slate-900 focus:outline-none"
                    />
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                      <button
                        onClick={() => setDiscountType('cash')}
                        className={`px-1.5 py-0.5 rounded ${discountType === 'cash' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                      >
                        đ
                      </button>
                      <button
                        onClick={() => setDiscountType('percent')}
                        className={`px-1.5 py-0.5 rounded ${discountType === 'percent' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>

                {/* Shipping Fee row if delivery */}
                {orderType === 'delivery' && (
                  <div className="flex justify-between text-slate-600">
                    <span>Phí ship (thu hộ):</span>
                    <span className="font-bold text-amber-700">+{formatVND(effectiveShippingFee)}</span>
                  </div>
                )}

                {/* Total To Pay */}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200">
                  <span className="font-black text-slate-900 text-xs uppercase">KHÁCH PHẢI TRẢ:</span>
                  <span className="text-xl font-black text-amber-600">{formatVND(totalToPay)}</span>
                </div>

                {/* 4 Payment Methods */}
                <div className="pt-1.5 space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Phương thức thanh toán
                  </label>
                  <div className="grid grid-cols-4 gap-1 text-[11px] font-bold">
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-1.5 rounded-lg border transition ${
                        paymentMethod === 'cash'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Tiền mặt
                    </button>
                    <button
                      onClick={() => setPaymentMethod('transfer')}
                      className={`py-1.5 rounded-lg border transition flex items-center justify-center gap-1 ${
                        paymentMethod === 'transfer'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <QrCode className="w-3 h-3" />
                      <span>VietQR</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('debt')}
                      className={`py-1.5 rounded-lg border transition ${
                        paymentMethod === 'debt'
                          ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Ghi nợ
                    </button>
                    <button
                      onClick={() => setPaymentMethod('partial')}
                      className={`py-1.5 rounded-lg border transition ${
                        paymentMethod === 'partial'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Trả 1 phần
                    </button>
                  </div>

                  {/* Payment Sub-views */}
                  {paymentMethod === 'cash' && (
                    <div className="pt-1.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-600 font-medium">Tiền khách đưa:</span>
                        <input
                          type="number"
                          min="0"
                          value={cashGiven || ''}
                          onChange={e => setCashGiven(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-28 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right font-black text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                        <button
                          onClick={() => setCashGiven(totalToPay)}
                          className="py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700"
                        >
                          Đủ tiền
                        </button>
                        <button
                          onClick={() => setCashGiven(100000)}
                          className="py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700"
                        >
                          100k
                        </button>
                        <button
                          onClick={() => setCashGiven(200000)}
                          className="py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700"
                        >
                          200k
                        </button>
                        <button
                          onClick={() => setCashGiven(500000)}
                          className="py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700"
                        >
                          500k
                        </button>
                      </div>
                      <div className="flex justify-between items-center text-xs pt-0.5">
                        <span className="text-slate-500">Tiền thừa trả khách:</span>
                        <span className="font-extrabold text-emerald-600 text-sm">
                          {formatVND(changeAmount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {paymentMethod === 'transfer' && (
                    <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-center space-y-1 text-xs">
                      <div className="flex items-center justify-center gap-1 font-bold text-blue-900">
                        <QrCode className="w-4 h-4 text-blue-600" />
                        <span>Mã VietQR động tự sinh khi thanh toán</span>
                      </div>
                      <p className="text-[11px] text-blue-700 font-medium">
                        Số tiền: <strong>{formatVND(totalToPay)}</strong> • Ngân hàng: {receiptSettings.bankCode}
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'debt' && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] font-medium space-y-0.5">
                      <div className="font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Ghi nợ toàn bộ đơn hàng</span>
                      </div>
                      <p>
                        Số tiền <strong>{formatVND(totalToPay)}</strong> sẽ được cộng dồn vào Dư nợ của khách hàng <strong>{selectedCustomer.name}</strong>.
                      </p>
                    </div>
                  )}

                  {paymentMethod === 'partial' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-700">Khách trả trước:</span>
                        <input
                          type="number"
                          min="0"
                          max={totalToPay}
                          value={partialPaidAmount || ''}
                          onChange={e => setPartialPaidAmount(Number(e.target.value) || 0)}
                          placeholder="0"
                          className="w-28 bg-white border border-amber-300 rounded-lg px-2 py-1 text-right font-black text-slate-900 focus:outline-none"
                        />
                      </div>
                      <div className="flex justify-between font-bold text-[11px] text-rose-700 pt-1 border-t border-amber-200/60">
                        <span>Còn nợ lại đơn này:</span>
                        <span>{formatVND(finalDebtAmount)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Checkout Button */}
              <button
                onClick={handleCheckout}
                disabled={cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm shadow-md shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <Receipt className="w-4 h-4" />
                <span>
                  {orderType === 'direct' ? 'Thanh toán & In hóa đơn' : 'Tạo đơn giao hàng (Ship)'}
                </span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Quick Add Customer Modal */}
      <QuickAddCustomerModal
        isOpen={isQuickAddCustomerOpen}
        onClose={() => setIsQuickAddCustomerOpen(false)}
        onCustomerAdded={newCust => setSelectedCustomerId(newCust.id)}
      />

      {/* Thermal Receipt Preview Modal */}
      <ReceiptModal
        order={completedOrder}
        settings={receiptSettings}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
};
