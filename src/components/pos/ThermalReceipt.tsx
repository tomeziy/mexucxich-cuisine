import React from 'react';
import { Order, ReceiptSettings } from '../../types';
import {
  formatVND,
  formatDate,
  formatReceiptQty,
  formatDisplayQty,
  getDeliveryCalloutConfig,
  formatEffectiveUnit,
} from '../../utils/format';

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
  const fontFamilyStyle =
    settings.fontFamily === 'system'
      ? "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      : settings.fontFamily === 'arial'
      ? 'Arial, "Helvetica Neue", Helvetica, sans-serif'
      : "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // VietQR Napas format
  const vietQrAmount = order.paymentMethod === 'partial' ? (order.paidAmount || order.total) : order.total;
  const qrUrl =
    settings.bankAccount && settings.bankCode
      ? `https://img.vietqr.io/image/${settings.bankCode}-${settings.bankAccount}-compact2.png?amount=${vietQrAmount}&addInfo=${encodeURIComponent(
          order.id
        )}&accountName=${encodeURIComponent(settings.bankAccountName || '')}`
      : '';

  const totalQty = order.items.reduce((sum, i) => sum + i.qty, 0);
  const calloutConfig = getDeliveryCalloutConfig(settings.deliveryCalloutSize);

  return (
    <div
      className="space-y-2 text-black leading-snug tracking-normal"
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

      {/* Customer Recipient Block / Delivery Callout Header (ADR-0011) */}
      {(settings.showCustomer || order.orderType === 'delivery') && (
        <div
          data-testid="delivery-callout-header"
          className={`py-2 px-2 ${calloutConfig.borderClass} my-1.5 text-black ${calloutConfig.fontWeightClass} ${calloutConfig.lineHeightClass}`}
          style={{
            fontSize: calloutConfig.fontSize,
          }}
        >
          {order.orderType === 'delivery' && (
            <div className="text-center pb-1 border-b border-dashed border-black mb-1.5">
              <span className="font-bold uppercase tracking-wider text-black text-xs block">
                ★ GIAO HÀNG (SHIPPER) ★
              </span>
            </div>
          )}

          <div className="flex justify-between items-baseline gap-1.5">
            <span className="shrink-0 font-bold">Khách:</span>
            <span className="text-right font-bold break-words flex-1">
              {order.customerName || 'Khách lẻ tại quầy'}
            </span>
          </div>

          {order.customerPhone && (
            <div className="flex justify-between items-baseline gap-1.5 pt-0.5">
              <span className="shrink-0 font-bold">SĐT:</span>
              <span className="text-right font-bold tracking-wide flex-1">
                {order.customerPhone}
              </span>
            </div>
          )}

          {order.customerAddress && (
            <div className="flex flex-col gap-0.5 pt-1">
              <span className="shrink-0 font-bold">Địa chỉ:</span>
              <span className="font-bold text-left break-words pl-0.5">
                {order.customerAddress}
              </span>
            </div>
          )}

          {order.shippingNote && (
            <div className="flex flex-col gap-0.5 pt-1 mt-1 border-t border-dashed border-black">
              <span className="shrink-0 font-bold">Ghi chú ship:</span>
              <span className="font-bold italic text-left break-words pl-0.5">
                {order.shippingNote}
              </span>
            </div>
          )}

          {settings.showOrderType && order.orderType !== 'delivery' && (
            <div className="flex justify-between items-baseline pt-1 text-xs font-bold">
              <span>Hình thức:</span>
              <span className="uppercase">Tại chỗ</span>
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

        {/* Item Rows with Dynamic Portion Weight Display (ADR-0012) */}
        <div className="divide-y divide-dashed divide-black">
          {order.items.map((item, idx) => {
            const { displayUnit, effectiveWeight } = formatEffectiveUnit(item.unit, item.qty, item.name);
            return (
              <div key={idx} className="py-1.5 space-y-0.5">
                {/* Line 1: Item Name & Scaled Unit */}
                <div className="font-semibold text-black leading-snug" style={{ fontSize: '1em' }}>
                  {item.name}
                  {item.unit && (
                    <span className="font-normal text-black ml-1" style={{ fontSize: '0.85em' }}>
                      ({displayUnit})
                    </span>
                  )}
                </div>
                {/* Line 2: 3 Columns - Price | Qty (with Weight) | Total */}
                <div className="flex justify-between items-center text-black" style={{ fontSize: '0.92em' }}>
                  <span className="w-1/3 text-left font-normal">{formatVND(item.price)}</span>
                  <span className="w-1/3 text-center font-medium">
                    {formatReceiptQty(item.qty)}
                    {effectiveWeight && (
                      <span className="block font-bold text-[0.85em] text-black">
                        ({effectiveWeight})
                      </span>
                    )}
                  </span>
                  <span className="w-1/3 text-right font-semibold text-black" style={{ fontSize: '1em' }}>
                    {formatVND(Math.round(item.price * item.qty))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Totals */}
      <div className="py-2 border-b border-dashed border-black space-y-1" style={{ fontSize: '0.9em' }}>
        <div className="flex justify-between text-black">
          <span className="font-normal">Tổng số lượng:</span>
          <span className="font-semibold text-black">{formatDisplayQty(totalQty)}</span>
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
