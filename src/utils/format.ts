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
 * Cấu hình hiển thị chuẩn cho Khối thông tin người nhận Shipper (ADR-0011/ADR-0012)
 * Sử dụng font-bold (700) thay vì font-black (900) để triệt tiêu lỗi nhòe nét (faux-bold smear) khi in nhiệt
 */
export function getDeliveryCalloutConfig(size?: DeliveryCalloutSize): DeliveryCalloutConfig {
  const calloutSize = size || 'standard_large';
  const isExtraLarge = calloutSize === 'extra_large';
  return {
    size: calloutSize,
    fontSize: isExtraLarge ? '18px' : '15px',
    lineHeightClass: isExtraLarge ? 'leading-tight' : 'leading-snug',
    fontWeightClass: 'font-bold',
    borderClass: 'border-2 border-dashed border-black',
  };
}

/**
 * Tính toán trọng lượng thực nhận khi bán số lượng lẻ/cắt khúc cho các mặt hàng đóng gói hoặc cân ký (ADR-0012)
 * Ví dụ:
 * - Gói 500g, qty 0.5  => "250g"
 * - Gói 500g, qty 0.56 => "280g"
 * - Hũ 250g,  qty 0.5  => "125g"
 * - Khay 1kg, qty 0.59 => "590g"
 * - Hộp, tên "Sốt mỳ ý 600g", qty 0.5 => "300g"
 * - Túi (set 20c), qty 0.5 => null (không phải đơn vị cân nặng)
 */
export function calculateEffectiveWeight(
  unit?: string | null,
  name?: string | null,
  qty?: number | null
): string | null {
  if (qty === undefined || qty === null || qty <= 0 || qty === 1) {
    return null;
  }

  // Trích xuất số lượng và đơn vị đo từ chuỗi (hỗ trợ g, kg, gr, gram, ml, l, lít)
  const extract = (str?: string | null) => {
    if (!str) return null;
    const match = str.match(/(?:^|\s|\(|\/)(\d+(?:[.,]\d+)?)\s*(kg|kilogram|g|gr|gram|ml|l|lít)(?:\b|\)|\/|$)/i);
    if (!match) return null;
    const num = parseFloat(match[1].replace(',', '.'));
    const rawUnit = match[2].toLowerCase();
    return { num, rawUnit };
  };

  const parsed = extract(unit) || extract(name);
  if (!parsed || isNaN(parsed.num)) return null;

  const { num, rawUnit } = parsed;

  if (rawUnit === 'kg' || rawUnit === 'kilogram') {
    const totalKg = num * qty;
    if (totalKg < 1) {
      // Dưới 1kg quy đổi về gram cho nhân viên & khách dễ đọc: 0.59kg => 590g
      const grams = Math.round(totalKg * 1000 * 10) / 10;
      return `${Number(grams.toFixed(1))}g`;
    } else {
      const roundedKg = Math.round(totalKg * 1000) / 1000;
      return `${Number(roundedKg.toFixed(3))}kg`;
    }
  }

  if (rawUnit === 'g' || rawUnit === 'gr' || rawUnit === 'gram') {
    const totalG = Math.round(num * qty * 10) / 10;
    if (totalG >= 1000) {
      const kg = Math.round((totalG / 1000) * 1000) / 1000;
      return `${Number(kg.toFixed(3))}kg`;
    }
    return `${Number(totalG.toFixed(1))}g`;
  }

  if (rawUnit === 'ml') {
    const totalMl = Math.round(num * qty * 10) / 10;
    if (totalMl >= 1000) {
      const l = Math.round((totalMl / 1000) * 1000) / 1000;
      return `${Number(l.toFixed(3))}l`;
    }
    return `${Number(totalMl.toFixed(1))}ml`;
  }

  if (rawUnit === 'l' || rawUnit === 'lít') {
    const totalL = num * qty;
    if (totalL < 1) {
      const ml = Math.round(totalL * 1000 * 10) / 10;
      return `${Number(ml.toFixed(1))}ml`;
    }
    const roundedL = Math.round(totalL * 1000) / 1000;
    return `${Number(roundedL.toFixed(3))}l`;
  }

  return null;
}

export interface EffectiveUnitResult {
  displayUnit: string;
  effectiveWeight: string | null;
  isScaled: boolean;
}

/**
 * Định dạng nhãn đơn vị hiển thị thông minh trên Giỏ hàng & Hóa đơn
 * Ví dụ:
 * - "Gói 500g" với qty 0.5  => "Gói 500g → 250g"
 * - "Hộp" (tên có 600g) với qty 0.5 => "Hộp (300g)"
 * - "Gói 500g" với qty 1    => "Gói 500g"
 */
export function formatEffectiveUnit(
  unit: string,
  qty: number,
  name?: string | null
): EffectiveUnitResult {
  const effectiveWeight = calculateEffectiveWeight(unit, name, qty);
  if (!effectiveWeight) {
    return {
      displayUnit: unit,
      effectiveWeight: null,
      isScaled: false,
    };
  }

  const hasWeightInUnit = /\d+\s*(?:g|kg|gr|gram|ml|l|lít)\b/i.test(unit);
  const displayUnit = hasWeightInUnit
    ? `${unit} → ${effectiveWeight}`
    : `${unit} (${effectiveWeight})`;

  return {
    displayUnit,
    effectiveWeight,
    isScaled: true,
  };
}

