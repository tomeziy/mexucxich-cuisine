import React, { useState, useEffect } from 'react';
import { parseQuantity, formatDisplayQty } from '../../utils/format';

export interface QuantityInputProps {
  value: number;
  onChange: (val: number) => void;
  max?: number;
  className?: string;
  title?: string;
}

/**
 * Ô nhập số lượng trực tiếp hỗ trợ số thực, cân ký lẻ (ADR-0011)
 * Chuẩn hóa cả dấu chấm (.) và dấu phẩy (,) tiếng Việt.
 * Tự động bôi đen toàn bộ khi click giúp thu ngân gõ số mới nhanh nhất.
 */
export const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  max,
  className = '',
  title = 'Nhập số lượng (hỗ trợ số lẻ: 0.59 hoặc 0,59)',
}) => {
  const [localStr, setLocalStr] = useState<string>(formatDisplayQty(value));
  const [isFocused, setIsFocused] = useState(false);

  // Đồng bộ giá trị khi bấm nút [+] hoặc [-] bên ngoài
  useEffect(() => {
    if (!isFocused) {
      setLocalStr(formatDisplayQty(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalStr(raw);

    const parsed = parseQuantity(raw);
    if (parsed > 0) {
      if (max !== undefined && parsed > max) {
        onChange(max);
      } else {
        onChange(parsed);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const trimmed = localStr.trim();
    if (!trimmed) {
      const fallback = value > 0 ? value : 1;
      setLocalStr(formatDisplayQty(fallback));
      if (value <= 0) onChange(1);
      return;
    }

    const sanitized = trimmed.replace(',', '.');
    const rawParsed = parseFloat(sanitized);

    // Nếu gõ chữ hoặc chuỗi không hợp lệ, hoàn nguyên về giá trị hợp lệ trước đó
    if (isNaN(rawParsed)) {
      const fallback = value > 0 ? value : 1;
      setLocalStr(formatDisplayQty(fallback));
      if (value <= 0) onChange(1);
      return;
    }

    // Nếu gõ số 0 rõ ràng hoặc số âm, tiến hành xóa món
    if (rawParsed <= 0) {
      onChange(0);
      return;
    }

    let finalVal = rawParsed;
    if (max !== undefined && finalVal > max) {
      finalVal = max;
    }
    finalVal = Math.round(finalVal * 10000) / 10000;
    setLocalStr(formatDisplayQty(finalVal));
    onChange(finalVal);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={localStr}
      title={title}
      onFocus={e => {
        setIsFocused(true);
        e.currentTarget.select();
      }}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
};
