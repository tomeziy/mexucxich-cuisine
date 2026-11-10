import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Product } from '../../types';
import { formatVND } from '../../utils/format';
import { removeVietnameseTones } from '../../utils/vietnamese';
import { Search, X, Check, Package, ChevronDown } from 'lucide-react';

export interface ProductComboboxProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
  placeholder?: string;
  className?: string;
}

export const ProductCombobox: React.FC<ProductComboboxProps> = ({
  products,
  onSelectProduct,
  placeholder = 'Tìm món ăn để thêm...',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter & rank products
  const filteredProducts = useMemo(() => {
    const rawTrimmed = query.trim();
    if (!rawTrimmed) {
      return products.slice(0, 35);
    }

    const cleanQuery = removeVietnameseTones(rawTrimmed);
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    const numQ = rawTrimmed.replace(/\D/g, '');

    return products
      .filter(p => {
        const cleanName = removeVietnameseTones(p.name);
        const cleanCat = removeVietnameseTones(p.category || '');
        const cleanUnit = removeVietnameseTones(p.unit || '');
        const priceStr = String(p.price);
        const idStr = p.id.toLowerCase();

        const combined = `${cleanName} ${cleanCat} ${cleanUnit} ${priceStr} ${idStr}`;

        const allTokensMatch = tokens.every(tok => combined.includes(tok));
        const priceMatch = numQ.length > 2 && priceStr.includes(numQ);

        return allTokensMatch || priceMatch;
      })
      .slice(0, 40);
  }, [products, query]);

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredProducts]);

  // Scroll active item into view during keyboard navigation
  useEffect(() => {
    if (isKeyboardNavRef.current && listRef.current) {
      const activeElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
      isKeyboardNavRef.current = false;
    }
  }, [highlightedIndex]);

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setQuery('');
    setIsOpen(false);
    // Keep focus on input for fast repeated item additions
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex(prev => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredProducts[highlightedIndex]) {
        handleSelect(filteredProducts[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={e => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-8 pr-14 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-full"
              title="Xóa tìm kiếm"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(prev => !prev)}
            className="p-1 text-slate-400 hover:text-slate-600"
            title="Đóng / mở danh sách món"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-64 flex flex-col">
          <div className="px-2.5 py-1.5 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Danh sách món ăn ({filteredProducts.length})</span>
            <span>Enter hoặc nhấp để thêm</span>
          </div>

          <div ref={listRef} className="overflow-y-auto custom-scroll divide-y divide-slate-100 p-1">
            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <Package className="w-6 h-6 mx-auto mb-1 text-slate-300 opacity-60" />
                <span>Không tìm thấy món ăn nào phù hợp</span>
              </div>
            ) : (
              filteredProducts.map((p, idx) => {
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={p.id}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(p)}
                    className={`p-2 rounded-lg cursor-pointer flex items-center justify-between gap-2 transition ${
                      isHighlighted ? 'bg-amber-500 text-white shadow-2xs' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base shrink-0">{p.image || '🍲'}</span>
                      <div className="min-w-0">
                        <strong className={`block text-xs truncate ${isHighlighted ? 'text-white' : 'text-slate-900'}`}>
                          {p.name}
                        </strong>
                        <div className="flex items-center gap-1.5 text-[10px] opacity-80 mt-0.5">
                          {p.category && (
                            <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                              isHighlighted ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.category}
                            </span>
                          )}
                          <span>ĐVT: {p.unit}</span>
                          {p.stock !== undefined && (
                            <span>• Tồn: {p.stock}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`font-extrabold text-xs block ${isHighlighted ? 'text-white' : 'text-amber-600'}`}>
                        {formatVND(p.price)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
