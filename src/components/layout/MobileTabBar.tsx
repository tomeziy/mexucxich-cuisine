import React from 'react';
import { NavLink } from 'react-router-dom';
import { ShoppingCart, Package, BarChart3, Users, Settings } from 'lucide-react';
import { useStore } from '../../context/StoreContext';

export const MobileTabBar: React.FC = () => {
  const { customers } = useStore();
  const totalDebtCount = customers.filter(c => c.debt > 0).length;

  const tabs = [
    { to: '/', label: 'Bán hàng', icon: ShoppingCart, end: true },
    { to: '/products', label: 'Kho hàng', icon: Package },
    { to: '/reports', label: 'Báo cáo', icon: BarChart3 },
    { to: '/customers', label: 'Công nợ', icon: Users, badge: totalDebtCount > 0 ? totalDebtCount : undefined },
    { to: '/settings', label: 'Cài đặt', icon: Settings },
  ];

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {tabs.map(tab => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => `
              relative flex flex-col items-center justify-center py-1 px-2 rounded-xl text-[10px] font-bold transition
              ${isActive ? 'text-amber-600' : 'text-slate-400 hover:text-slate-600'}
            `}
          >
            <div className="relative">
              <Icon className="w-5 h-5 mb-0.5" />
              {tab.badge && (
                <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
