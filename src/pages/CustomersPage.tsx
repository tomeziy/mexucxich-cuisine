import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Customer } from '../types';
import { formatVND, formatDate } from '../utils/format';
import { matchesSearch, removeVietnameseTones } from '../utils/vietnamese';
import {
  Users,
  DollarSign,
  Search,
  Plus,
  ArrowDownCircle,
  Eye,
  Edit2,
  Phone,
  MapPin,
  X,
  History,
  AlertCircle,
  CheckCircle2,
  Receipt,
  UserCheck,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
  AlertTriangle,
} from 'lucide-react';
import {
  exportCustomersToExcel,
  downloadCustomerTemplate,
  parseCustomersExcel,
  ParsedCustomerRow,
} from '../utils/excel';

export interface CustomerImportRowItem {
  id: string;
  name: string;
  phone: string;
  address: string;
  debt: number;
  isDuplicate: boolean;
  existingCustomer?: Customer;
  action: 'accumulate' | 'overwrite' | 'skip';
}

export const CustomersPage: React.FC = () => {
  const { customers, orders, debtPayments, addCustomer, addCustomersBatch, updateCustomer, payDebt } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterOnlyDebt, setFilterOnlyDebt] = useState(false);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<Customer | null>(null);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);

  // Edit Customer Modal State
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');

  // Excel Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<CustomerImportRowItem[]>([]);
  const [importFileName, setImportFileName] = useState('');

  // Row Inline Edit State in Import Preview
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowEditName, setRowEditName] = useState('');
  const [rowEditPhone, setRowEditPhone] = useState('');
  const [rowEditAddress, setRowEditAddress] = useState('');
  const [rowEditDebt, setRowEditDebt] = useState<number>(0);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportFileName(file.name);
      const parsed = await parseCustomersExcel(file);
      e.target.value = ''; // Reset file input so re-uploading the same file triggers onChange
      if (parsed.length === 0) {
        alert('Không tìm thấy dòng khách hàng hợp lệ nào trong file Excel!');
        return;
      }

      const mapped: CustomerImportRowItem[] = parsed.map((p, idx) => {
        const matchByPhone = p.phone ? customers.find(c => c.phone && c.phone === p.phone) : null;
        const matchByName = !matchByPhone ? customers.find(c => removeVietnameseTones(c.name) === removeVietnameseTones(p.name)) : null;
        const existing = matchByPhone || matchByName;
        return {
          id: `cust_row_${Date.now()}_${idx}`,
          name: p.name,
          phone: p.phone,
          address: p.address,
          debt: p.debt,
          isDuplicate: !!existing,
          existingCustomer: existing || undefined,
          action: 'accumulate',
        };
      });

      setImportRows(mapped);
      setIsImportModalOpen(true);
    } catch (err) {
      e.target.value = '';
      alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file!');
    }
  };

  const handleApplyAllAccumulate = () => {
    setImportRows(prev => prev.map(r => (r.isDuplicate ? { ...r, action: 'accumulate' } : r)));
  };

  const handleSkipAllDuplicates = () => {
    setImportRows(prev => prev.map(r => (r.isDuplicate ? { ...r, action: 'skip' } : r)));
  };

  const startEditRow = (row: CustomerImportRowItem) => {
    setEditingRowId(row.id);
    setRowEditName(row.name);
    setRowEditPhone(row.phone);
    setRowEditAddress(row.address);
    setRowEditDebt(row.debt);
  };

  const saveEditRow = (rowId: string) => {
    setImportRows(prev =>
      prev.map(r => {
        if (r.id === rowId) {
          const newName = rowEditName.trim() || r.name;
          const newPhone = rowEditPhone.trim();
          // Re-evaluate duplication with modified phone / name
          const matchByPhone = newPhone ? customers.find(c => c.phone && c.phone === newPhone) : null;
          const matchByName = !matchByPhone ? customers.find(c => removeVietnameseTones(c.name) === removeVietnameseTones(newName)) : null;
          const existing = matchByPhone || matchByName;
          return {
            ...r,
            name: newName,
            phone: newPhone,
            address: rowEditAddress.trim(),
            debt: Math.max(0, rowEditDebt || 0),
            isDuplicate: !!existing,
            existingCustomer: existing || undefined,
          };
        }
        return r;
      })
    );
    setEditingRowId(null);
  };

  const handleConfirmImport = () => {
    if (importRows.length === 0) return;

    let updatedCount = 0;
    let newCount = 0;
    let skippedCount = 0;
    const newCustomersToAdd: Array<Omit<Customer, 'id' | 'totalSpent' | 'orderCount'>> = [];

    importRows.forEach(row => {
      if (row.isDuplicate && row.existingCustomer) {
        if (row.action === 'skip') {
          skippedCount++;
        } else if (row.action === 'overwrite') {
          updateCustomer(row.existingCustomer.id, {
            name: row.name,
            phone: row.phone,
            address: row.address || row.existingCustomer.address,
            debt: row.debt,
          });
          updatedCount++;
        } else {
          // 'accumulate'
          updateCustomer(row.existingCustomer.id, {
            address: row.address || row.existingCustomer.address,
            debt: row.existingCustomer.debt + row.debt,
          });
          updatedCount++;
        }
      } else {
        newCustomersToAdd.push({
          name: row.name,
          phone: row.phone,
          address: row.address,
          debt: row.debt,
        });
        newCount++;
      }
    });

    if (newCustomersToAdd.length > 0) {
      addCustomersBatch(newCustomersToAdd);
    }

    alert(
      `Đã xử lý xong ${importRows.length} khách hàng:\n- Thêm mới: ${newCount} khách\n- Cập nhật nợ: ${updatedCount} khách\n- Bỏ qua: ${skippedCount} khách`
    );
    setIsImportModalOpen(false);
    setImportRows([]);
  };

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

  const openEditModal = (cust: Customer) => {
    setEditingCustomer(cust);
    setEditCustomerName(cust.name);
    setEditCustomerPhone(cust.phone || '');
    setEditCustomerAddress(cust.address || '');
  };

  const handleSaveEditCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editCustomerName.trim()) {
      alert('Vui lòng nhập tên khách hàng!');
      return;
    }
    updateCustomer(editingCustomer.id, {
      name: editCustomerName.trim(),
      phone: editCustomerPhone.trim(),
      address: editCustomerAddress.trim(),
    });
    setEditingCustomer(null);
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
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportCustomersToExcel(customers)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                title="Xuất danh sách công nợ ra Excel (.xlsx)"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Xuất Excel</span>
              </button>

              <label className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Nhập Excel</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
              </label>

              <button
                onClick={downloadCustomerTemplate}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                title="Tải file mẫu Excel danh bạ khách hàng (.xlsx)"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" />
                <span>Tải file mẫu</span>
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
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                filterOnlyDebt
                  ? 'bg-rose-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Chỉ hiện khách đang nợ ({totalDebtorCount})</span>
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

                        <button
                          onClick={() => openEditModal(cust)}
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition"
                          title="Chỉnh sửa thông tin khách hàng"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* MODAL: EDIT CUSTOMER */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-500" />
                <span>Chỉnh sửa thông tin khách hàng</span>
              </h3>
              <button
                onClick={() => setEditingCustomer(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3.5 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên khách hàng (*)
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={e => setEditCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={editCustomerPhone}
                  onChange={e => setEditCustomerPhone(e.target.value)}
                  placeholder="0904047976"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Địa chỉ giao hàng
                </label>
                <textarea
                  rows={2}
                  value={editCustomerAddress}
                  onChange={e => setEditCustomerAddress(e.target.value)}
                  placeholder="Số nhà, ngõ, tên đường, quận huyện..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-100 text-center">
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">Đã mua</span>
                <strong className="text-xs text-slate-800 font-extrabold">
                  {selectedCustomerForDetail.orderCount || 0} đơn
                </strong>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">Tổng chi tiêu</span>
                <strong className="text-xs text-slate-800 font-extrabold">
                  {formatVND(selectedCustomerForDetail.totalSpent || 0)}
                </strong>
              </div>
              <div className="bg-rose-50 p-2 rounded-xl border border-rose-100">
                <span className="text-[10px] text-rose-500 block font-bold">Dư nợ hiện tại</span>
                <strong className="text-xs text-rose-600 font-black">
                  {formatVND(selectedCustomerForDetail.debt)}
                </strong>
              </div>
            </div>

            {/* Address */}
            {selectedCustomerForDetail.address && (
              <div className="py-2.5 border-b border-slate-100 text-xs flex items-start gap-1.5 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>{selectedCustomerForDetail.address}</span>
              </div>
            )}

            {/* History Tabs (Orders vs Debt Payments) */}
            <div className="flex-1 overflow-y-auto custom-scroll py-3 space-y-3">
              <div>
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-slate-400" />
                  <span>Lịch sử các lần trả nợ ({customerDebtHistory.length})</span>
                </h4>
                {customerDebtHistory.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Chưa có bản ghi thu nợ nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {customerDebtHistory.map(p => (
                      <div
                        key={p.id}
                        className="p-2 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-emerald-800">
                            +{formatVND(p.amount)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-2">
                            ({p.paymentMethod === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'})
                          </span>
                          {p.note && <p className="text-[10px] text-slate-500 italic mt-0.5">{p.note}</p>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDate(p.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-slate-400" />
                  <span>Các đơn hàng gần đây ({customerOrders.length})</span>
                </h4>
                {customerOrders.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">Khách hàng chưa có đơn hàng nào</p>
                ) : (
                  <div className="space-y-1.5">
                    {customerOrders.slice(0, 5).map(o => (
                      <div
                        key={o.id}
                        className="p-2 rounded-xl bg-slate-50 border border-slate-150 text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-800">#{o.id}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDate(o.createdAt)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                            {o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 block">{formatVND(o.total)}</span>
                          {o.debtAmount > 0 && (
                            <span className="text-[10px] font-bold text-rose-600 block">
                              Nợ: {formatVND(o.debtAmount)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-mono">MXC CRM</span>
              <button
                onClick={() => setSelectedCustomerForDetail(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PAY DEBT */}
      {payingCustomer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                <span>Thu nợ khách hàng</span>
              </h3>
              <button
                onClick={() => setPayingCustomer(null)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayDebt} className="space-y-3.5 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Khách hàng</label>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{payingCustomer.name}</span>
                  <span className="text-xs font-black text-rose-600">
                    Đang nợ: {formatVND(payingCustomer.debt)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Số tiền thu (VNĐ) (*)
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  max={payingCustomer.debt}
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value) || 0)}
                  placeholder="200000"
                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Hình thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setPayMethod('cash')}
                    className={`py-2 rounded-xl border transition ${
                      payMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tiền mặt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayMethod('transfer')}
                    className={`py-2 rounded-xl border transition ${
                      payMethod === 'transfer'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ghi chú thu nợ</label>
                <input
                  type="text"
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="Khách trả tiền mặt tại quầy..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayingCustomer(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận thu nợ</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD CUSTOMER */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-amber-500" />
                <span>Thêm khách hàng mới</span>
              </h3>
              <button
                onClick={() => setIsAddCustomerOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} className="space-y-3.5 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên khách hàng (*)
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Chị Lan (Zalo Đội Cấn)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={formPhone}
                  onChange={e => setFormPhone(e.target.value)}
                  placeholder="0988123456"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Địa chỉ giao hàng
                </label>
                <textarea
                  rows={2}
                  value={formAddress}
                  onChange={e => setFormAddress(e.target.value)}
                  placeholder="12 Đội Cấn, Ba Đình, Hà Nội"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
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

      {/* MODAL: INTERACTIVE DUPLICATE RESOLUTION (EXCEL IMPORT) */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Xem trước & Xử lý Trùng lặp Khách hàng từ Excel
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Tệp: <strong>{importFileName}</strong> • Tìm thấy <strong>{importRows.length}</strong> khách hàng
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setEditingRowId(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Badges & Bulk Action Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 pb-2 shrink-0">
              <div className="flex items-center gap-2 text-[11px] font-bold">
                {(() => {
                  const duplicateCount = importRows.filter(r => r.isDuplicate).length;
                  const newCount = importRows.length - duplicateCount;
                  return (
                    <>
                      <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        ✨ {newCount} khách mới
                      </span>
                      {duplicateCount > 0 ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{duplicateCount} khách trùng lặp (SĐT / Tên)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                          Không có khách trùng
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Bulk Resolution Buttons */}
              {importRows.some(r => r.isDuplicate) && (
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-[11px] text-slate-500 mr-1">Thao tác nhanh cho món trùng:</span>
                  <button
                    type="button"
                    onClick={handleApplyAllAccumulate}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition text-[11px]"
                  >
                    Đồng ý tất cả (Cộng dồn)
                  </button>
                  <button
                    type="button"
                    onClick={handleSkipAllDuplicates}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 transition text-[11px]"
                  >
                    Bỏ qua tất cả trùng
                  </button>
                </div>
              )}
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto custom-scroll my-2 border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold sticky top-0 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Khách hàng từ File</th>
                    <th className="py-2.5 px-3">Điện thoại</th>
                    <th className="py-2.5 px-3">Địa chỉ</th>
                    <th className="py-2.5 px-3 text-right">Nợ trong File</th>
                    <th className="py-2.5 px-3">Trạng thái hệ thống</th>
                    <th className="py-2.5 px-3 text-center">Lựa chọn xử lý</th>
                    <th className="py-2.5 px-2 text-center">Sửa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {importRows.map((row, idx) => {
                    const isEditing = editingRowId === row.id;

                    if (isEditing) {
                      return (
                        <tr key={row.id} className="bg-amber-50/60">
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={rowEditName}
                              onChange={e => setRowEditName(e.target.value)}
                              className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs font-bold"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={rowEditPhone}
                              onChange={e => setRowEditPhone(e.target.value)}
                              placeholder="09..."
                              className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs font-mono"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={rowEditAddress}
                              onChange={e => setRowEditAddress(e.target.value)}
                              className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs"
                            />
                          </td>
                          <td className="py-2 px-2 text-right">
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={rowEditDebt}
                              onChange={e => setRowEditDebt(Number(e.target.value) || 0)}
                              className="w-24 bg-white border border-amber-300 rounded px-2 py-1 text-xs text-right font-bold text-rose-600"
                            />
                          </td>
                          <td colSpan={2} className="py-2 px-2 text-center">
                            <span className="text-[11px] text-amber-700 italic">Đang sửa trực tiếp dòng này</span>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => saveEditRow(row.id)}
                                className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px]"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setEditingRowId(null)}
                                className="px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[10px]"
                              >
                                Hủy
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={row.id} className={`hover:bg-slate-50 transition ${row.isDuplicate ? 'bg-amber-50/20' : ''}`}>
                        <td className="py-2.5 px-3">
                          <strong className="text-slate-900 block">{row.name}</strong>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-600">
                          {row.phone || <span className="text-slate-300 italic">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 max-w-[140px] truncate" title={row.address}>
                          {row.address || <span className="text-slate-300 italic">-</span>}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-rose-600">
                          {row.debt > 0 ? formatVND(row.debt) : '0đ'}
                        </td>
                        <td className="py-2.5 px-3">
                          {row.isDuplicate && row.existingCustomer ? (
                            <div className="space-y-0.5">
                              <span className="text-[10px] font-bold text-amber-800 block">
                                Trùng: {row.existingCustomer.name} ({row.existingCustomer.phone || row.existingCustomer.id})
                              </span>
                              <span className="text-[10px] text-slate-500 block">
                                Nợ cũ: <strong className="text-slate-800">{formatVND(row.existingCustomer.debt)}</strong>
                              </span>
                              {row.action === 'accumulate' && row.debt > 0 && (
                                <span className="text-[10px] font-bold text-emerald-700 block">
                                  → Tổng nợ mới: {formatVND(row.existingCustomer.debt + row.debt)}
                                </span>
                              )}
                              {row.action === 'overwrite' && (
                                <span className="text-[10px] font-bold text-rose-600 block">
                                  → Ghi đè nợ: {formatVND(row.debt)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-block">
                              Khách mới
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {row.isDuplicate ? (
                            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
                              <button
                                type="button"
                                onClick={() =>
                                  setImportRows(prev =>
                                    prev.map(r => (r.id === row.id ? { ...r, action: 'accumulate' } : r))
                                  )
                                }
                                className={`px-2 py-1 rounded transition ${
                                  row.action === 'accumulate'
                                    ? 'bg-amber-500 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Cộng dồn số nợ trong file vào nợ hiện tại của khách"
                              >
                                Cộng dồn
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setImportRows(prev =>
                                    prev.map(r => (r.id === row.id ? { ...r, action: 'overwrite' } : r))
                                  )
                                }
                                className={`px-2 py-1 rounded transition ${
                                  row.action === 'overwrite'
                                    ? 'bg-rose-500 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Ghi đè số nợ cũ bằng số nợ trong file"
                              >
                                Ghi đè
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setImportRows(prev =>
                                    prev.map(r => (r.id === row.id ? { ...r, action: 'skip' } : r))
                                  )
                                }
                                className={`px-2 py-1 rounded transition ${
                                  row.action === 'skip'
                                    ? 'bg-slate-600 text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                                title="Bỏ qua dòng này, không cập nhật khách cũ"
                              >
                                Bỏ qua
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-emerald-700">Tạo mới</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => startEditRow(row)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:text-amber-600 text-slate-500 transition"
                            title="Sửa nhanh thông tin dòng trước khi nhập"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0 text-xs font-bold">
              <span className="text-[11px] text-slate-500">
                Sẽ xử lý <strong>{importRows.length}</strong> khách hàng vào hệ thống
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận nhập danh bạ</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
