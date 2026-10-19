import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer } from '../../types';
import { formatVND } from '../../utils/format';
import { removeVietnameseTones } from '../../utils/vietnamese';
import { Search, X, Check, UserPlus, Phone, MapPin, ChevronDown } from 'lucide-react';

export interface CustomerComboboxProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer) => void;
  onQuickAdd?: (nameQuery: string) => void;
  className?: string;
}

interface RankedCustomer {
  customer: Customer;
  score: number;
}

export const CustomerCombobox: React.FC<CustomerComboboxProps> = ({
  customers,
  selectedCustomerId,
  onSelectCustomer,
  onQuickAdd,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const isKeyboardNavRef = useRef(false);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || customers[0];
  }, [customers, selectedCustomerId]);

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

  // Filter & Ranking Algorithm (ADR-0009 / ADR-0010)
  // Multi-token AND matching + Whole-word prioritization (e.g. "Yến" ranks above "Nguyễn")
  const filteredCustomers = useMemo(() => {
    const rawTrimmed = query.trim();
    if (!rawTrimmed) {
      const selected = selectedCustomer ? [selectedCustomer] : [];
      const others = customers
        .filter(c => c.id !== selectedCustomerId)
        .sort((a, b) => (b.debt || 0) - (a.debt || 0));
      return [...selected, ...others].slice(0, 30);
    }

    const cleanQuery = removeVietnameseTones(rawTrimmed);
    const tokens = cleanQuery.split(/\s+/).filter(Boolean);
    const numericQuery = rawTrimmed.replace(/\D/g, '');

    const ranked: RankedCustomer[] = [];

    for (const c of customers) {
      const nameClean = removeVietnameseTones(c.name);
      const phone = c.phone || '';
      const addressClean = c.address ? removeVietnameseTones(c.address) : '';
      const combined = `${nameClean} ${phone} ${addressClean}`;

      // All tokens must be present in customer info
      const allTokensMatch = tokens.every(tok => combined.includes(tok));
      if (!allTokensMatch) continue;

      let score = 0;
      const nameWords = nameClean.split(/\s+/).filter(Boolean);

      const isNamePrefix = nameClean.startsWith(cleanQuery);
      const isPhonePrefix = numericQuery.length > 0 && phone.startsWith(numericQuery);
      const isWordBoundaryMatch = nameWords.some(w => w === cleanQuery || (cleanQuery.length >= 2 && w.startsWith(cleanQuery)));
      const isNameSubstring = nameClean.includes(cleanQuery);
      const isPhoneSubstring = numericQuery.length > 0 && phone.includes(numericQuery);
      const isAddrSubstring = addressClean.includes(cleanQuery);

      if (isNamePrefix) {
        score = 120;
      } else if (isWordBoundaryMatch) {
        // Khớp nguyên từ hoặc đầu từ trong tên (VD: "Lê Yến", "Hải Yến" khi gõ "yến")
        score = 110;
      } else if (isPhonePrefix) {
        score = 100;
      } else if (tokens.length > 1 && tokens.every(t => nameClean.includes(t))) {
        score = 90;
      } else if (isNameSubstring || isPhoneSubstring) {
        score = 60;
      } else if (isAddrSubstring) {
        score = 40;
      } else {
        score = 30;
      }

      // Ưu tiên cộng điểm nếu khách đang có dư nợ hoặc là khách vừa chọn
      if (c.debt > 0) score += 20;
      if (c.id === selectedCustomerId) score += 5;

      ranked.push({ customer: c, score });
    }

    // Sort by score descending, then by name length ascending
    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.customer.name.length - b.customer.name.length;
    });

    return ranked.slice(0, 30).map(r => r.customer);
  }, [customers, query, selectedCustomerId, selectedCustomer]);

  // Handle open combobox
  const handleOpen = () => {
    setIsOpen(true);
    setQuery('');
    setHighlightedIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex(prev => (prev < filteredCustomers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredCustomers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCustomers.length > 0 && filteredCustomers[highlightedIndex]) {
        handleSelect(filteredCustomers[highlightedIndex]);
      } else if (query.trim() && onQuickAdd) {
        onQuickAdd(query.trim());
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Scroll active item into view ONLY when navigating via keyboard (prevents scroll jumps on mouse drag)
  useEffect(() => {
    if (isOpen && listRef.current && isKeyboardNavRef.current) {
      const activeElement = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: 'nearest' });
      }
      isKeyboardNavRef.current = false;
    }
  }, [highlightedIndex, isOpen]);

  const handleSelect = (customer: Customer) => {
    onSelectCustomer(customer);
    setIsOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className={`relative flex-1 min-w-0 ${className}`}>
      {/* Closed State Button / Trigger */}
      {!isOpen ? (
        <button
          type="button"
          onClick={handleOpen}
          className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-left font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500 transition flex items-center justify-between gap-1.5"
          title="Nhấn để tìm kiếm hoặc chọn khách hàng"
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate font-bold text-slate-900">
              {selectedCustomer?.name || 'Chọn khách hàng...'}
            </span>
            {selectedCustomer?.phone && (
              <span className="text-[11px] text-slate-500 shrink-0 font-normal">
                ({selectedCustomer.phone})
              </span>
            )}
            {selectedCustomer && selectedCustomer.debt > 0 && (
              <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded shrink-0">
                Nợ: {formatVND(selectedCustomer.debt)}
              </span>
            )}
          </div>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      ) : (
        /* Active Search Input with visible typing cursor */
        <div className="relative w-full">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-amber-500 absolute left-2.5 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Gõ tên, SĐT hoặc địa chỉ khách..."
              className="w-full bg-white border-2 border-amber-500 rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-slate-900 focus:outline-none shadow-sm"
              autoFocus
            />
            {query ? (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  inputRef.current?.focus();
                }}
                className="absolute right-2 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                title="Xóa tìm kiếm"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 text-[10px] font-bold"
                title="Đóng"
              >
                ESC
              </button>
            )}
          </div>

          {/* Dropdown Results Popover */}
          <div
            ref={listRef}
            className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1 divide-y divide-slate-50 text-xs"
          >
            {filteredCustomers.length > 0 ? (
              filteredCustomers.map((c, idx) => {
                const isSelected = c.id === selectedCustomerId;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={c.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(c);
                    }}
                    onClick={() => handleSelect(c)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition ${
                      isHighlighted
                        ? 'bg-amber-50 text-amber-900'
                        : isSelected
                        ? 'bg-slate-50 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                        {c.phone && (
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5 text-slate-400" />
                            {c.phone}
                          </span>
                        )}
                        {c.debt > 0 && (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded">
                            Nợ: {formatVND(c.debt)}
                          </span>
                        )}
                      </div>
                      {c.address && (
                        <p className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                          <MapPin className="w-2.5 h-2.5 text-slate-300 shrink-0" />
                          <span>{c.address}</span>
                        </p>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-3 text-center space-y-2">
                <p className="text-slate-500 text-xs">
                  Không tìm thấy khách hàng nào khớp với <strong className="text-slate-800">"{query}"</strong>
                </p>
                {onQuickAdd && (
                  <button
                    type="button"
                    onClick={() => {
                      onQuickAdd(query.trim());
                      setIsOpen(false);
                    }}
                    className="w-full py-1.5 px-3 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-800 font-bold text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Thêm nhanh khách "{query.trim()}"</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
