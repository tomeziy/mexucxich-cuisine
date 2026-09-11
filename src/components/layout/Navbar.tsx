import React from 'react';
import { useStore } from '../../context/StoreContext';
import { RotateCcw, UtensilsCrossed, Clock } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { orders, resetToMockData, receiptSettings } = useStore();

  const activeOrdersCount = orders.filter(
    o => o.status === 'preparing' || o.status === 'delivering'
  ).length;

  const handleReset = () => {
    if (window.confirm('Khôi phục toàn bộ dữ liệu mẫu ban đầu (8 món, 4 khách hàng)? Dữ liệu hiện tại sẽ được làm mới.')) {
      resetToMockData();
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 font-black text-xl">
            {receiptSettings.showLogo ? '🌭' : <UtensilsCrossed className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                {receiptSettings.storeName || 'MexucxichCuisine'}
              </span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                POS KiotViet
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              {receiptSettings.storeSubtitle || 'Tiệm Ẩm thực Thủ công & Đặc sản Tuyển chọn'}
            </p>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2 sm:gap-3">
          {activeOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1 rounded-lg text-xs font-bold animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>{activeOrdersCount} đơn đang giao</span>
            </div>
          )}

          <button
            onClick={handleReset}
            title="Làm mới dữ liệu về mặc định"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dữ liệu mẫu</span>
          </button>
        </div>
      </div>
    </header>
  );
};
