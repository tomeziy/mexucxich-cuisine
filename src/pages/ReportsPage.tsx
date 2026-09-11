import React from 'react';
import { useStore } from '../context/StoreContext';
import { BarChart3 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { orders } = useStore();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Báo cáo & Lịch sử Đơn hàng</h2>
        <p className="text-xs text-slate-500">Tổng cộng {orders.length} đơn hàng trong hệ thống</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs text-slate-600 font-medium">
          Màn hình báo cáo doanh thu và lợi nhuận ước tính đang được chuẩn bị sẵn sàng (Ticket 07).
        </p>
      </div>
    </div>
  );
};
