import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types';
import { normalizeVietnamesePhone } from '../../utils/excel';
import { findDuplicatePhoneCustomer } from '../../utils/customerSearch';
import { Edit2, X, AlertTriangle, Info } from 'lucide-react';

interface QuickEditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onCustomerUpdated?: (customer: Customer) => void;
}

export const QuickEditCustomerModal: React.FC<QuickEditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated,
}) => {
  const { customers, updateCustomer } = useStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (customer && isOpen) {
      setName(customer.name || '');
      setPhone(customer.phone || '');
      setAddress(customer.address || '');
      setError('');
    }
  }, [customer, isOpen]);

  // Live duplicate phone check (excluding current customer id)
  const duplicateCustomer = useMemo(() => {
    if (!customer) return null;
    return findDuplicatePhoneCustomer(customers, phone, customer.id);
  }, [customers, phone, customer]);

  if (!isOpen || !customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên khách hàng');
      return;
    }

    if (duplicateCustomer) {
      setError(
        `Số điện thoại này đã thuộc về khách hàng khác: "${duplicateCustomer.name}" (${duplicateCustomer.phone}). Không thể lưu trùng số!`
      );
      return;
    }

    const updatedCustomer: Customer = {
      ...customer,
      name: name.trim(),
      phone: normalizeVietnamesePhone(phone.trim()) || phone.trim(),
      address: address.trim(),
    };

    updateCustomer(customer.id, {
      name: updatedCustomer.name,
      phone: updatedCustomer.phone,
      address: updatedCustomer.address,
    });

    if (onCustomerUpdated) {
      onCustomerUpdated(updatedCustomer);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
      <div className="bg-white rounded-2xl max-w-sm w-full p-4 shadow-xl animate-in fade-in zoom-in duration-150">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">Sửa thông tin khách hàng</h4>
              <span className="text-[10px] text-slate-400 font-medium">Mã: {customer.id}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
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

          <div className="p-2 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Lưu ý: Thay đổi tại đây sẽ cập nhật hồ sơ gốc trong Danh bạ. Nếu chỉ đổi địa chỉ nhận hàng cho đơn này, hãy nhập trực tiếp ở mục Giao hàng.
            </span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Tên khách hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Tên khách hàng"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Số điện thoại</label>
            <input
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
                  Trùng SĐT với khách: <strong>{duplicateCustomer.name}</strong> ({duplicateCustomer.phone})
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
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
