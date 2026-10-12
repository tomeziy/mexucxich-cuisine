import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Customer } from '../../types';
import { Edit2, X } from 'lucide-react';

interface QuickEditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
}

export const QuickEditCustomerModal: React.FC<QuickEditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
}) => {
  const { updateCustomer } = useStore();
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

  if (!isOpen || !customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Vui lòng nhập tên khách hàng');
      return;
    }

    updateCustomer(customer.id, {
      name: name.trim(),
      phone: phone.trim(),
      address: address.trim(),
    });

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

          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Tên khách hàng <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
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
              onChange={e => setPhone(e.target.value)}
              placeholder="0988xxxxxx"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            />
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
              className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition"
            >
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
