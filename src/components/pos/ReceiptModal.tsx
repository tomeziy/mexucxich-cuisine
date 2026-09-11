import React from 'react';
import { Order, ReceiptSettings } from '../../types';
import { formatVND, formatDate } from '../../utils/format';
import { Printer, X } from 'lucide-react';

interface ReceiptModalProps {
  order: Order | null;
  settings: ReceiptSettings;
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  settings,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-3.5 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Printer className="w-4 h-4" />
            <span>Hóa đơn bán hàng ({settings.paperSize.toUpperCase()})</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt Paper Container */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scroll bg-slate-100 flex justify-center">
          <div
            id="thermal-receipt-print"
            className="w-[80mm] min-h-[120mm] bg-white p-4 shadow-sm text-slate-900 font-mono text-[11px] leading-relaxed border-t-4 border-amber-500 rounded-xs"
          >
            {/* Store Branding */}
            <div className="text-center pb-2.5 border-b border-dashed border-slate-300">
              {settings.showLogo && (
                <div className="text-2xl mb-1">🌭</div>
              )}
              <h2 className="font-extrabold text-sm uppercase tracking-wider text-slate-900">
                {settings.storeName || 'MexucxichCuisine'}
              </h2>
              {settings.storeSubtitle && (
                <p className="text-[10px] text-slate-500">{settings.storeSubtitle}</p>
              )}
              {settings.address && (
                <p className="text-[10px] text-slate-600 mt-0.5">Đ/c: {settings.address}</p>
              )}
              {settings.hotline && (
                <p className="text-[10px] text-slate-600 font-bold">Hotline: {settings.hotline}</p>
              )}
            </div>

            {/* Order Details */}
            <div className="py-2 border-b border-dashed border-slate-300 text-[10px] space-y-0.5">
              <div className="flex justify-between">
                <span>Số HĐ:</span>
                <strong className="text-slate-900">#{order.id}</strong>
              </div>
              <div className="flex justify-between">
                <span>Ngày in:</span>
                <span>{formatDate(order.createdAt)}</span>
              </div>
              {settings.showCustomer && (
                <div className="flex justify-between">
                  <span>Khách hàng:</span>
                  <strong className="text-slate-900">{order.customerName || 'Khách lẻ tại quầy'}</strong>
                </div>
              )}
              <div className="flex justify-between">
                <span>Loại đơn:</span>
                <span className="font-bold text-amber-700">
                  {order.orderType === 'direct' ? 'Bán tại chỗ' : 'Đơn giao hàng'}
                </span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <div className="flex justify-between font-bold text-[10px] pb-1 mb-1 border-b border-slate-100 text-slate-600">
                <span className="w-1/2">Tên món</span>
                <span className="w-1/6 text-center">SL</span>
                <span className="w-1/3 text-right">T.Tiền</span>
              </div>
              <div className="space-y-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-baseline py-0.5 text-[10px]">
                    <div className="w-1/2 truncate font-medium">
                      {item.name}
                      <span className="text-[9px] text-slate-400 block">{item.unit}</span>
                    </div>
                    <div className="w-1/6 text-center font-bold">x{item.qty}</div>
                    <div className="w-1/3 text-right font-bold text-slate-900">
                      {formatVND(item.price * item.qty)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Totals */}
            <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[10px]">
              <div className="flex justify-between text-slate-600">
                <span>Tổng tiền hàng:</span>
                <span className="font-bold text-slate-900">{formatVND(order.subtotal)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Giảm giá:</span>
                  <span>-{formatVND(order.discountAmount)}</span>
                </div>
              )}

              {order.shippingFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Phí ship (thu hộ):</span>
                  <span>+{formatVND(order.shippingFee)}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 text-xs font-extrabold text-slate-900">
                <span>KHÁCH PHẢI TRẢ:</span>
                <span className="text-amber-800 text-sm font-black">{formatVND(order.total)}</span>
              </div>

              <div className="flex justify-between text-slate-600 pt-1">
                <span>Phương thức:</span>
                <span className="font-bold text-slate-800">
                  {order.paymentMethod === 'cash' ? 'Tiền mặt' :
                   order.paymentMethod === 'transfer' ? 'Chuyển khoản (VietQR)' :
                   order.paymentMethod === 'debt' ? 'Ghi nợ' : 'Thanh toán 1 phần'}
                </span>
              </div>

              {order.paymentMethod === 'cash' && order.cashGiven !== undefined && (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>Tiền khách đưa:</span>
                    <span className="font-bold">{formatVND(order.cashGiven)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>Tiền thừa trả khách:</span>
                    <span>{formatVND(order.change || 0)}</span>
                  </div>
                </>
              )}

              {order.debtAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-rose-100">
                  <span>Ghi nợ đơn này:</span>
                  <span>+{formatVND(order.debtAmount)}</span>
                </div>
              )}
            </div>

            {/* Footer Message */}
            <div className="text-center pt-3 text-[10px] text-slate-500 space-y-0.5">
              <p className="font-medium">{settings.footerMessage || 'Cảm ơn quý khách & Hẹn gặp lại!'}</p>
              <p className="text-[8px] text-slate-400 italic">MexucxichCuisine - Ngon từ tâm</p>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
          >
            <Printer className="w-4 h-4" />
            <span>In Hóa Đơn (K80)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
