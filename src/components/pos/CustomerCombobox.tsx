import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer } from '../../types';
import { formatVND } from '../../utils/format';
import { filterAndRankCustomers, isPhoneNumberQuery } from '../../utils/customerSearch';
import { Search, X, Check, UserPlus, Phone, MapPin, ChevronDown } from 'lucide-react';

export interface CustomerComboboxProps {
  customers: Customer[];
  selectedCustomerId: string;
  onSelectCustomer: (customer: Customer) => void;
  onQuickAdd?: (query: string, fieldType?: 'name' | 'phone') => void;
  className?: string;
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
  const quickAddBtnRef = useRef<HTMLButtonElement>(null);
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

  // Filter & Ranking Algorithm (ADR-0016: Diacritic-Aware & Phone-First Ranking Engine)
  const filteredCustomers = useMemo(() => {
    return filterAndRankCustomers(customers, query, {
      selectedCustomerId,
    }).slice(0, 30);
  }, [customers, query, selectedCustomerId]);

  const isPhoneQuery = useMemo(() => {
    return isPhoneNumberQuery(query);
  }, [query]);

  // Total navigable items: filtered customers + pinned quick-add button (if enabled)
  const maxNavIndex = onQuickAdd ? filteredCustomers.length : Math.max(0, filteredCustomers.length - 1);

  // Handle open combobox
  const handleOpen = () => {
    setIsOpen(true);
    setQuery('');
    setHighlightedIndex(0);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleTriggerQuickAdd = () => {
    if (!onQuickAdd) return;
    const fieldType = isPhoneQuery ? 'phone' : 'name';
    onQuickAdd(query.trim(), fieldType);
    setIsOpen(false);
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
      setHighlightedIndex(prev => (prev < maxNavIndex ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      isKeyboardNavRef.current = true;
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : maxNavIndex));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex === filteredCustomers.length && onQuickAdd) {
        handleTriggerQuickAdd();
      } else if (filteredCustomers.length > 0 && filteredCustomers[highlightedIndex]) {
        handleSelect(filteredCustomers[highlightedIndex]);
      } else if (onQuickAdd) {
        handleTriggerQuickAdd();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  // Scroll active item into view ONLY when navigating via keyboard (prevents scroll jumps on mouse drag)
  useEffect(() => {
    if (isOpen && isKeyboardNavRef.current) {
      if (highlightedIndex < filteredCustomers.length && listRef.current) {
        const activeElement = listRef.current.children[highlightedIndex] as HTMLElement;
        if (activeElement) {
          activeElement.scrollIntoView({ block: 'nearest' });
        }
      } else if (highlightedIndex === filteredCustomers.length && quickAddBtnRef.current) {
        quickAddBtnRef.current.scrollIntoView({ block: 'nearest' });
      }
      isKeyboardNavRef.current = false;
    }
  }, [highlightedIndex, isOpen, filteredCustomers.length]);

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
                  setHighlightedIndex(0);
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

          {/* Dropdown Results Popover with Pinned Quick Add (ADR-0016) */}
          <div className="absolute left-0 right-0 mt-1 max-h-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 flex flex-col overflow-hidden text-xs">
            {/* Scrollable list of matched customers */}
            <div
              ref={listRef}
              className="overflow-y-auto max-h-60 py-1 divide-y divide-slate-50 flex-1"
            >
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((c, idx) => {
                  const isSelected = c.id === selectedCustomerId;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={c.id}
                      onMouseDown={e => {
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
                <div className="p-3 text-center text-slate-500 text-xs">
                  Không tìm thấy khách hàng nào khớp với{' '}
                  <strong className="text-slate-800">"{query}"</strong>
                </div>
              )}
            </div>

            {/* Pinned Always-Visible Quick Add Action (ADR-0016) */}
            {onQuickAdd && (
              <div className="p-1.5 border-t border-slate-100 bg-slate-50/90 shrink-0">
                <button
                  ref={quickAddBtnRef}
                  type="button"
                  onMouseDown={e => {
                    e.preventDefault();
                    handleTriggerQuickAdd();
                  }}
                  onClick={handleTriggerQuickAdd}
                  onMouseEnter={() => setHighlightedIndex(filteredCustomers.length)}
                  className={`w-full py-1.5 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                    highlightedIndex === filteredCustomers.length
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-white hover:bg-amber-50 text-amber-800 border-amber-300 shadow-2xs'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {query.trim()
                      ? isPhoneQuery
                        ? `+ Thêm khách với SĐT "${query.trim()}"`
                        : `+ Thêm khách "${query.trim()}"`
                      : '+ Thêm mới khách hàng'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
