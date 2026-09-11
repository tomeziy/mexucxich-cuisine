import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Product, OrderItem, Order } from '../types';
import { matchesSearch } from '../utils/vietnamese';
import { formatVND } from '../utils/format';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Receipt,
} from 'lucide-react';

interface CartItem extends OrderItem {}

export const PosPage: React.FC = () => {
  const { products, customers, receiptSettings, createOrder } = useStore();

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || 'KH01');
  const [discountType, setDiscountType] = useState<'cash' | 'percent'>('cash');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [cashGiven, setCashGiven] = useState<number>(0);

  // Receipt Modal state
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Category counts
  const categories = ['Tất cả', 'Đồ tự làm', 'Đặc sản tuyển chọn', 'Ăn vặt & Khô', 'Gia vị & Sốt'];

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
    setCashGiven(0);
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round((subtotal * Math.min(100, Math.max(0, discountValue))) / 100);
  } else {
    discountAmount = Math.min(subtotal, Math.max(0, discountValue));
  }

  const totalToPay = Math.max(0, subtotal - discountAmount);
  const changeAmount = Math.max(0, cashGiven - totalToPay);
  const totalItemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  // Checkout (Tại chỗ)
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Vui lòng chọn món ăn vào giỏ trước khi thanh toán!');
      return;
    }

    const currentCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];

    const newOrder = createOrder({
      customerId: currentCustomer?.id || 'KH01',
      customerName: currentCustomer?.name || 'Khách lẻ tại quầy',
      customerPhone: currentCustomer?.phone || '',
      customerAddress: currentCustomer?.address || '',
      orderType: 'direct',
      status: 'completed',
      items: [...cart],
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      shippingFee: 0,
      total: totalToPay,
      paymentMethod: 'cash',
      cashGiven: cashGiven > 0 ? cashGiven : totalToPay,
      change: changeAmount,
      paidAmount: totalToPay,
      debtAmount: 0,
    });

    setCompletedOrder(newOrder);
    setIsReceiptOpen(true);
    setCart([]);
    setDiscountValue(0);
    setCashGiven(0);
  };

  return (
    <div className="space-y-3">
      {/* Search and Filters Bar */}
      <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Search Box */}
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
        {/* LEFT: PRODUCTS COMPACT LIST (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
          <div className="p-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs font-bold text-slate-600">
            <span>Danh sách thực đơn ({filteredProducts.length} món)</span>
            <span className="text-[11px] text-slate-400">Chạm món để thêm vào giỏ</span>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <p className="text-2xl mb-1">🔍</p>
              <p>Không tìm thấy món ăn nào phù hợp với bộ lọc</p>
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
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    {product.image}
                  </div>

                  {/* Info */}
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

                  {/* Action or In-cart Badge */}
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
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sticky top-[72px]">
          {/* Cart Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <h3 className="font-extrabold text-sm text-slate-900">
                Hóa đơn bán tại chỗ
              </h3>
            </div>
            {cart.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa giỏ</span>
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="py-2.5 flex-1 min-h-[160px] max-h-[260px] overflow-y-auto custom-scroll divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-xs">
                <ShoppingBag className="w-10 h-10 text-slate-200 mb-2 stroke-[1.5]" />
                <span className="font-medium text-slate-500">Giỏ hàng đang trống</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Bấm vào món bên trái để thêm</span>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-bold text-slate-900 truncate">{item.name}</h5>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <span>{item.unit}</span>
                      <span>•</span>
                      <span className="text-amber-700 font-bold">{formatVND(item.price)}</span>
                    </div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg p-0.5 shrink-0">
                    <button
                      onClick={() => handleUpdateQty(item.productId, -1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center font-bold text-slate-800 text-xs">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => handleUpdateQty(item.productId, 1)}
                      className="w-6 h-6 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Total Item Price */}
                  <div className="w-20 text-right font-black text-slate-900 shrink-0">
                    {formatVND(item.price * item.qty)}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={() => handleRemoveItem(item.productId)}
                    className="text-slate-300 hover:text-rose-500 transition p-1"
                    title="Xóa món"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pricing Calculations */}
          <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
            {/* Subtotal */}
            <div className="flex justify-between text-slate-600">
              <span>Tiền hàng ({totalItemCount} món):</span>
              <span className="font-bold text-slate-900">{formatVND(subtotal)}</span>
            </div>

            {/* Discount Row */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">Giảm giá:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-right font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[10px] font-bold">
                  <button
                    onClick={() => setDiscountType('cash')}
                    className={`px-1.5 py-0.5 rounded ${
                      discountType === 'cash' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    đ
                  </button>
                  <button
                    onClick={() => setDiscountType('percent')}
                    className={`px-1.5 py-0.5 rounded ${
                      discountType === 'percent' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>

            {/* Total To Pay */}
            <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
              <span className="font-black text-slate-900 text-xs uppercase tracking-wider">
                KHÁCH PHẢI TRẢ:
              </span>
              <span className="text-xl font-black text-amber-600">
                {formatVND(totalToPay)}
              </span>
            </div>

            {/* Cash Given & Quick Suggestions */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-600 font-medium">Tiền khách đưa:</span>
                <input
                  type="number"
                  min="0"
                  value={cashGiven || ''}
                  onChange={e => setCashGiven(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-32 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-right font-black text-slate-900 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Quick Cash Buttons */}
              <div className="grid grid-cols-4 gap-1 text-[10px] font-bold">
                <button
                  onClick={() => setCashGiven(totalToPay)}
                  className="py-1 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                >
                  Đủ tiền
                </button>
                <button
                  onClick={() => setCashGiven(100000)}
                  className="py-1 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                >
                  100k
                </button>
                <button
                  onClick={() => setCashGiven(200000)}
                  className="py-1 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                >
                  200k
                </button>
                <button
                  onClick={() => setCashGiven(500000)}
                  className="py-1 rounded-md bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 transition"
                >
                  500k
                </button>
              </div>

              {/* Change calculation */}
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-500">Tiền thừa trả khách:</span>
                <span className="font-extrabold text-emerald-600 text-sm">
                  {formatVND(changeAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCheckout}
            disabled={cart.length === 0}
            className="w-full mt-4 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-sm shadow-md shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            <Receipt className="w-4 h-4" />
            <span>Thanh toán & In hóa đơn</span>
          </button>
        </div>
      </div>

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
