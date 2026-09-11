import React from 'react';
import { useStore } from '../context/StoreContext';
import { Users, DollarSign } from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { customers } = useStore();
  const totalDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Quản lý Khách hàng & Công nợ</h2>
          <p className="text-xs text-slate-500">{customers.length} khách hàng đã lưu</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
          <DollarSign className="w-4 h-4 text-rose-600" />
          <span>Tổng nợ phải thu: <strong>{new Intl.NumberFormat('vi-VN').format(totalDebt)}đ</strong></span>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs text-slate-600 font-medium">
          Màn hình sổ nợ lũy kế và thu nợ khách hàng đang được chuẩn bị sẵn sàng (Ticket 06).
        </p>
      </div>
    </div>
  );
};
