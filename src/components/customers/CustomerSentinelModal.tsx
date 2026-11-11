import React, { useState } from 'react';
import { Customer, Order } from '../../types';
import {
  CustomerAnomalyAuditResult,
  ToneTwinGroup,
  MultiPhoneAnomaly,
  MultiAddressAnomaly,
  DuplicatePhoneGroup,
} from '../../utils/customerSentinel';
import { formatVND, formatDate } from '../../utils/format';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Phone,
  MapPin,
  Receipt,
  Edit2,
  Sparkles,
  History,
  CheckCircle2,
  GitFork,
  Merge,
  ArrowRight,
} from 'lucide-react';

interface CustomerSentinelModalProps {
  isOpen: boolean;
  onClose: () => void;
  auditResult: CustomerAnomalyAuditResult;
  customers: Customer[];
  orders: Order[];
  onRepairAll: () => { changesCount: number; log: string[] };
  onSplitCustomer: (customerId: string, type: 'phone' | 'address') => void;
  onMergeCustomers: (primaryId: string, duplicateId: string) => void;
  onEditCustomer: (customer: Customer) => void;
}

export const CustomerSentinelModal: React.FC<CustomerSentinelModalProps> = ({
  isOpen,
  onClose,
  auditResult,
  customers,
  orders,
  onRepairAll,
  onSplitCustomer,
  onMergeCustomers,
  onEditCustomer,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'tone' | 'phone' | 'address' | 'duplicate'>('all');
  const [repairSuccessLog, setRepairSuccessLog] = useState<string[] | null>(null);
  const [acknowledgedToneTwins, setAcknowledgedToneTwins] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  const handleRunAutoRepair = () => {
    const res = onRepairAll();
    if (res.changesCount > 0) {
      setRepairSuccessLog(res.log);
    } else {
      alert('Tất cả các lỗi đã được sửa hoặc dữ liệu danh bạ đã đạt chuẩn!');
    }
  };

  const getCustomerOrders = (customerId: string): Order[] => {
    return orders
      .filter(o => o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  };

  const visibleToneTwins = auditResult.toneTwins.filter(
    group => !acknowledgedToneTwins.has(group.toneCleanName)
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
              <ShieldAlert className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Trung tâm Kiểm soát & Sửa bất thường Danh bạ</h2>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-bold">
                  {auditResult.totalAnomalies} cảnh báo
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Phát hiện trùng tên khác dấu, gộp SĐT/Địa chỉ và trùng lặp khách hàng
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition shrink-0"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Auto-Heal Banner */}
        <div className="bg-amber-50 px-4 py-3 border-b border-amber-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-amber-900 leading-snug">
            <span className="font-bold">💡 Tự động khôi phục & tách dữ liệu:</span> Phục hồi sạch sẽ "Thanh Hang" vs "Thanh Hằng", tách số điện thoại 20 chữ số và chuẩn hóa tên gộp chỉ với 1 cú click!
          </div>
          <button
            onClick={handleRunAutoRepair}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Tự động sửa toàn bộ lỗi</span>
          </button>
        </div>

        {/* Repair Success Notification */}
        {repairSuccessLog && (
          <div className="bg-emerald-50 px-4 py-3 border-b border-emerald-200 text-xs text-emerald-900 flex items-start justify-between gap-2 shrink-0">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Đã tự động sửa thành công {repairSuccessLog.length} điểm bất thường:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-700 pl-1">
                {repairSuccessLog.map((logMsg, i) => (
                  <li key={i}>{logMsg}</li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setRepairSuccessLog(null)}
              className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-2 border-b border-slate-200 overflow-x-auto shrink-0 bg-slate-50 text-xs font-bold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({auditResult.totalAnomalies})
          </button>
          <button
            onClick={() => setActiveTab('tone')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'tone'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Trùng tên khác dấu ({visibleToneTwins.length})
          </button>
          <button
            onClick={() => setActiveTab('phone')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'phone'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Gộp nhiều SĐT ({auditResult.multiPhoneAnomalies.length})
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'address'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Gộp nhiều địa chỉ ({auditResult.multiAddressAnomalies.length})
          </button>
          <button
            onClick={() => setActiveTab('duplicate')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'duplicate'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Trùng số điện thoại ({auditResult.duplicatePhoneGroups.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {auditResult.totalAnomalies === 0 && (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="font-bold text-slate-700 text-base">Tuyệt vời! Danh bạ khách hàng hoàn toàn chuẩn xác.</div>
              <p className="text-xs text-slate-400">Không phát hiện tên trùng khác dấu, gộp SĐT hoặc địa chỉ sai lệch.</p>
            </div>
          )}

          {/* 1. TONE TWINS SECTION */}
          {(activeTab === 'all' || activeTab === 'tone') && visibleToneTwins.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Trùng tên khác dấu (Tone Twins / Name Collisions)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Phân biệt rạch ròi người khác nhau mang tên gần giống
                </span>
              </div>

              <div className="space-y-3">
                {visibleToneTwins.map(group => (
                  <div
                    key={group.toneCleanName}
                    className="p-3.5 bg-amber-50/50 rounded-2xl border border-amber-200 space-y-3 shadow-2xs"
                  >
                    <div className="flex items-center justify-between border-b border-amber-200/80 pb-2">
                      <div className="text-xs">
                        <span className="text-slate-500">Nhóm tên gốc không dấu: </span>
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                          "{group.toneCleanName}"
                        </span>
                        <span className="ml-2 text-slate-500">({group.customers.length} khách hàng liên quan)</span>
                      </div>
                      <button
                        onClick={() => {
                          setAcknowledgedToneTwins(prev => new Set(prev).add(group.toneCleanName));
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Xác nhận 2 khách độc lập</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.customers.map(c => {
                        const custOrders = getCustomerOrders(c.id);
                        return (
                          <div
                            key={c.id}
                            className="bg-white p-3 rounded-xl border border-slate-200 space-y-2 shadow-2xs flex flex-col justify-between"
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-slate-800 text-sm">{c.name}</span>
                                <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                  #{c.id}
                                </span>
                              </div>

                              <div className="text-xs space-y-1 text-slate-600">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-semibold text-slate-700">{c.phone || 'Chưa có SĐT'}</span>
                                </div>
                                <div className="flex items-start gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                  <span className="truncate text-slate-600" title={c.address}>
                                    {c.address || 'Chưa có địa chỉ'}
                                  </span>
                                </div>
                                {c.debt > 0 && (
                                  <div className="text-rose-600 font-bold text-[11px]">
                                    Nợ hiện tại: {formatVND(c.debt)}
                                  </div>
                                )}
                              </div>

                              {/* Order Snapshot History */}
                              {custOrders.length > 0 && (
                                <div className="pt-1.5 border-t border-slate-100 text-[10px] space-y-1">
                                  <div className="font-bold text-slate-500 flex items-center gap-1">
                                    <History className="w-3 h-3" />
                                    <span>Đơn hàng gần đây & Địa chỉ thực tế:</span>
                                  </div>
                                  <div className="space-y-1">
                                    {custOrders.map(ord => (
                                      <div
                                        key={ord.id}
                                        className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 leading-tight"
                                      >
                                        <div className="flex items-center justify-between font-bold text-slate-700">
                                          <span>#{ord.id}</span>
                                          <span>{formatVND(ord.total)}</span>
                                        </div>
                                        {(ord.customerPhone || ord.customerAddress) && (
                                          <div className="text-slate-500 mt-0.5 truncate">
                                            {ord.customerPhone && <span>SĐT: {ord.customerPhone} • </span>}
                                            {ord.customerAddress && <span>Đ/c: {ord.customerAddress}</span>}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="pt-2 flex justify-end">
                              <button
                                onClick={() => onEditCustomer(c)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>Sửa thông tin</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. MULTI-PHONE SECTION */}
          {(activeTab === 'all' || activeTab === 'phone') && auditResult.multiPhoneAnomalies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <GitFork className="w-4 h-4 text-amber-600" />
                  <span>Khách hàng gộp nhiều SĐT / SĐT bất thường</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Tách thành 2 khách độc lập hoặc chuẩn hóa 1 click
                </span>
              </div>

              <div className="space-y-2.5">
                {auditResult.multiPhoneAnomalies.map(({ customer, phones }) => (
                  <div
                    key={customer.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{customer.name}</span>
                          <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                            #{customer.id}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                          <span className="text-slate-400">SĐT gốc:</span>
                          <span className="font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-bold">
                            {customer.phone}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {phones.length >= 2 && (
                          <button
                            onClick={() => onSplitCustomer(customer.id, 'phone')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                            <span>Tách thành 2 khách hàng</span>
                          </button>
                        )}
                        <button
                          onClick={() => onEditCustomer(customer)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Sửa SĐT</span>
                        </button>
                      </div>
                    </div>

                    {phones.length >= 2 && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs flex flex-wrap items-center gap-3">
                        <span className="font-semibold text-slate-500">Các số điện thoại được tách:</span>
                        {phones.map((p, idx) => (
                          <span
                            key={idx}
                            className="font-mono bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-800 font-bold"
                          >
                            Số {idx + 1}: {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. MULTI-ADDRESS SECTION */}
          {(activeTab === 'all' || activeTab === 'address') && auditResult.multiAddressAnomalies.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-600" />
                  <span>Khách hàng gộp nhiều địa chỉ (Slashed Addresses)</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Tách riêng từng địa chỉ để giao hàng chuẩn xác
                </span>
              </div>

              <div className="space-y-2.5">
                {auditResult.multiAddressAnomalies.map(({ customer, addresses }) => (
                  <div
                    key={customer.id}
                    className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-sm">{customer.name}</span>
                          <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                            #{customer.id}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 mt-1">
                          <span className="text-slate-400">Địa chỉ gốc: </span>
                          <span className="font-medium text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {customer.address}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {addresses.length >= 2 && (
                          <button
                            onClick={() => onSplitCustomer(customer.id, 'address')}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                          >
                            <GitFork className="w-3.5 h-3.5" />
                            <span>Tách theo từng địa chỉ</span>
                          </button>
                        )}
                        <button
                          onClick={() => onEditCustomer(customer)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          <span>Sửa địa chỉ</span>
                        </button>
                      </div>
                    </div>

                    {addresses.length >= 2 && (
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs space-y-1">
                        <span className="font-semibold text-slate-500 block">Các địa chỉ nhận diện:</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {addresses.map((addr, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-2 rounded-lg border border-slate-200 text-slate-800 truncate"
                              title={addr}
                            >
                              <span className="font-bold text-slate-500 mr-1">Đ/c {idx + 1}:</span>
                              <span>{addr}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. DUPLICATE PHONE SECTION */}
          {(activeTab === 'all' || activeTab === 'duplicate') && auditResult.duplicatePhoneGroups.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                  <Merge className="w-4 h-4 text-amber-600" />
                  <span>Trùng số điện thoại giữa các khách hàng khác nhau</span>
                </h3>
                <span className="text-[11px] text-slate-400">
                  Gộp thành 1 hồ sơ duy nhất hoặc sửa SĐT
                </span>
              </div>

              <div className="space-y-2.5">
                {auditResult.duplicatePhoneGroups.map(group => {
                  const [primary, ...duplicates] = group.customers;
                  return (
                    <div
                      key={group.normalizedPhone}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs">
                          <span className="text-slate-500">Số điện thoại trùng: </span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {group.normalizedPhone}
                          </span>
                        </div>
                        {duplicates.length > 0 && (
                          <button
                            onClick={() => onMergeCustomers(primary.id, duplicates[0].id)}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                          >
                            <Merge className="w-3.5 h-3.5" />
                            <span>Gộp 2 khách này làm một</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {group.customers.map((c, idx) => (
                          <div
                            key={c.id}
                            className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                              idx === 0
                                ? 'bg-amber-50/60 border-amber-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="font-bold text-slate-800">
                                {c.name} {idx === 0 && <span className="text-[10px] text-amber-600">(Chính)</span>}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate" title={c.address}>
                                {c.address || 'Chưa có địa chỉ'}
                              </div>
                              {c.debt > 0 && (
                                <div className="text-rose-600 font-bold text-[10px]">
                                  Nợ: {formatVND(c.debt)}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => onEditCustomer(c)}
                              className="p-1 text-slate-400 hover:text-amber-600 transition shrink-0"
                              title="Sửa thông tin"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Hệ thống Sentinel tự động giám sát danh bạ và cảnh báo ngay tại quầy POS.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
