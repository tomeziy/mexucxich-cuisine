import React from 'react';
import { useStore } from '../context/StoreContext';
import { Package, AlertCircle } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { products } = useStore();
  const lowStockCount = products.filter(p => p.stock <= 5).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Quản lý Sản phẩm & Kho hàng</h2>
          <p className="text-xs text-slate-500">Danh sách {products.length} món trong thực đơn tiệm</p>
        </div>
        {lowStockCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
            <AlertCircle className="w-4 h-4" />
            <span>{lowStockCount} món sắp hết hàng (≤ 5)</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
        <p className="text-xs text-slate-600 font-medium">
          Màn hình quản lý kho đang được chuẩn bị sẵn sàng (Ticket 05).
        </p>
      </div>
    </div>
  );
};
