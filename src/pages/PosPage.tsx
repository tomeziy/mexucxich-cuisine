import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Search, Plus, ShoppingBag } from 'lucide-react';

export const PosPage: React.FC = () => {
  const { products, orders } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');

  const categories = ['Tất cả', 'Đồ tự làm', 'Đặc sản tuyển chọn', 'Ăn vặt & Khô', 'Gia vị & Sốt'];

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'Tất cả' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const preparingOrders = orders.filter(o => o.status === 'preparing').length;
  const deliveringOrders = orders.filter(o => o.status === 'delivering').length;

  return (
    <div className="space-y-3">
      {/* Status Bar for Delivery Orders */}
      <div className="grid grid-cols-3 bg-white p-1 rounded-2xl border border-slate-200 text-xs font-bold shadow-xs">
        <button className="py-2 rounded-xl bg-amber-500 text-white shadow-xs text-center transition">
          Bán tại quầy
        </button>
        <button className="py-2 rounded-xl text-slate-600 hover:bg-slate-50 text-center transition">
          Đang chuẩn bị ({preparingOrders})
        </button>
        <button className="py-2 rounded-xl text-slate-600 hover:bg-slate-50 text-center transition">
          Đang giao ({deliveringOrders})
        </button>
      </div>

      {/* Quick Search & Filter */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Tìm nhanh món ăn, đặc sản theo tên hoặc mã SP..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll">
          {categories.map(cat => {
            const count = cat === 'Tất cả' ? products.length : products.filter(p => p.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`
                  shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition
                  ${active
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                `}
              >
                {cat} <span className="opacity-75 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products List (Variant C Compact List) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
        {filteredProducts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            Không tìm thấy món ăn nào khớp với từ khóa
          </div>
        ) : (
          filteredProducts.map(p => (
            <div
              key={p.id}
              className="p-3 flex items-center justify-between gap-3 hover:bg-amber-50/30 transition cursor-pointer"
            >
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                {p.image}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs text-slate-900 truncate">{p.name}</h4>
                  {p.stock <= 5 && (
                    <span className="text-[9px] font-extrabold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded-md">
                      Còn {p.stock}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">{p.unit} • Kho: {p.stock}</p>
                <span className="text-xs font-extrabold text-amber-600">
                  {new Intl.NumberFormat('vi-VN').format(p.price)}đ
                </span>
              </div>
              <button
                className="w-8 h-8 rounded-xl bg-amber-100 hover:bg-amber-500 hover:text-white text-amber-800 font-extrabold flex items-center justify-center transition"
                title="Thêm vào giỏ"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bottom Cart Floating Bar preview */}
      <div className="sticky bottom-16 lg:bottom-4 bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center text-white font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400">Giỏ hàng: <strong>0 món</strong></p>
            <p className="text-sm font-extrabold text-amber-400">0đ</p>
          </div>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs shadow-md transition">
          Thanh toán ➔
        </button>
      </div>
    </div>
  );
};
