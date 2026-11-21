import React from 'react';
import { useStore } from '../../context/StoreContext';
import { UtensilsCrossed, Clock, Cloud, RefreshCw, AlertCircle, LogOut, Shield, Store } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    products,
    orders,
    receiptSettings,
    isCloudSyncing,
    lastCloudSyncAt,
    cloudSyncError,
    pendingOutboxCount,
    syncCloudToLocal,
    currentUser,
    logoutOrLockScreen,
  } = useStore();

  const activeOrdersCount = orders.filter(
    o => o.status === 'preparing' || o.status === 'delivering'
  ).length;

  const syncTitle = isCloudSyncing
    ? 'Đang tải dữ liệu mới nhất từ Cloud...'
    : cloudSyncError
    ? `Lỗi đồng bộ: ${cloudSyncError}. Bấm để thử lại.`
    : pendingOutboxCount > 0
    ? `Có ${pendingOutboxCount} thay đổi đang chờ gửi lên Cloud — Bấm để đồng bộ ngay`
    : lastCloudSyncAt
    ? `Đã đồng bộ Cloud lúc ${new Date(lastCloudSyncAt).toLocaleTimeString('vi-VN')} — Bấm để làm mới ngay`
    : 'Bấm để đồng bộ dữ liệu từ Cloud';

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
        {/* Brand */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20 font-black text-xl shrink-0">
            {receiptSettings.showLogo ? '🌭' : <UtensilsCrossed className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight truncate">
                {receiptSettings.storeName || 'MexucxichCuisine'}
              </span>
              <span className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                Cloud POS
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block truncate">
              {receiptSettings.storeSubtitle || 'Tiệm Ẩm thực Thủ công & Đặc sản Tuyển chọn'}
            </p>
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => syncCloudToLocal()}
            disabled={isCloudSyncing}
            title={syncTitle}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition active:scale-95 ${
              isCloudSyncing
                ? 'bg-sky-50 border-sky-200 text-sky-700 cursor-wait'
                : cloudSyncError
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : pendingOutboxCount > 0
                ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            {isCloudSyncing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                <span>Đang đồng bộ Cloud...</span>
              </>
            ) : cloudSyncError ? (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>Lỗi Cloud • Thử lại</span>
              </>
            ) : pendingOutboxCount > 0 ? (
              <>
                <Cloud className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Chờ gửi Cloud ({pendingOutboxCount})</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="hidden sm:inline">
                  Cloud: {products.length} món • {orders.length} đơn
                </span>
                <span className="sm:hidden">
                  {products.length} món • {orders.length} đơn
                </span>
              </>
            )}
          </button>

          {currentUser && (
            <span
              className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold ${
                currentUser.role === 'admin'
                  ? 'bg-slate-900 border-slate-800 text-amber-300'
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
              title={`Đang đăng nhập: ${currentUser.username}`}
            >
              {currentUser.role === 'admin' ? (
                <Shield className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Store className="w-3.5 h-3.5 text-amber-600" />
              )}
              <span>{currentUser.role === 'admin' ? 'Admin' : currentUser.username}</span>
            </span>
          )}

          <button
            type="button"
            onClick={() => logoutOrLockScreen()}
            title="Đăng xuất khỏi máy này"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 text-xs font-bold transition active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden md:inline">Đăng xuất</span>
          </button>

          {activeOrdersCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 text-amber-900 px-2.5 py-1.5 rounded-xl text-xs font-bold animate-pulse">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">{activeOrdersCount} đơn đang giao</span>
              <span className="sm:hidden">{activeOrdersCount}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
