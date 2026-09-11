import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package, BarChart3, Users, Settings } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const Sidebar: React.FC = () => {
  const { customers } = useStore();

  const totalDebtCount = customers.filter(c => c.debt > 0).length;

  const navItems = [
    { to: '/', label: 'Bán hàng (POS)', icon: ShoppingCart, end: true },
    { to: '/products', label: 'Kho & Sản phẩm', icon: Package },
    { to: '/reports', label: 'Báo cáo & Đơn hàng', icon: BarChart3 },
    { to: '/customers', label: 'Khách & Công nợ', icon: Users, badge: totalDebtCount > 0 ? totalDebtCount : undefined },
    { to: '/settings', label: 'Cài đặt Hóa đơn', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 shrink-0 p-3 hidden lg:flex flex-col justify-between sticky top-[61px] h-[calc(100vh-61px)]">
      <div className="space-y-1">
        <p className="text-[10px] uppercase font-bold text-slate-400 px-3 mb-2 tracking-wider">
          Menu Chức Năng
        </p>
        {navItems.map(item => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `
                flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition
                ${isActive
                  ? 'bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
              `}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="bg-rose-500 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {item.badge} nợ
                </span>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 text-center">
        <p className="font-bold text-slate-700">MexucxichCuisine</p>
        <p className="text-[10px] text-slate-400 mt-0.5">Phiên bản 1.0.0 • Offline-Ready</p>
      </div>
    </aside>
  );
};
