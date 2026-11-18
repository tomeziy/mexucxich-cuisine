import React from 'react';
import { MapPin, Plus, X } from 'lucide-react';

interface AddressListEditorProps {
  address: string;
  extraAddresses: string[];
  onChangeAddress: (val: string) => void;
  onChangeExtraAddresses: (vals: string[]) => void;
  placeholder?: string;
  compact?: boolean;
}

export const AddressListEditor: React.FC<AddressListEditorProps> = ({
  address,
  extraAddresses,
  onChangeAddress,
  onChangeExtraAddresses,
  placeholder = 'Số nhà, ngõ, đường, quận...',
  compact = false,
}) => {
  const handleAddExtra = () => {
    onChangeExtraAddresses([...extraAddresses, '']);
  };

  const handleUpdateExtra = (idx: number, val: string) => {
    const next = [...extraAddresses];
    next[idx] = val;
    onChangeExtraAddresses(next);
  };

  const handleRemoveExtra = (idx: number) => {
    onChangeExtraAddresses(extraAddresses.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
            <span>Địa chỉ giao hàng (chính)</span>
          </label>
          <button
            type="button"
            onClick={handleAddExtra}
            className="text-[11px] font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm địa chỉ</span>
          </button>
        </div>
        <textarea
          rows={2}
          value={address}
          onChange={e => onChangeAddress(e.target.value)}
          placeholder={placeholder}
          className={`w-full bg-slate-50 border border-slate-200 rounded-xl px-3 ${
            compact ? 'py-1.5 resize-none' : 'py-2'
          } text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500`}
        />
      </div>

      {extraAddresses.length > 0 && (
        <div className="space-y-1.5 pl-2 border-l-2 border-amber-200">
          {extraAddresses.map((extra, idx) => (
            <div key={idx} className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <MapPin className="w-3 h-3 text-amber-500 absolute left-2.5 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={extra}
                  onChange={e => handleUpdateExtra(idx, e.target.value)}
                  placeholder={`Địa chỉ phụ ${idx + 2} (cơ quan, nhà riêng...)`}
                  className="w-full bg-amber-50/40 border border-amber-200 rounded-xl pl-7 pr-2.5 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveExtra(idx)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0"
                title={`Xóa địa chỉ ${idx + 2}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
