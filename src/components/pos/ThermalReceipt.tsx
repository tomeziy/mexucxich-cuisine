import React from 'react';
import { Order, ReceiptSettings } from '../../types';
import { formatVND, formatDate } from '../../utils/format';

export interface ThermalReceiptProps {
  order: Order;
  settings: ReceiptSettings;
  copyTitle?: string;
  isPreview?: boolean;
}

export const ThermalReceipt: React.FC<ThermalReceiptProps> = ({
  order,
  settings,
  copyTitle,
  isPreview = false,
}) => {
  const isArial = settings.fontFamily !== 'system';
  const fontFamilyStyle = isArial
    ? 'Arial, "Helvetica Neue", Helvetica, sans-serif'
    : "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // VietQR Napas format
  const vietQrAmount = order.paymentMethod === 'partial' ? (order.paidAmount || order.total) : order.total;
  const qrUrl =
    settings.bankAccount && settings.bankCode
      ? `https://img.vietqr.io/image/${settings.bankCode}-${settings.bankAccount}-compact2.png?amount=${vietQrAmount}&addInfo=${encodeURIComponent(
          order.id
        )}&accountName=${encodeURIComponent(settings.bankAccountName || '')}`
      : '';

  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <div
      className="space-y-2 text-black leading-snug tracking-tight"
      style={{
        fontFamily: fontFamilyStyle,
        color: '#000000',
      }}
    >
      {/* Optional Copy Tag for 2-lien mode */}
      {copyTitle && (
        <div className="text-center pb-1 border-b border-dashed border-black">
          <span
            className="inline-block px-2.5 py-0.5 rounded border border-black font-semibold text-black uppercase tracking-normal"
            style={{ fontSize: '0.85em' }}
          >
            {copyTitle}
          </span>
        </div>
      )}

      {/* Store Branding */}
      <div className="text-center pb-2 border-b border-dashed border-black space-y-0.5">
        {settings.showLogo && (
          <div className="mb-1 leading-none text-black" style={{ fontSize: '1.5em' }}>
            🌭
          </div>
        )}
        <h2
          className="font-bold uppercase tracking-normal text-black leading-tight"
          style={{ fontSize: '1.25em' }}
        >
          {settings.storeName || 'MEXUCXICH CUISINE'}
        </h2>
        {settings.storeSubtitle && (
          <p className="text-black font-medium italic leading-tight" style={{ fontSize: '0.85em' }}>
            {settings.storeSubtitle}
          </p>
        )}
        {settings.facebook && (
          <p className="text-black font-medium leading-tight" style={{ fontSize: '0.9em' }}>
            {settings.facebook}
          </p>
        )}
        {!settings.facebook && settings.hotline && (
          <p className="text-black font-medium leading-tight" style={{ fontSize: '0.9em' }}>
            Hotline: {settings.hotline}
          </p>
        )}
        {settings.address && (
          <p className="text-black font-normal leading-tight" style={{ fontSize: '0.82em' }}>
            Đ/c: {settings.address}
          </p>
        )}
      </div>

      {/* Order Title & Code */}
      <div className="text-center py-1 border-b border-dashed border-black space-y-0.5">
        <h3
          className="font-bold uppercase tracking-normal text-black leading-tight"
          style={{ fontSize: '1.18em' }}
        >
          HÓA ĐƠN BÁN HÀNG
        </h3>
        <p className="text-black font-medium leading-tight" style={{ fontSize: '0.9em' }}>
          Số HĐ: <span className="font-semibold text-black">#{order.id}</span>
        </p>
        <p className="text-black font-normal italic leading-tight" style={{ fontSize: '0.82em' }}>
          {formatDate(order.createdAt)}
        </p>
      </div>

      {/* Customer Details */}
      {settings.showCustomer && (
        <div className="py-1.5 border-b border-dashed border-black space-y-1" style={{ fontSize: '0.9em' }}>
          <div className="flex justify-between items-baseline">
            <span className="text-black font-medium">Khách hàng:</span>
            <span className="text-black font-semibold text-right">
              {order.customerName || 'Khách lẻ tại quầy'}
            </span>
          </div>
          {order.customerPhone && (
            <div className="flex justify-between items-baseline">
              <span className="text-black font-medium">SĐT:</span>
              <span className="font-medium text-black">{order.customerPhone}</span>
            </div>
          )}
          {order.customerAddress && (
            <div className="flex justify-between items-start gap-2">
              <span className="text-black font-medium shrink-0">Địa chỉ:</span>
              <span className="text-right text-black font-medium">{order.customerAddress}</span>
            </div>
          )}
          {settings.showOrderType && (
            <div className="flex justify-between items-baseline">
              <span className="text-black font-medium">Hình thức:</span>
              <span className="font-semibold text-black uppercase">
                {order.orderType === 'direct' ? 'Tại chỗ' : 'Giao hàng (Ship)'}
              </span>
            </div>
          )}
          {order.shippingNote && (
            <div className="flex justify-between items-start gap-2 text-black">
              <span className="shrink-0 font-medium">Ghi chú ship:</span>
              <span className="text-right italic font-normal" style={{ fontSize: '0.9em' }}>
                {order.shippingNote}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Items Table - 2-Line Layout */}
      <div className="py-2 border-b border-dashed border-black">
        {/* Table Header Columns */}
        <div
          className="flex justify-between font-semibold pb-1 border-b border-black text-black uppercase tracking-normal"
          style={{ fontSize: '0.85em' }}
        >
          <span className="w-1/3 text-left">Đơn giá</span>
          <span className="w-1/3 text-center">SL</span>
          <span className="w-1/3 text-right">Thành tiền</span>
        </div>

        {/* Item Rows */}
        <div className="divide-y divide-dashed divide-black">
          {order.items.map((item, idx) => (
            <div key={idx} className="py-1.5 space-y-0.5">
              {/* Line 1: Item Name */}
              <div className="font-semibold text-black leading-snug" style={{ fontSize: '1em' }}>
                {item.name}
                {item.unit && (
                  <span className="font-normal text-black ml-1" style={{ fontSize: '0.85em' }}>
                    ({item.unit})
                  </span>
                )}
              </div>
              {/* Line 2: 3 Columns - Price | Qty | Total */}
              <div className="flex justify-between items-center text-black" style={{ fontSize: '0.92em' }}>
                <span className="w-1/3 text-left font-normal">{formatVND(item.price)}</span>
                <span className="w-1/3 text-center font-medium">x{item.qty}</span>
                <span className="w-1/3 text-right font-semibold text-black" style={{ fontSize: '1em' }}>
                  {formatVND(item.price * item.qty)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Totals */}
      <div className="py-2 border-b border-dashed border-black space-y-1" style={{ fontSize: '0.9em' }}>
        <div className="flex justify-between text-black">
          <span className="font-normal">Tổng số lượng:</span>
          <span className="font-semibold text-black">{totalQty}</span>
        </div>

        <div className="flex justify-between text-black">
          <span className="font-normal">Tổng tiền hàng:</span>
          <span className="font-semibold text-black">{formatVND(order.subtotal)}</span>
        </div>

        {order.discountAmount > 0 && (
          <div className="flex justify-between text-black font-medium">
            <span>Chiết khấu:</span>
            <span>-{formatVND(order.discountAmount)}</span>
          </div>
        )}

        {order.shippingFee > 0 && (
          <div className="flex justify-between text-black font-medium">
            <span>Phí vận chuyển:</span>
            <span>+{formatVND(order.shippingFee)}</span>
          </div>
        )}

        <div className="flex justify-between items-baseline pt-1.5 border-t border-black text-black">
          <span className="font-bold uppercase tracking-normal" style={{ fontSize: '1.08em' }}>
            TỔNG THANH TOÁN:
          </span>
          <span className="font-bold text-black" style={{ fontSize: '1.3em' }}>
            {formatVND(order.total)}
          </span>
        </div>

        {settings.showPaymentMethod && (
          <div className="flex justify-between text-black pt-0.5" style={{ fontSize: '0.88em' }}>
            <span className="font-normal">Phương thức:</span>
            <span className="font-medium text-black">
              {order.paymentMethod === 'cash'
                ? 'Tiền mặt'
                : order.paymentMethod === 'transfer'
                ? 'Chuyển khoản (VietQR)'
                : order.paymentMethod === 'debt'
                ? 'Ghi nợ 100%'
                : `Trả một phần (Đã trả: ${formatVND(order.paidAmount)})`}
            </span>
          </div>
        )}

        {settings.showPaymentMethod && order.paymentMethod === 'cash' && order.cashGiven !== undefined && (
          <>
            <div className="flex justify-between text-black" style={{ fontSize: '0.88em' }}>
              <span className="font-normal">Tiền khách đưa:</span>
              <span className="font-medium text-black">{formatVND(order.cashGiven)}</span>
            </div>
            <div className="flex justify-between text-black font-medium" style={{ fontSize: '0.9em' }}>
              <span>Tiền thừa trả khách:</span>
              <span>{formatVND(order.change || 0)}</span>
            </div>
          </>
        )}

        {settings.showDebtInfo && order.debtAmount > 0 && (
          <div
            className="flex justify-between text-black font-semibold pt-1 border-t border-black"
            style={{ fontSize: '0.9em' }}
          >
            <span>Ghi nợ đơn này:</span>
            <span>+{formatVND(order.debtAmount)}</span>
          </div>
        )}
      </div>

      {/* Bank Transfer Info */}
      {settings.bankAccount && (
        <div className="py-2 text-center border-b border-dashed border-black space-y-1">
          <p className="font-semibold uppercase tracking-normal text-black" style={{ fontSize: '0.95em' }}>
            THÔNG TIN CHUYỂN KHOẢN:
          </p>
          <p className="font-medium text-black" style={{ fontSize: '0.9em' }}>
            {settings.bankCode} - CTK: {settings.bankAccountName}
          </p>
          <p className="font-bold tracking-normal text-black" style={{ fontSize: '1.2em' }}>
            {settings.bankAccount}
          </p>
          {settings.bankNote && (
            <p className="text-black font-normal italic" style={{ fontSize: '0.82em' }}>
              ({settings.bankNote})
            </p>
          )}

          {/* Dynamic VietQR Napas QR Code */}
          {settings.showVietQR && qrUrl && (order.paymentMethod === 'transfer' || order.paymentMethod === 'partial' || isPreview) && (
            <div className="pt-2 flex flex-col items-center justify-center">
              <div className="w-32 h-32 bg-white border border-black rounded p-1 flex items-center justify-center mx-auto">
                <img
                  src={qrUrl}
                  alt="VietQR Napas"
                  className="w-28 h-28 object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
              <p className="text-black font-medium mt-1" style={{ fontSize: '0.78em' }}>
                Quét mã VietQR để thanh toán nhanh
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer Message */}
      <div className="text-center pt-2 text-black space-y-0.5">
        <p className="font-medium text-black" style={{ fontSize: '0.92em' }}>
          {settings.footerMessage || 'Chúc quý khách có một bữa ăn hạnh phúc!'}
        </p>
      </div>
    </div>
  );
};
