import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Order } from '../types';
import { formatVND, formatDate } from '../utils/format';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import {
  BarChart3,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Filter,
  Calendar,
  DollarSign,
  Package,
  FileSpreadsheet,
} from 'lucide-react';
import { exportOrdersToExcel } from '../utils/excel';

export const ReportsPage: React.FC = () => {
  const { orders, receiptSettings } = useStore();

  const [dateFilter, setDateFilter] = useState<'today' | '7days' | 'month' | 'all'>('today');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Modal for reprint
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Helper date filtering
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOf7Days = startOfToday - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const filteredOrders = orders.filter(o => {
    const orderTime = new Date(o.createdAt).getTime();

    let matchesDate = true;
    if (dateFilter === 'today') {
      matchesDate = orderTime >= startOfToday;
    } else if (dateFilter === '7days') {
      matchesDate = orderTime >= startOf7Days;
    } else if (dateFilter === 'month') {
      matchesDate = orderTime >= startOfMonth;
    }

    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesType = typeFilter === 'all' || o.orderType === typeFilter;

    return matchesDate && matchesStatus && matchesType;
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
    const orderCost = o.items.reduce((iSum, item) => iSum + (item.cost || 0) * item.qty, 0);
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

        <button
          onClick={() => exportOrdersToExcel(filteredOrders)}
          className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shrink-0"
          title="Xuất báo cáo danh sách đơn ra Excel (.xlsx)"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Xuất báo cáo Excel</span>
        </button>
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

      {/* Filter Row */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs font-medium">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-bold text-slate-700">Lọc theo:</span>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
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
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">Mọi hình thức bán</option>
            <option value="direct">Bán tại chỗ</option>
            <option value="delivery">Đơn giao hàng</option>
          </select>
        </div>

        <span className="text-slate-400 text-[11px]">
          Hiển thị <strong>{filteredOrders.length}</strong> đơn hàng
        </span>
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
                <th className="py-3 px-3 text-center">In lại</th>
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
                        {order.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
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
      />
    </div>
  );
};
