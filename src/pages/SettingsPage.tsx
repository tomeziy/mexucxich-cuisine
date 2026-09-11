import React from 'react';
import { useStore } from '../context/StoreContext';
import { Settings, Printer } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { receiptSettings } = useStore();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Cài đặt Mẫu Hóa đơn & VietQR</h2>
        <p className="text-xs text-slate-500">Khổ in hiện tại: {receiptSettings.paperSize.toUpperCase()}</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs text-slate-600 font-medium">
          Màn hình cấu hình mẫu hóa đơn K80/K57 và VietQR đang được chuẩn bị sẵn sàng (Ticket 09).
        </p>
      </div>
    </div>
  );
};
