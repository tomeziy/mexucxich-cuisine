import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';
import { formatVND, formatDate, formatDisplayQty } from '../utils/format';
import { matchesSearch } from '../utils/vietnamese';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { EditOrderModal } from '../components/pos/EditOrderModal';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Trash2,
  Filter,
  Calendar,
  DollarSign,
  Package,
  FileSpreadsheet,
  Upload,
  Search,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { exportOrdersToExcel, parseOrdersExcel } from '../utils/excel';
import { analyzeOrderImportRows, AnalyzedOrderImportRow } from '../utils/importReconciler';

export const ReportsPage: React.FC = () => {
  const { products, orders, receiptSettings, deleteOrder, restoreFromExcelOrders } = useStore();

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // ADR-0024: Order Excel Import Preview & Conflict Analysis Modal state
  const [isOrderImportModalOpen, setIsOrderImportModalOpen] = useState(false);
  const [orderImportRows, setOrderImportRows] = useState<AnalyzedOrderImportRow[]>([]);
  const [orderImportMissingProdsCount, setOrderImportMissingProdsCount] = useState(0);
  const [orderImportFileName, setOrderImportFileName] = useState('');
  const [orderImportTab, setOrderImportTab] = useState<'all' | 'new' | 'conflict' | 'identical'>('all');

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      setOrderImportFileName(file.name);
      const parsedOrders = await parseOrdersExcel(file);
      if (!parsedOrders || parsedOrders.length === 0) {
        alert('Không tìm thấy dữ liệu đơn hàng hợp lệ trong tệp Excel!');
        return;
      }

      const analyzed = analyzeOrderImportRows(parsedOrders, orders, products);
      setOrderImportRows(analyzed.rows);
      setOrderImportMissingProdsCount(analyzed.missingProductsCount);
      const hasConflict = analyzed.rows.some(r => r.diffStatus === 'conflict');
      setOrderImportTab(hasConflict ? 'conflict' : 'all');
      setIsOrderImportModalOpen(true);
    } catch (err: any) {
      alert(`Lỗi khi đọc tệp báo cáo Excel: ${err?.message || err}`);
    } finally {
      setIsImporting(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleConfirmOrderImport = () => {
    if (orderImportRows.length === 0) return;

    const toProcess = orderImportRows.filter(r => r.action !== 'skip').map(r => r.order);
    const overwriteOrderIds = orderImportRows
      .filter(r => r.action === 'overwrite')
      .map(r => r.order.id);
    const skippedCount = orderImportRows.length - toProcess.length;

    if (toProcess.length === 0) {
      alert(`Đã bỏ qua toàn bộ ${skippedCount} đơn trùng hệt — dữ liệu hiện tại được giữ nguyên.`);
      setIsOrderImportModalOpen(false);
      setOrderImportRows([]);
      return;
    }

    const res = restoreFromExcelOrders(toProcess, { overwriteOrderIds });
    alert(
      `Nhập báo cáo đơn hàng thành công!\n` +
        `- Thêm đơn mới: ${res.restoredOrdersCount} đơn\n` +
        `- Ghi đè cập nhật đơn khác biệt: ${res.updatedOrdersCount} đơn\n` +
        `- Bỏ qua (đã giống hệt): ${skippedCount} đơn\n` +
        `- Thực đơn: đã khôi phục ${res.restoredProductsCount} món ăn vào danh mục.`
    );
    setIsOrderImportModalOpen(false);
    setOrderImportRows([]);
  };

  // Modal for reprint
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Modal for editing
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleDeleteOrder = (order: Order) => {
    const isCancelled = order.status === 'cancelled';
    const totalOrderQty = order.items.reduce((sum, i) => sum + i.qty, 0);
    const confirmMsg = isCancelled
      ? `Bạn có chắc chắn muốn xóa vĩnh viễn đơn #${order.id}?`
      : `Bạn có chắc chắn muốn XÓA VĨNH VIỄN đơn #${order.id}?\n\n- Các món ăn trong đơn sẽ được TỰ ĐỘNG HOÀN KHO (+${formatDisplayQty(totalOrderQty)} sản phẩm).\n- Nếu đơn có ghi nợ, số dư nợ của khách ${order.customerName} sẽ được TỰ ĐỘNG KHẤU TRỪ.\n- Doanh thu sẽ được cập nhật lại!`;

    if (window.confirm(confirmMsg)) {
      deleteOrder(order.id);
    }
  };

  // Helper date filtering
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredOrders = orders.filter(o => {
    const orderTime = new Date(o.createdAt).getTime();

    const hasSearch = searchQuery.trim().length > 0;
    let matchesDate = true;
    // ADR-0015 Smart Date Scope: when searching, auto-bypass date filter so user finds orders across entire history
    if (!hasSearch) {
      if (dateFilter === 'today') {
        matchesDate = orderTime >= startOfToday;
      } else if (dateFilter === '7days') {
        matchesDate = orderTime >= startOf7Days;
      } else if (dateFilter === 'month') {
        matchesDate = orderTime >= startOfMonth;
      }
    }

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesType = typeFilter === 'all' || o.orderType === typeFilter;

    if (!matchesDate || !matchesStatus || !matchesType) return false;

    if (!hasSearch) return true;

    const trimmed = searchQuery.trim();
    const numQ = trimmed.replace(/\D/g, '');
    const cleanOrderId = o.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanSearchId = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');

    // 1. Search by Order ID (#HD1234, HD1234, 1234)
    const matchesId =
      cleanOrderId.includes(cleanSearchId) || (numQ.length > 0 && cleanOrderId.includes(numQ));

    // 2. Search by Customer Name (tone-insensitive, token matching)
    const matchesCustomer = matchesSearch(o.customerName || '', trimmed);

    // 3. Search by Customer Phone
    const matchesPhone =
      o.customerPhone && numQ.length > 0 && o.customerPhone.replace(/\D/g, '').includes(numQ);

    // 4. Search by Dishes / Products in order
    const matchesItems = o.items.some(i => matchesSearch(i.name, trimmed));

    return matchesId || matchesCustomer || matchesPhone || matchesItems;
  });

  // Calculate Metrics on filtered valid orders (exclude cancelled)
  const validOrders = filteredOrders.filter(o => o.status !== 'cancelled');

  // Gross revenue
  const totalRevenue = validOrders.reduce((sum, o) => sum + o.total, 0);

  // Shipping fee total
  const totalShippingFee = validOrders.reduce((sum, o) => sum + (o.shippingFee || 0), 0);

  // Net shop revenue (Doanh thu thuần = Tổng tiền - Phí ship thu hộ theo ADR-0003)
  const netRevenue = totalRevenue - totalShippingFee;

  // Cost of goods sold (Tổng giá vốn)
  const totalCost = validOrders.reduce((sum, o) => {
    const orderCost = o.items.reduce((iSum, item) => iSum + Math.round((item.cost || 0) * item.qty), 0);
    return sum + orderCost;
  }, 0);

  // Estimated gross profit (Lợi nhuận ước tính = Doanh thu thuần - Giá vốn)
  const estimatedProfit = Math.max(0, netRevenue - totalCost);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            <span>Báo cáo Kinh doanh & Lịch sử Đơn hàng</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Doanh thu thực tế, phí ship thu hộ và lợi nhuận gộp theo chuẩn ADR-0003
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold shrink-0">
          <button
            onClick={() => setDateFilter('today')}
            className={`px-3 py-1.5 rounded-lg transition ${
              dateFilter === 'today' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Hôm nay
          </button>
          <button
            onClick={() => setDateFilter('7days')}
            className={`px-3 py-1.5 rounded-lg transition ${
              dateFilter === '7days' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            7 ngày qua
          </button>
          <button
            onClick={() => setDateFilter('month')}
            className={`px-3 py-1.5 rounded-lg transition ${
              dateFilter === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tháng này
          </button>
          <button
            onClick={() => setDateFilter('all')}
            className={`px-3 py-1.5 rounded-lg transition ${
              dateFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Tất cả
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
            title="Nhập báo cáo đơn hàng hàng ngày từ Excel để tự động khôi phục đơn và thực đơn món ăn"
          >
            <Upload className="w-4 h-4 text-blue-600" />
            <span>{isImporting ? 'Đang nạp...' : 'Nhập báo cáo Excel'}</span>
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleImportExcel}
              disabled={isImporting}
              className="hidden"
            />
          </label>

          <button
            onClick={() => exportOrdersToExcel(filteredOrders)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0 shadow-xs"
            title="Xuất báo cáo danh sách đơn ra Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Xuất báo cáo Excel</span>
          </button>
        </div>
      </div>

      {/* 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Revenue */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Tổng Doanh Thu</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 block">
              {formatVND(totalRevenue)}
            </span>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
              <span>Thuần: {formatVND(netRevenue)}</span>
              {totalShippingFee > 0 && <span>• Ship: {formatVND(totalShippingFee)}</span>}
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
            <span>Số Lượng Đơn Hàng</span>
            <ShoppingBag className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900 block">
              {validOrders.length} <span className="text-xs font-medium text-slate-400">đơn hoàn thành</span>
            </span>
            <p className="text-[11px] text-slate-500 font-medium mt-1">
              {orders.filter(o => o.status === 'cancelled').length} đơn đã hủy hoàn kho
            </p>
          </div>
        </div>

        {/* Estimated Profit */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-4 rounded-2xl shadow-md shadow-emerald-500/15 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-100 text-xs font-bold">
            <span>Lợi Nhuận Gộp Ước Tính</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="mt-2">
            <span className="text-xl sm:text-2xl font-black block">
              {formatVND(estimatedProfit)}
            </span>
            <p className="text-[11px] text-emerald-100/90 mt-1">
              Doanh thu thuần - Tổng giá vốn sản phẩm
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Search Row (ADR-0015) */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Tìm theo tên khách, SĐT, mã đơn (#HD...)"
              className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Xóa tìm kiếm"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="preparing">Đang chuẩn bị</option>
              <option value="delivering">Đang giao hàng</option>
              <option value="cancelled">Đã hủy</option>
            </select>

            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
            >
              <option value="all">Mọi hình thức</option>
              <option value="direct">Tại chỗ</option>
              <option value="delivery">Giao hàng</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px] shrink-0">
          {searchQuery.trim() && (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
              Toàn bộ thời gian
            </span>
          )}
          <span>
            Hiển thị <strong>{filteredOrders.length}</strong> đơn hàng
          </span>
        </div>
      </div>

      {/* Orders History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-3.5">Mã đơn</th>
                <th className="py-3 px-3">Thời gian</th>
                <th className="py-3 px-3">Khách hàng</th>
                <th className="py-3 px-3">Hình thức</th>
                <th className="py-3 px-3">Món đã mua</th>
                <th className="py-3 px-3 text-right">Tổng tiền</th>
                <th className="py-3 px-3 text-center">Trạng thái</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Chưa có đơn hàng nào trong khoảng thời gian này
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => {
                  const isCancelled = order.status === 'cancelled';
                  return (
                    <tr key={order.id} className={`hover:bg-amber-50/30 transition ${isCancelled ? 'opacity-50 bg-slate-50/50' : ''}`}>
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900">
                        #{order.id}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="py-2.5 px-3">
                        <strong className="text-slate-800 block truncate max-w-[130px]">
                          {order.customerName}
                        </strong>
                        {order.customerPhone && (
                          <span className="text-[10px] text-slate-400 font-mono">{order.customerPhone}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          order.orderType === 'direct' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.orderType === 'direct' ? 'Tại chỗ' : 'Giao hàng'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate text-[11px]">
                        {order.items.map(i => `${i.name} (x${formatDisplayQty(i.qty)})`).join(', ')}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <strong className="text-slate-900 block font-bold">
                          {formatVND(order.total)}
                        </strong>
                        {order.debtAmount > 0 && (
                          <span className="text-rose-600 font-bold text-[10px]">
                            Nợ: {formatVND(order.debtAmount)}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {order.status === 'completed' ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            Hoàn thành
                          </span>
                        ) : order.status === 'delivering' ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Đang giao
                          </span>
                        ) : order.status === 'preparing' ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                            Đang chuẩn bị
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                            Đã hủy
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setSelectedOrder(order);
                              setIsReceiptOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 hover:text-amber-600 transition"
                            title="Xem & In lại hóa đơn"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setEditingOrder(order);
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-600 transition"
                            title="Chỉnh sửa đơn hàng (món, giá, nợ, phí ship)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteOrder(order)}
                            className="p-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                            title="Xóa vĩnh viễn đơn hàng & Hoàn kho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal for Reprinting */}
      <ReceiptModal
        order={selectedOrder}
        settings={receiptSettings}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        onEdit={(ord) => {
          setIsReceiptOpen(false);
          setEditingOrder(ord);
          setIsEditModalOpen(true);
        }}
        onDelete={(ord) => {
          setIsReceiptOpen(false);
          handleDeleteOrder(ord);
        }}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        order={editingOrder}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingOrder(null);
        }}
      />

      {/* Order Excel Import & Conflict Preview Modal (ADR-0024) */}
      {isOrderImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Xem trước & Đối soát Đơn hàng từ Excel
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    Tệp: <strong>{orderImportFileName}</strong> • Tìm thấy <strong>{orderImportRows.length}</strong> đơn hàng
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOrderImportModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {orderImportMissingProdsCount > 0 && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-900 flex items-center gap-2 shrink-0">
                <Package className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Hệ thống phát hiện <strong>{orderImportMissingProdsCount}</strong> món ăn trong báo cáo chưa có trong thực đơn — sẽ tự động khôi phục vào danh mục món khi xác nhận.
                </span>
              </div>
            )}

            {(() => {
              const newRows = orderImportRows.filter(r => r.diffStatus === 'new');
              const conflictRows = orderImportRows.filter(r => r.diffStatus === 'conflict');
              const identicalRows = orderImportRows.filter(r => r.diffStatus === 'identical');
              const visibleRows =
                orderImportTab === 'new'
                  ? newRows
                  : orderImportTab === 'conflict'
                  ? conflictRows
                  : orderImportTab === 'identical'
                  ? identicalRows
                  : orderImportRows;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 pb-2 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setOrderImportTab('all')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          orderImportTab === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả ({orderImportRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderImportTab('new')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          orderImportTab === 'new'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        ✨ Đơn mới ({newRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderImportTab('conflict')}
                        className={`px-2.5 py-1 rounded-full transition flex items-center gap-1 ${
                          orderImportTab === 'conflict'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Đơn khác biệt / Xung đột ({conflictRows.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderImportTab('identical')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          orderImportTab === 'identical'
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Đơn đã có - Tự bỏ qua ({identicalRows.length})
                      </button>
                    </div>

                    {orderImportRows.some(r => r.existingOrder) && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() =>
                            setOrderImportRows(prev =>
                              prev.map(r => ({ ...r, action: r.recommendedAction }))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          Đề xuất thông minh
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOrderImportRows(prev =>
                              prev.map(r => (r.diffStatus === 'conflict' ? { ...r, action: 'overwrite' } : r))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 transition"
                        >
                          Ghi đè tất cả xung đột
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setOrderImportRows(prev =>
                              prev.map(r => (r.existingOrder ? { ...r, action: 'skip' } : r))
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 transition"
                        >
                          Bỏ qua tất cả trùng
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scroll my-2 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold sticky top-0 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Mã đơn</th>
                          <th className="py-2.5 px-3">Khách hàng</th>
                          <th className="py-2.5 px-3 text-right">Tổng tiền File</th>
                          <th className="py-2.5 px-3">So sánh Cũ → Mới</th>
                          <th className="py-2.5 px-3 text-center">Xử lý</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium">
                        {visibleRows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              Không có đơn hàng nào trong nhóm lọc này.
                            </td>
                          </tr>
                        ) : (
                          visibleRows.map(row => (
                            <tr
                              key={row.order.id}
                              className={`hover:bg-slate-50 transition ${
                                row.diffStatus === 'identical'
                                  ? 'opacity-70 bg-slate-50/40'
                                  : row.diffStatus === 'conflict'
                                  ? 'bg-amber-50/20'
                                  : ''
                              }`}
                            >
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                #{row.order.id}
                                <span className="block text-[10px] font-sans font-normal text-slate-400">
                                  {formatDate(row.order.createdAt)}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <strong className="text-slate-800 block">{row.order.customerName}</strong>
                                <span className="text-[10px] text-slate-500">
                                  {(row.order.items || []).length} món
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900 font-mono">
                                {formatVND(row.order.total)}
                              </td>
                              <td className="py-2.5 px-3">
                                {row.diffStatus === 'new' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-block">
                                    Đơn mới chưa có trên hệ thống
                                  </span>
                                ) : row.diffStatus === 'identical' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 inline-block">
                                    Giống hệt đơn hiện có
                                  </span>
                                ) : (
                                  <div className="flex flex-wrap gap-1">
                                    {row.diffs.map(d => {
                                      const fmt = (v: string | number) =>
                                        ['total', 'paidAmount', 'debtAmount'].includes(d.field) &&
                                        typeof v === 'number'
                                          ? formatVND(v)
                                          : String(v);
                                      return (
                                        <span
                                          key={d.field}
                                          className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 text-[10px] font-bold"
                                        >
                                          {d.label}: {fmt(d.oldValue)} → {fmt(d.newValue)}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {row.existingOrder ? (
                                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOrderImportRows(prev =>
                                          prev.map(r =>
                                            r.order.id === row.order.id ? { ...r, action: 'overwrite' } : r
                                          )
                                        )
                                      }
                                      className={`px-2 py-1 rounded transition ${
                                        row.action === 'overwrite'
                                          ? 'bg-rose-500 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      Ghi đè theo File
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setOrderImportRows(prev =>
                                          prev.map(r =>
                                            r.order.id === row.order.id ? { ...r, action: 'skip' } : r
                                          )
                                        )
                                      }
                                      className={`px-2 py-1 rounded transition ${
                                        row.action === 'skip'
                                          ? 'bg-slate-600 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      Bỏ qua
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] font-bold text-emerald-700">Thêm mới</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0 text-xs font-bold">
              <span className="text-[11px] text-slate-500">
                Sẽ thêm/cập nhật{' '}
                <strong>{orderImportRows.filter(r => r.action !== 'skip').length}</strong> /{' '}
                {orderImportRows.length} đơn hàng
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOrderImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOrderImport}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận nhập báo cáo</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
