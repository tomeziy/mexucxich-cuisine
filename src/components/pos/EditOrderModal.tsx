import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Order, OrderItem, OrderType, PaymentMethod, OrderStatus, Product } from '../../types';
import { formatVND } from '../../utils/format';
import {
  X,
  Plus,
  Minus,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Store,
  Truck,
  QrCode,
  CheckCircle2,
  DollarSign,
  Package,
} from 'lucide-react';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({ order, isOpen, onClose }) => {
  const { products, customers, updateOrder } = useStore();

  const [items, setItems] = useState<OrderItem[]>([]);
  const [customerId, setCustomerId] = useState<string>('');
  const [orderType, setOrderType] = useState<OrderType>('direct');
  const [status, setStatus] = useState<OrderStatus>('completed');
  const [discountType, setDiscountType] = useState<'cash' | 'percent'>('cash');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingFee, setShippingFee] = useState<number>(0);
  const [shippingNote, setShippingNote] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [partialPaidAmount, setPartialPaidAmount] = useState<number>(0);
  const [selectedProductIdToAdd, setSelectedProductIdToAdd] = useState<string>('');

  useEffect(() => {
    if (order) {
      setItems(JSON.parse(JSON.stringify(order.items || [])));
      setCustomerId(order.customerId || (customers[0]?.id || 'KH01'));
      setOrderType(order.orderType || 'direct');
      setStatus(order.status || 'completed');
      setDiscountType(order.discountType || 'cash');
      setDiscountValue(order.discountValue || 0);
      setShippingFee(order.shippingFee || 0);
      setShippingNote(order.shippingNote || '');
      setPaymentMethod(order.paymentMethod || 'cash');
      setPartialPaidAmount(order.paidAmount || 0);
      setSelectedProductIdToAdd('');
    }
  }, [order, customers]);

  if (!isOpen || !order) return null;

  const selectedCustomer = customers.find(c => c.id === customerId) || customers[0];

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  const discountAmount =
    discountType === 'percent'
      ? Math.round((subtotal * discountValue) / 100)
      : Math.min(subtotal, discountValue);

  const effectiveShippingFee = orderType === 'delivery' ? shippingFee : 0;
  const newTotal = Math.max(0, subtotal - discountAmount + effectiveShippingFee);

  let finalPaid = newTotal;
  let finalDebt = 0;
  if (paymentMethod === 'debt') {
    finalPaid = 0;
    finalDebt = newTotal;
  } else if (paymentMethod === 'partial') {
    finalPaid = Math.min(newTotal, Math.max(0, partialPaidAmount));
    finalDebt = Math.max(0, newTotal - finalPaid);
  }

  const priceDiff = newTotal - order.total;

  // Handlers for Items
  const handleUpdateQty = (productId: string, delta: number) => {
    setItems(prev =>
      prev
        .map(i => {
          if (i.productId === productId) {
            const newQty = i.qty + delta;
            return newQty > 0 ? { ...i, qty: newQty } : i;
          }
          return i;
        })
        .filter(i => i.qty > 0)
    );
  };

  const handleUpdatePrice = (productId: string, newPrice: number) => {
    setItems(prev =>
      prev.map(i => (i.productId === productId ? { ...i, price: Math.max(0, newPrice) } : i))
    );
  };

  const handleResetPrice = (productId: string) => {
    setItems(prev =>
      prev.map(i => {
        if (i.productId === productId) {
          return { ...i, price: i.originalPrice ?? i.price };
        }
        return i;
      })
    );
  };

  const handleRemoveItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const handleAddItem = () => {
    if (!selectedProductIdToAdd) return;
    const prod = products.find(p => p.id === selectedProductIdToAdd);
    if (!prod) return;

    setItems(prev => {
      const existing = prev.find(i => i.productId === prod.id);
      if (existing) {
        return prev.map(i => (i.productId === prod.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          unit: prod.unit,
          price: prod.price,
          originalPrice: prod.price,
          cost: prod.cost,
          qty: 1,
          image: prod.image,
        },
      ];
    });
    setSelectedProductIdToAdd('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Đơn hàng phải có ít nhất 1 món ăn!');
      return;
    }

    const updatedOrder: Order = {
      ...order,
      customerId,
      customerName: selectedCustomer ? selectedCustomer.name : order.customerName,
      customerPhone: selectedCustomer ? selectedCustomer.phone : order.customerPhone,
      customerAddress: selectedCustomer ? selectedCustomer.address : order.customerAddress,
      orderType,
      status,
      items,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      shippingFee: effectiveShippingFee,
      shippingNote,
      total: newTotal,
      paymentMethod,
      paidAmount: finalPaid,
      debtAmount: finalDebt,
    };

    updateOrder(order.id, updatedOrder);
    alert(`Đã lưu thay đổi cho đơn #${order.id} thành công! Hệ thống đã tự động tính toán lại tồn kho và công nợ.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">✏️</span>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base">
                Chỉnh sửa Đơn hàng #{order.id}
              </h3>
              <p className="text-[11px] text-slate-300">
                Tự động bù trừ tồn kho (Stock Delta) và cập nhật số dư nợ theo ADR-0006
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          {/* Top Bar: Customer & Order Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Khách hàng:</label>
              <select
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Hình thức bán:</label>
              <div className="grid grid-cols-2 bg-slate-200 p-0.5 rounded-lg font-bold">
                <button
                  type="button"
                  onClick={() => setOrderType('direct')}
                  className={`py-1 rounded flex items-center justify-center gap-1 ${
                    orderType === 'direct' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Store className="w-3 h-3" />
                  <span>Tại chỗ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('delivery')}
                  className={`py-1 rounded flex items-center justify-center gap-1 ${
                    orderType === 'delivery' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  <Truck className="w-3 h-3" />
                  <span>Giao hàng</span>
                </button>
              </div>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Trạng thái đơn:</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as OrderStatus)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-bold text-slate-800 focus:outline-none"
              >
                <option value="completed">Đã hoàn thành</option>
                <option value="preparing">Đang chuẩn bị</option>
                <option value="delivering">Đang giao hàng</option>
                <option value="cancelled">Đã hủy (Hoàn kho)</option>
              </select>
            </div>
          </div>

          {/* Delivery Note & Fee if delivery */}
          {orderType === 'delivery' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-blue-50/70 p-3 rounded-xl border border-blue-200">
              <div>
                <label className="font-bold text-blue-900 block mb-1">Phí ship thu hộ (VNĐ):</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={shippingFee || ''}
                  onChange={e => setShippingFee(Number(e.target.value) || 0)}
                  placeholder="25000"
                  className="w-full bg-white border border-blue-300 rounded-lg px-2.5 py-1.5 font-black text-slate-900 focus:outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-blue-900 block mb-1">Ghi chú ship / Đơn vị giao:</label>
                <input
                  type="text"
                  value={shippingNote}
                  onChange={e => setShippingNote(e.target.value)}
                  placeholder="Ahamove, Grab, Shipper quen..."
                  className="w-full bg-white border border-blue-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Products in this order */}
          <div className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="font-extrabold uppercase tracking-wider text-slate-500 text-[11px] flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-amber-500" />
                <span>Danh sách món ăn ({items.length} món)</span>
              </span>

              {/* Add item dropdown */}
              <div className="flex items-center gap-1.5">
                <select
                  value={selectedProductIdToAdd}
                  onChange={e => setSelectedProductIdToAdd(e.target.value)}
                  className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none max-w-[160px] sm:max-w-xs"
                >
                  <option value="">-- Thêm món vào đơn --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.image} {p.name} ({formatVND(p.price)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!selectedProductIdToAdd}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold rounded-lg transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Thêm</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 max-h-56 overflow-y-auto custom-scroll">
              {items.map(item => {
                const isPriceEdited =
                  item.originalPrice !== undefined && item.price !== item.originalPrice;
                const isBelowCost = item.price < item.cost;

                return (
                  <div key={item.productId} className="p-2.5 bg-white hover:bg-amber-50/20 transition space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-slate-900 truncate">
                          {item.image} {item.name}
                        </h5>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                          <span>{item.unit}</span>
                          <span>•</span>
                          <span>Đơn giá:</span>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            value={item.price}
                            onChange={e => handleUpdatePrice(item.productId, Number(e.target.value) || 0)}
                            className={`w-20 px-1 py-0.2 text-right font-black rounded border text-xs focus:outline-none ${
                              isPriceEdited ? 'bg-amber-50 border-amber-400 text-amber-900' : 'border-slate-200'
                            }`}
                          />
                          <span>đ</span>
                          {isPriceEdited && (
                            <button
                              type="button"
                              onClick={() => handleResetPrice(item.productId)}
                              className="text-slate-400 hover:text-amber-600 p-0.5"
                              title="Khôi phục giá gốc"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Quantity Controls */}
                      <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, -1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-bold text-slate-800 text-xs">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQty(item.productId, 1)}
                          className="w-5 h-5 rounded bg-white text-slate-700 hover:bg-slate-200 font-bold flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total */}
                      <div className="w-20 text-right font-black text-slate-900 shrink-0">
                        {formatVND(item.price * item.qty)}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="text-slate-300 hover:text-rose-500 p-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isBelowCost && (
                      <div className="text-[10px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded flex items-center gap-1">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                        <span>Đơn giá thấp hơn giá vốn ({formatVND(item.cost)})</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Discount & Pricing */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Tiền hàng:</span>
              <span className="font-bold text-slate-900">{formatVND(subtotal)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">Giảm giá:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  value={discountValue || ''}
                  onChange={e => setDiscountValue(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-right font-bold focus:outline-none"
                />
                <div className="flex bg-slate-200 p-0.5 rounded text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setDiscountType('cash')}
                    className={`px-1 rounded ${discountType === 'cash' ? 'bg-white shadow-2xs' : ''}`}
                  >
                    đ
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percent')}
                    className={`px-1 rounded ${discountType === 'percent' ? 'bg-white shadow-2xs' : ''}`}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>

            {orderType === 'delivery' && (
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Phí ship:</span>
                <span className="font-bold text-blue-700">+{formatVND(effectiveShippingFee)}</span>
              </div>
            )}

            {/* Total */}
            <div className="flex items-baseline justify-between pt-2 border-t border-slate-200">
              <span className="font-extrabold uppercase text-slate-900">Tổng tiền mới:</span>
              <div className="text-right">
                <span className="text-base sm:text-lg font-black text-amber-600">
                  {formatVND(newTotal)}
                </span>
                {priceDiff !== 0 && (
                  <span
                    className={`block text-[10px] font-bold ${
                      priceDiff > 0 ? 'text-amber-700' : 'text-emerald-600'
                    }`}
                  >
                    {priceDiff > 0 ? `(Tăng +${formatVND(priceDiff)} so với ban đầu)` : `(Giảm ${formatVND(Math.abs(priceDiff))} so với ban đầu)`}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Payment Method in Edit */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 block">Phương thức thanh toán mới:</label>
            <div className="grid grid-cols-4 gap-1 font-bold text-[11px]">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-1.5 rounded-lg border transition ${
                  paymentMethod === 'cash' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`py-1.5 rounded-lg border transition ${
                  paymentMethod === 'transfer' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                VietQR
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('debt')}
                className={`py-1.5 rounded-lg border transition ${
                  paymentMethod === 'debt' ? 'bg-rose-500 border-rose-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Ghi nợ
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('partial')}
                className={`py-1.5 rounded-lg border transition ${
                  paymentMethod === 'partial' ? 'bg-amber-500 border-amber-500 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                Trả 1 phần
              </button>
            </div>

            {paymentMethod === 'partial' && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-slate-700">Khách đã trả:</span>
                <input
                  type="number"
                  min="0"
                  max={newTotal}
                  value={partialPaidAmount || ''}
                  onChange={e => setPartialPaidAmount(Number(e.target.value) || 0)}
                  className="w-28 bg-white border border-amber-300 rounded px-2 py-1 text-right font-black text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold shadow-sm shadow-amber-500/20 transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Lưu thay đổi hóa đơn</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
