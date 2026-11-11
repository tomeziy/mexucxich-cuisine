import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types';
import { normalizeVietnamesePhone } from '../../utils/excel';
import { findDuplicatePhoneCustomer } from '../../utils/customerSearch';
import { UserPlus, X, AlertTriangle } from 'lucide-react';

interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerAdded: (customer: Customer) => void;
  initialName?: string;
  initialPhone?: string;
}

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerAdded,
  initialName = '',
  initialPhone = '',
}) => {
  const { customers, addCustomer } = useStore();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const nameInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName || '');
      setPhone(initialPhone || '');
      setAddress('');
      setError('');

      setTimeout(() => {
        if (initialPhone && !initialName) {
          nameInputRef.current?.focus();
        } else if (initialName && !initialPhone) {
          phoneInputRef.current?.focus();
        } else {
          nameInputRef.current?.focus();
        }
      }, 50);
    }
  }, [isOpen, initialName, initialPhone]);

  // Live duplicate phone check
  const duplicateCustomer = useMemo(() => {
    return findDuplicatePhoneCustomer(customers, phone);
  }, [customers, phone]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên khách hàng');
      return;
    }

    if (duplicateCustomer) {
      setError(
        `Số điện thoại này đã được đăng ký cho khách hàng "${duplicateCustomer.name}" (${duplicateCustomer.phone}). Vui lòng kiểm tra lại!`
      );
      return;
    }

    const newCust = addCustomer({
      name: name.trim(),
      phone: normalizeVietnamesePhone(phone.trim()) || phone.trim(),
      address: address.trim(),
    });

    onCustomerAdded(newCust);
    setName('');
    setPhone('');
    setAddress('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <h4 className="font-extrabold text-sm text-slate-900">Thêm nhanh khách hàng</h4>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 pt-3 text-xs">
          {error && (
            <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-[11px] font-bold">
              {error}
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Tên khách hàng <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Ví dụ: Chị Lan, Anh Tuấn..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Số điện thoại</label>
            <input
              ref={phoneInputRef}
              type="tel"
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                if (error) setError('');
              }}
              placeholder="0988xxxxxx"
              className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-xs focus:outline-none font-medium ${
                duplicateCustomer
                  ? 'border-rose-400 focus:ring-1 focus:ring-rose-500 bg-rose-50/30'
                  : 'border-slate-200 focus:ring-1 focus:ring-amber-500'
              }`}
            />
            {duplicateCustomer && (
              <div className="mt-1 p-1.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-700 flex items-start gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span>
                  Trùng SĐT với <strong>{duplicateCustomer.name}</strong> ({duplicateCustomer.phone})
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Địa chỉ giao hàng</label>
            <textarea
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Số nhà, ngõ, đường, quận..."
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium resize-none"
            />
          </div>

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!!duplicateCustomer}
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-sm shadow-amber-500/20 transition"
            >
              Lưu khách hàng
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
