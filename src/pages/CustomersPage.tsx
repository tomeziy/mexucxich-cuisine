import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Customer } from '../types';
import { formatVND, formatDate } from '../utils/format';
import { matchesSearch } from '../utils/vietnamese';
import {
  Users,
  DollarSign,
  Search,
  Plus,
  ArrowDownCircle,
  Eye,
  Phone,
  MapPin,
  X,
  History,
  AlertCircle,
  CheckCircle2,
  Receipt,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import { exportCustomersToExcel } from '../utils/excel';

export const CustomersPage: React.FC = () => {
  const { customers, orders, debtPayments, addCustomer, payDebt } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyDebt, setFilterOnlyDebt] = useState(false);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);

  // Add Customer Form
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');

  // Pay Debt Form
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'cash' | 'transfer'>('cash');
  const [payNote, setPayNote] = useState('');

  // Filtered customers
  const filteredCustomers = customers.filter(c => {
    const matchesQuery =
      matchesSearch(c.name, searchQuery) ||
      (c.phone && c.phone.includes(searchQuery)) ||
      (c.address && matchesSearch(c.address, searchQuery));
    const matchesDebt = filterOnlyDebt ? c.debt > 0 : true;
    return matchesQuery && matchesDebt;
  });

  const totalOutstandingDebt = customers.reduce((sum, c) => sum + (c.debt || 0), 0);
  const totalDebtorCount = customers.filter(c => c.debt > 0).length;

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên khách hàng!');
      return;
    }
    addCustomer({
      name: formName.trim(),
      phone: formPhone.trim(),
      address: formAddress.trim(),
    });
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setIsAddCustomerOpen(false);
  };

  const openPayDebtModal = (customer: Customer) => {
    setPayingCustomer(customer);
    setPayAmount(customer.debt);
    setPayMethod('cash');
    setPayNote('');
  };

  const handleConfirmPayDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCustomer) return;
    if (payAmount <= 0) {
      alert('Số tiền thanh toán phải lớn hơn 0!');
      return;
    }
    if (payAmount > payingCustomer.debt) {
      if (!window.confirm('Số tiền trả lớn hơn số dư nợ hiện tại. Bạn có muốn tất toán toàn bộ khoản nợ này?')) {
        return;
      }
    }

    payDebt(
      payingCustomer.id,
      Math.min(payAmount, payingCustomer.debt),
      payMethod,
      payNote.trim() || undefined
    );
    setPayingCustomer(null);
  };

  // History for selected customer
  const customerOrders = selectedCustomerForDetail
    ? orders.filter(o => o.customerId === selectedCustomerForDetail.id)
    : [];

  const customerDebtHistory = selectedCustomerForDetail
    ? debtPayments.filter(p => p.customerId === selectedCustomerForDetail.id)
    : [];

  return (
    <div className="space-y-4">
      {/* Top Header & Debt Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Quản lý Khách hàng & Công nợ
                </h2>
                <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                  {customers.length} khách
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Theo dõi lịch sử mua hàng, ghi nợ đơn và sổ thu nợ lũy kế
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => exportCustomersToExcel(customers)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                title="Xuất danh sách công nợ ra Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              <button
                onClick={() => setIsAddCustomerOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-sm shadow-amber-500/20 transition flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm khách</span>
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => setFilterOnlyDebt(!filterOnlyDebt)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                filterOnlyDebt
                  ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Chỉ xem khách đang nợ ({totalDebtorCount})</span>
            </button>
          </div>
        </div>

        {/* Big Outstanding Debt Card */}
        <div className="bg-gradient-to-br from-rose-500 to-rose-600 text-white p-4 rounded-2xl shadow-md shadow-rose-500/15 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-rose-100 uppercase tracking-wider block">
              Tổng công nợ phải thu
            </span>
            <span className="text-2xl font-black mt-1 block">
              {formatVND(totalOutstandingDebt)}
            </span>
          </div>
          <p className="text-[11px] text-rose-100/90 mt-2">
            Từ {totalDebtorCount} khách hàng chưa thanh toán đủ
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="🔍 Tìm nhanh khách hàng theo Tên, Số điện thoại hoặc Địa chỉ..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-3.5">Khách hàng</th>
                <th className="py-3 px-3">Điện thoại</th>
                <th className="py-3 px-3">Địa chỉ</th>
                <th className="py-3 px-3 text-center">Số đơn</th>
                <th className="py-3 px-3 text-right">Tổng chi tiêu</th>
                <th className="py-3 px-3 text-right">Dư nợ hiện tại</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy khách hàng nào
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(cust => (
                  <tr key={cust.id} className="hover:bg-amber-50/30 transition">
                    <td className="py-2.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-600 font-extrabold flex items-center justify-center text-xs shrink-0">
                          {cust.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong className="text-slate-900 block">{cust.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{cust.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 font-mono">
                      {cust.phone || <span className="text-slate-300 italic">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 max-w-xs truncate">
                      {cust.address || <span className="text-slate-300 italic">-</span>}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                      {cust.orderCount || 0}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                      {formatVND(cust.totalSpent || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {cust.debt > 0 ? (
                        <span className="text-rose-600 font-black text-xs">
                          {formatVND(cust.debt)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-bold text-[11px]">
                          0đ (Đã đủ)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedCustomerForDetail(cust)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition"
                          title="Xem sổ nợ & lịch sử"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {cust.debt > 0 && (
                          <button
                            onClick={() => openPayDebtModal(cust)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-2xs transition flex items-center gap-1"
                          >
                            <ArrowDownCircle className="w-3 h-3" />
                            <span>Thu nợ</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CUSTOMER DETAILS & DEBT LEDGER */}
      {selectedCustomerForDetail && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold">
                  {selectedCustomerForDetail.name.slice(0, 1)}
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    {selectedCustomerForDetail.name}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {selectedCustomerForDetail.id} • {selectedCustomerForDetail.phone || 'Chưa có SĐT'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerForDetail(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Dư nợ hiện tại:</span>
                <span className="text-lg font-black text-rose-600 block">
                  {formatVND(selectedCustomerForDetail.debt)}
                </span>
              </div>
              {selectedCustomerForDetail.debt > 0 && (
                <button
                  onClick={() => {
                    const cust = selectedCustomerForDetail;
                    setSelectedCustomerForDetail(null);
                    openPayDebtModal(cust);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
                >
                  <ArrowDownCircle className="w-3.5 h-3.5" />
                  <span>Thu tiền nợ ngay</span>
                </button>
              )}
            </div>

            {/* Scrollable Tabs / Lists */}
            <div className="flex-1 overflow-y-auto custom-scroll pt-3 space-y-4 text-xs">
              {/* Debt Payments History */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Lịch sử các lần khách trả nợ ({customerDebtHistory.length})</span>
                </h4>
                {customerDebtHistory.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">Chưa có phiếu thu nợ nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {customerDebtHistory.map(p => (
                      <div key={p.id} className="p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/70 flex justify-between items-center text-[11px]">
                        <div>
                          <strong className="text-emerald-900 block">{p.id} • {formatDate(p.createdAt)}</strong>
                          <span className="text-slate-500">{p.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'} {p.note ? `• ${p.note}` : ''}</span>
                        </div>
                        <span className="font-black text-emerald-700 text-xs">+{formatVND(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Orders History */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Receipt className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lịch sử đơn hàng ({customerOrders.length})</span>
                </h4>
                {customerOrders.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px]">Chưa có đơn hàng nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {customerOrders.map(o => (
                      <div key={o.id} className="p-2 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center text-[11px]">
                        <div>
                          <strong className="text-slate-900 block">#{o.id} • {formatDate(o.createdAt)}</strong>
                          <span className="text-slate-500">{o.items.length} món • {o.orderType === 'direct' ? 'Tại chỗ' : 'Giao hàng'}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{formatVND(o.total)}</span>
                          {o.debtAmount > 0 && (
                            <span className="text-rose-600 font-extrabold text-[10px]">Nợ: {formatVND(o.debtAmount)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedCustomerForDetail(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAY DEBT (THU NỢ) */}
      {payingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                <span>Thu tiền nợ khách hàng</span>
              </h3>
              <button
                onClick={() => setPayingCustomer(null)}
                className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayDebt} className="space-y-3 pt-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Khách hàng:</span>
                  <strong className="text-slate-900">{payingCustomer.name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Dư nợ hiện tại:</span>
                  <span className="font-black text-rose-600">{formatVND(payingCustomer.debt)}</span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Số tiền khách trả (đ) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1000"
                  step="1000"
                  max={payingCustomer.debt}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value) || 0)}
                  placeholder="250000"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-emerald-700 text-right focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700">Hình thức thu:</span>
                <div className="grid grid-cols-2 bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`px-3 py-1 rounded transition ${payMethod === 'cash' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Tiền mặt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('transfer')}
                    className={`px-3 py-1 rounded transition ${payMethod === 'transfer' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'}`}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú (tùy chọn)</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Khách chuyển khoản qua MB..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition"
                >
                  Xác nhận thu nợ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Thêm khách hàng mới</span>
              </h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên khách hàng <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ví dụ: Chị Nga, Anh Minh..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                  autoFocus
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Số điện thoại</label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="0912xxxxxx"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Địa chỉ nhận hàng</label>
                <textarea
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="Số nhà, phố, phường, quận..."
                  rows={2}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20"
                >
                  Lưu khách hàng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
