import type { DeliveryCalloutSize } from '../types/index.ts';

export function formatVND(amount: number): string {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Định dạng số lượng hiển thị (loại bỏ số 0 thừa ở đuôi nếu là số thập phân)
 * Xử lý an toàn sai số dấu phẩy động (float precision)
 * Ví dụ: 1 -> "1", 0.59 -> "0.59", 0.5 -> "0.5", 1.25 -> "1.25"
 */
export function formatDisplayQty(qty: number): string {
  if (typeof qty !== 'number' || isNaN(qty)) return '0';
  const rounded = Math.round(qty * 10000) / 10000;
  return rounded.toString();
}

/**
 * Định dạng số lượng in trên hóa đơn nhiệt K80
 * Ví dụ: 1 -> "x1", 2 -> "x2", 0.59 -> "x0.59", 0.5 -> "x0.5"
 */
export function formatReceiptQty(qty: number): string {
  return `x${formatDisplayQty(qty)}`;
}

/**
 * Phân tích chuỗi số lượng nhập từ bàn phím, chuẩn hóa cả dấu chấm (.) và dấu phẩy (,) tiếng Việt
 * Tự động chặn giá trị âm (clamped at 0) và làm tròn tối đa 4 chữ số thập phân
 * Ví dụ: "0,59" -> 0.59, "0.5" -> 0.5, " 1,25 " -> 1.25, ",59" -> 0.59, "-1" -> 0
 */
export function parseQuantity(input: string | number | null | undefined): number {
  if (typeof input === 'number') {
    if (isNaN(input) || input < 0) return 0;
    return Math.round(input * 10000) / 10000;
  }
  if (!input || typeof input !== 'string') return 0;

  const sanitized = input.trim().replace(',', '.');
  const parsed = parseFloat(sanitized);
  if (isNaN(parsed) || parsed < 0) return 0;

  return Math.round(parsed * 10000) / 10000;
}

export interface DeliveryCalloutConfig {
  size: DeliveryCalloutSize;
  fontSize: string;
  lineHeightClass: string;
  fontWeightClass: string;
  borderClass: string;
}

/**
 * Cấu hình hiển thị chuẩn cho Khối thông tin người nhận Shipper (ADR-0011)
 */
export function getDeliveryCalloutConfig(size?: DeliveryCalloutSize): DeliveryCalloutConfig {
  const calloutSize = size || 'standard_large';
  const isExtraLarge = calloutSize === 'extra_large';
  return {
    size: calloutSize,
    fontSize: isExtraLarge ? '18px' : '15px',
    lineHeightClass: isExtraLarge ? 'leading-tight' : 'leading-snug',
    fontWeightClass: 'font-black',
    borderClass: 'border-2 border-dashed border-black',
  };
}

