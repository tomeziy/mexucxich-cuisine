import React from 'react';
import { Order, ReceiptSettings, PrintFontSize } from '../../types';
import { useStore } from '../../context/StoreContext';
import { formatVND, formatDate } from '../../utils/format';
import { Printer, X, QrCode } from 'lucide-react';

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
  const { updateReceiptSettings } = useStore();

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  // VietQR Dynamic URL (Standard Napas format)
  const vietQrAmount = order.paymentMethod === 'partial' ? (order.paidAmount || order.total) : order.total;
  const qrUrl = settings.bankAccount && settings.bankCode
    ? `https://img.vietqr.io/image/${settings.bankCode}-${settings.bankAccount}-compact2.png?amount=${vietQrAmount}&addInfo=${encodeURIComponent(order.id)}&accountName=${encodeURIComponent(settings.bankAccountName || '')}`
    : '';

  const paperWidthClass =
    settings.paperSize === 'k57'
      ? 'w-[57mm]'
      : settings.paperSize === 'a5'
      ? 'w-[148mm]'
      : settings.paperSize === 'a4'
      ? 'w-[210mm]'
      : 'w-[80mm]'; // default k80

  const fontBaseClass =
    settings.fontSize === 'small'
      ? 'text-[11px] leading-tight'
      : settings.fontSize === 'large'
      ? 'text-[15px] leading-snug'
      : 'text-[13px] leading-snug'; // medium default (KiotViet style)

  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);

  const renderSingleReceipt = (copyTitle?: string) => (
    <div className="space-y-2 text-slate-900">
      {/* Optional Copy Tag for 2-lien mode */}
      {copyTitle && (
        <div className="text-center pb-1 border-b border-dashed border-slate-300">
          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[11px] font-extrabold text-slate-700 tracking-wider uppercase">
            {copyTitle}
          </span>
        </div>
      )}

      {/* Store Branding (KiotViet Style) */}
      <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
        {settings.showLogo && (
          <div className="text-2xl mb-1">🌭</div>
        )}
        <h2 className="font-black text-base uppercase tracking-wider text-slate-900">
          {settings.storeName || 'MEXUCXICH CUISINE'}
        </h2>
        {settings.storeSubtitle && (
          <p className="text-xs text-slate-600 italic">{settings.storeSubtitle}</p>
        )}
        {settings.facebook && (
          <p className="text-xs text-slate-700 font-semibold">{settings.facebook}</p>
        )}
        {!settings.facebook && settings.hotline && (
          <p className="text-xs text-slate-700 font-bold">Hotline: {settings.hotline}</p>
        )}
        {settings.address && (
          <p className="text-[11px] text-slate-500">Đ/c: {settings.address}</p>
        )}
      </div>

      {/* Order Title & Code */}
      <div className="text-center py-1 border-b border-dashed border-slate-300">
        <h3 className="font-black text-sm uppercase tracking-wide text-slate-900">
          HÓA ĐƠN BÁN HÀNG
        </h3>
        <p className="text-xs text-slate-700 mt-0.5">
          Số HĐ: <strong className="font-bold text-slate-900">#{order.id}</strong>
        </p>
        <p className="text-[11px] text-slate-500 italic">
          {formatDate(order.createdAt)}
        </p>
      </div>

      {/* Customer Details */}
      {settings.showCustomer && (
        <div className="py-1.5 border-b border-dashed border-slate-300 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-600">Khách hàng:</span>
            <strong className="text-slate-900">{order.customerName || 'Khách lẻ tại quầy'}</strong>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between">
              <span className="text-slate-600">SĐT:</span>
              <span className="font-bold text-slate-800">{order.customerPhone}</span>
            </div>
          )}
          {order.customerAddress && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-slate-600 shrink-0">Địa chỉ:</span>
              <span className="text-right text-slate-800">{order.customerAddress}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">Hình thức:</span>
            <span className={`font-bold ${order.orderType === 'direct' ? 'text-amber-800' : 'text-blue-800'}`}>
              {order.orderType === 'direct' ? 'Tại chỗ' : 'Giao hàng (Ship)'}
            </span>
          </div>
          {order.shippingNote && (
            <div className="flex justify-between text-slate-600">
              <span className="shrink-0">Ghi chú ship:</span>
              <span className="text-right italic">{order.shippingNote}</span>
            </div>
          )}
        </div>
      )}

      {/* Items Table - 2-Line Layout (KiotViet standard) */}
      <div className="py-2 border-b border-dashed border-slate-300">
        {/* Table Header Columns */}
        <div className="flex justify-between font-bold text-xs pb-1 border-b border-slate-300 text-slate-800">
          <span className="w-1/3 text-left">Đơn giá</span>
          <span className="w-1/3 text-center">SL</span>
          <span className="w-1/3 text-right">Thành tiền</span>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-dashed divide-slate-200">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-1.5 space-y-0.5">
              {/* Line 1: Full Item Name */}
              <div className="font-bold text-slate-900 leading-snug">
                {item.name}
                {item.unit && <span className="font-normal text-slate-500 text-[11px] ml-1">({item.unit})</span>}
              </div>
              {/* Line 2: 3 Columns - Price | Qty | Total */}
              <div className="flex justify-between items-center text-xs text-slate-700">
                <span className="w-1/3 text-left font-semibold">{formatVND(item.price)}</span>
                <span className="w-1/3 text-center font-bold">x{item.qty}</span>
                <span className="w-1/3 text-right font-black text-slate-900">
                  {formatVND(item.price * item.qty)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Totals */}
      <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-xs">
        <div className="flex justify-between text-slate-700">
          <span>Tổng số lượng:</span>
          <span className="font-bold text-slate-900">{totalQty}</span>
        </div>

        <div className="flex justify-between text-slate-700">
          <span>Tổng tiền hàng:</span>
          <span className="font-bold text-slate-900">{formatVND(order.subtotal)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="flex justify-between text-emerald-700 font-bold">
            <span>Chiết khấu:</span>
            <span>-{formatVND(order.discountAmount)}</span>
          </div>
        )}

        {order.shippingFee > 0 && (
          <div className="flex justify-between text-slate-700">
            <span>Phí vận chuyển:</span>
            <span className="font-bold">+{formatVND(order.shippingFee)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-300 text-sm font-black text-slate-900">
          <span className="uppercase">TỔNG THANH TOÁN:</span>
          <span className="text-base font-black text-amber-700">{formatVND(order.total)}</span>
        </div>

        <div className="flex justify-between text-slate-600 pt-0.5 text-[11px]">
          <span>Phương thức:</span>
          <span className="font-bold text-slate-800">
            {order.paymentMethod === 'cash' ? 'Tiền mặt' :
             order.paymentMethod === 'transfer' ? 'Chuyển khoản (VietQR)' :
             order.paymentMethod === 'debt' ? 'Ghi nợ 100%' :
             `Trả một phần (Đã trả: ${formatVND(order.paidAmount)})`}
          </span>
        </div>

        {order.paymentMethod === 'cash' && order.cashGiven !== undefined && (
          <>
            <div className="flex justify-between text-slate-600 text-[11px]">
              <span>Tiền khách đưa:</span>
              <span className="font-bold">{formatVND(order.cashGiven)}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
              <span>Tiền thừa trả khách:</span>
              <span>{formatVND(order.change || 0)}</span>
            </div>
          </>
        )}

        {order.debtAmount > 0 && (
          <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-rose-100 text-[11px]">
            <span>Ghi nợ đơn này:</span>
            <span>+{formatVND(order.debtAmount)}</span>
          </div>
        )}
      </div>

      {/* Bank Transfer Info (From KiotViet template) */}
      {settings.bankAccount && (
        <div className="py-2 text-center border-b border-dashed border-slate-300 space-y-1 text-xs">
          <p className="font-extrabold uppercase tracking-wide text-slate-900">
            THÔNG TIN CHUYỂN KHOẢN:
          </p>
          <p className="font-bold text-slate-800">
            {settings.bankCode} - CTK: {settings.bankAccountName}
          </p>
          <p className="font-black text-sm tracking-wider text-slate-900">
            {settings.bankAccount}
          </p>
          {settings.bankNote && (
            <p className="text-[11px] text-slate-600 italic">
              ({settings.bankNote})
            </p>
          )}

          {/* Dynamic VietQR Napas QR Code */}
          {settings.showVietQR && qrUrl && (order.paymentMethod === 'transfer' || order.paymentMethod === 'partial') && (
            <div className="pt-2 flex flex-col items-center justify-center">
              <div className="w-32 h-32 bg-white border border-slate-300 rounded p-1 flex items-center justify-center shadow-2xs">
                <img
                  src={qrUrl}
                  alt="VietQR Napas"
                  className="w-28 h-28 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Quét mã VietQR để thanh toán nhanh</p>
            </div>
          )}
        </div>
      )}

      {/* Footer Message */}
      <div className="text-center pt-2 text-xs text-slate-600 space-y-0.5">
        <p className="font-bold text-slate-800">
          {settings.footerMessage || 'Chúc quý khách có một bữa ăn hạnh phúc!'}
        </p>
        <p className="text-[10px] text-slate-400 italic">
          MexucxichCuisine - Ẩm thực thủ công & Đặc sản tuyển chọn
        </p>
      </div>
    </div>
  );

  const printCopies = settings.printCopies || 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-3.5 bg-amber-500 text-white flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Printer className="w-4 h-4" />
            <span>Hóa đơn bán hàng ({settings.paperSize.toUpperCase()} • {printCopies} liên)</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm font-bold"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Toolbar: Chỉnh trực tiếp Cỡ chữ & Số liên ngay trên popup */}
        <div className="bg-amber-50 px-3.5 py-2.5 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          {/* Cỡ chữ in */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-xs">Cỡ chữ:</span>
            <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-200 font-bold text-xs shadow-2xs">
              {[
                { id: 'small', label: 'Nhỏ (11px)' },
                { id: 'medium', label: 'Vừa (13px)' },
                { id: 'large', label: 'To (15px)' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => updateReceiptSettings({ fontSize: f.id as PrintFontSize })}
                  className={`px-2.5 py-1 rounded-md transition ${
                    (settings.fontSize || 'medium') === f.id
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Số liên in */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 text-xs">Số liên:</span>
            <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-200 font-bold text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => updateReceiptSettings({ printCopies: 1 })}
                className={`px-2.5 py-1 rounded-md transition ${
                  (settings.printCopies || 1) === 1
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                1 liên
              </button>
              <button
                type="button"
                onClick={() => updateReceiptSettings({ printCopies: 2 })}
                className={`px-2.5 py-1 rounded-md transition ${
                  settings.printCopies === 2
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                2 liên
              </button>
            </div>
          </div>
        </div>

        {/* Receipt Paper Container */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-scroll bg-slate-100 flex justify-center">
          <div
            id="thermal-receipt-print"
            className={`${paperWidthClass} bg-white p-4 text-slate-900 font-sans ${fontBaseClass} border-t-4 border-amber-500 rounded-xs shadow-sm`}
          >
            {printCopies === 2 ? (
              <>
                {renderSingleReceipt('LIÊN 1: LƯU BẾP / QUẦY')}
                <div className="my-5 py-2 border-b-2 border-dashed border-slate-400 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  ✂ - - - - - - - CẮT TẠI ĐÂY - - - - - - - ✂
                </div>
                {renderSingleReceipt('LIÊN 2: GIAO KHÁCH')}
              </>
            ) : (
              renderSingleReceipt()
            )}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-medium">
            Chế độ in: <strong className="text-slate-800">{printCopies} liên</strong> • Cỡ chữ: <strong className="text-slate-800">{settings.fontSize === 'small' ? 'Nhỏ' : settings.fontSize === 'large' ? 'To' : 'Vừa'}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Đóng
            </button>
            <button
              onClick={handlePrint}
              className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition"
            >
              <Printer className="w-4 h-4" />
              <span>In Hóa Đơn</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
