import React, { useState, useMemo, useEffect } from 'react';
import { Customer, Order } from '../../types';
import {
  CustomerAnomalyAuditResult,
  SentinelAcknowledgments,
  isEmptyGhostCustomer,
  rankPrimaryCustomer,
  analyzeToneTwinGroup,
  analyzeDiscrepancyOrder,
} from '../../utils/customerSentinel';
import { getAllCustomerAddresses } from '../../utils/addressUtils';
import { matchesSearch } from '../../utils/vietnamese';
import { formatVND, formatDate } from '../../utils/format';
import { isPhoneMatching } from '../../utils/excel';
import { analyzeFusedPhone, repairCustomerFusedPhones } from '../../utils/phoneRecovery';
import {
  ShieldAlert,
  AlertTriangle,
  X,
  Phone,
  MapPin,
  Edit2,
  Sparkles,
  History,
  CheckCircle2,
  GitFork,
  Merge,
  Check,
  Trash2,
  Search,
  RotateCcw,
  Star,
  PlusCircle,
  EyeOff,
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
  onMergeCustomerGroup?: (primaryId: string, duplicateIds: string[]) => void;
  onMergeDuplicateGroupsBatch?: (groups: Array<{ primaryId: string; duplicateIds: string[] }>) => number;
  onEditCustomer: (customer: Customer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onDeleteCustomersBatch?: (
    customerIds: string[],
    options?: { onlySafe?: boolean }
  ) => { deletedCount: number; skippedIds: string[] };
  onRestoreFromOrder?: (customerId: string, orderId: string) => void;
  onSplitByHistoricalOrder?: (customerId: string, targetPhone: string) => void;
  onAcceptPhoneSplit?: (customerId: string) => void;
  onAcceptAllPhoneSplits?: (customerIds: string[]) => number;
  onConvertAddressToExtra?: (customerId: string) => void;
  onConvertAddressesBatch?: (customerIds: string[]) => number;
  onAddSecondaryPhone?: (customerId: string, phone: string) => boolean;
  onAddExtraAddress?: (customerId: string, address: string) => boolean;
  onApplyDiscrepancyBatch?: (items: Array<{ customerId: string; orderId: string }>) => {
    updatedCount: number;
    splitCount: number;
  };
  acknowledgedCount?: number;
  onAcknowledgeSentinelItems?: (type: keyof SentinelAcknowledgments, keys: string[]) => void;
  onResetSentinelAcks?: () => void;
}

export const CustomerSentinelModal: React.FC<CustomerSentinelModalProps> = ({
  isOpen,
  onClose,
  auditResult,
  orders,
  onRepairAll,
  onSplitCustomer,
  onMergeCustomers,
  onMergeCustomerGroup,
  onMergeDuplicateGroupsBatch,
  onEditCustomer,
  onDeleteCustomer,
  onDeleteCustomersBatch,
  onRestoreFromOrder,
  onSplitByHistoricalOrder,
  onAcceptPhoneSplit,
  onAcceptAllPhoneSplits,
  onConvertAddressToExtra,
  onConvertAddressesBatch,
  onAddSecondaryPhone,
  onAddExtraAddress,
  onApplyDiscrepancyBatch,
  acknowledgedCount = 0,
  onAcknowledgeSentinelItems,
  onResetSentinelAcks,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'tone' | 'phone' | 'address' | 'duplicate' | 'discrepancy'>('all');
  const [repairSuccessLog, setRepairSuccessLog] = useState<string[] | null>(null);

  // Local fallback acknowledgments if parent did not wire persistent callbacks
  const [localToneAcks, setLocalToneAcks] = useState<Set<string>>(new Set());
  const [localAddressAcks, setLocalAddressAcks] = useState<Set<string>>(new Set());
  const [localDiscrepancyAcks, setLocalDiscrepancyAcks] = useState<Set<string>>(new Set());

  // Tab 1: Tone Twins state
  const [selectedToneGroups, setSelectedToneGroups] = useState<Set<string>>(new Set());
  const [tonePrimaryOverrides, setTonePrimaryOverrides] = useState<Record<string, string>>({});

  // Tab 2: Multi-phone state
  const [selectedMultiPhoneIds, setSelectedMultiPhoneIds] = useState<Set<string>>(new Set());

  // Tab 3: Multi-address inline search & batch selection state
  const [addressSearchQuery, setAddressSearchQuery] = useState('');
  const [selectedAddressIds, setSelectedAddressIds] = useState<Set<string>>(new Set());

  // Tab 4: Duplicate phone state
  const [selectedDuplicatePhones, setSelectedDuplicatePhones] = useState<Set<string>>(new Set());
  const [duplicatePrimaryOverrides, setDuplicatePrimaryOverrides] = useState<Record<string, string>>({});

  const visibleToneTwins = useMemo(
    () => auditResult.toneTwins.filter(g => !localToneAcks.has(g.toneCleanName)),
    [auditResult.toneTwins, localToneAcks]
  );

  const visibleMultiAddresses = useMemo(
    () => auditResult.multiAddressAnomalies.filter(a => !localAddressAcks.has(a.customer.id)),
    [auditResult.multiAddressAnomalies, localAddressAcks]
  );

  const filteredMultiAddresses = useMemo(() => {
    const q = addressSearchQuery.trim();
    if (!q) return visibleMultiAddresses;
    return visibleMultiAddresses.filter(({ customer, addresses }) => {
      return (
        matchesSearch(customer.name, q) ||
        matchesSearch(customer.phone || '', q) ||
        matchesSearch(customer.phone2 || '', q) ||
        matchesSearch(customer.address || '', q) ||
        addresses.some(a => matchesSearch(a, q))
      );
    });
  }, [visibleMultiAddresses, addressSearchQuery]);

  const visibleDiscrepancies = useMemo(() => {
    return (auditResult.orderDiscrepancies || [])
      .map(disc => {
        const filteredOrders = disc.historicalOrders.filter(
          o => !localDiscrepancyAcks.has(`${disc.customer.id}::${o.id}`)
        );
        return { ...disc, historicalOrders: filteredOrders };
      })
      .filter(disc => {
        const differing = disc.historicalOrders.filter(
          o =>
            (o.customerPhone && disc.differingPhones.includes(o.customerPhone.trim())) ||
            (o.customerAddress && disc.differingAddresses.includes(o.customerAddress.trim())) ||
            (o.customerName && disc.differingNames.includes(o.customerName.normalize('NFC').trim()))
        );
        return differing.length > 0;
      });
  }, [auditResult.orderDiscrepancies, localDiscrepancyAcks]);

  // Prune stale selection IDs whenever visible anomaly lists shrink after delete/merge/ack
  useEffect(() => {
    const validToneKeys = new Set(visibleToneTwins.map(g => g.toneCleanName));
    setSelectedToneGroups(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter(k => validToneKeys.has(k)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleToneTwins]);

  useEffect(() => {
    const validPhoneIds = new Set(auditResult.multiPhoneAnomalies.map(a => a.customer.id));
    setSelectedMultiPhoneIds(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter(id => validPhoneIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [auditResult.multiPhoneAnomalies]);

  useEffect(() => {
    const validAddrIds = new Set(visibleMultiAddresses.map(a => a.customer.id));
    setSelectedAddressIds(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter(id => validAddrIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleMultiAddresses]);

  useEffect(() => {
    const validDupPhones = new Set(auditResult.duplicatePhoneGroups.map(g => g.normalizedPhone));
    setSelectedDuplicatePhones(prev => {
      if (prev.size === 0) return prev;
      const next = new Set(Array.from(prev).filter(p => validDupPhones.has(p)));
      return next.size === prev.size ? prev : next;
    });
  }, [auditResult.duplicatePhoneGroups]);

  // Precompute order count map for O(1) lookup across hundreds of cards
  const orderCountByCustId = useMemo(() => {
    const map = new Map<string, number>();
    for (const o of orders) {
      if (!o.customerId) continue;
      map.set(o.customerId, (map.get(o.customerId) || 0) + 1);
    }
    return map;
  }, [orders]);

  if (!isOpen) return null;

  const getCustomerOrderCount = (c: Customer): number => {
    const matched = orderCountByCustId.get(c.id) || 0;
    return matched > 0 ? matched : (c.orderCount || 0);
  };

  const getCustomerOrders = (customerId: string): Order[] => {
    return orders
      .filter(o => o.customerId === customerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  };

  const acknowledgeToneTwins = (keys: string[]) => {
    if (keys.length === 0) return;
    if (onAcknowledgeSentinelItems) {
      onAcknowledgeSentinelItems('toneTwins', keys);
    } else {
      setLocalToneAcks(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.add(k));
        return next;
      });
    }
    setSelectedToneGroups(prev => {
      const next = new Set(prev);
      keys.forEach(k => next.delete(k));
      return next;
    });
  };

  const acknowledgeMultiAddresses = (custIds: string[]) => {
    if (custIds.length === 0) return;
    if (onAcknowledgeSentinelItems) {
      onAcknowledgeSentinelItems('multiAddresses', custIds);
    } else {
      setLocalAddressAcks(prev => {
        const next = new Set(prev);
        custIds.forEach(id => next.add(id));
        return next;
      });
    }
    setSelectedAddressIds(prev => {
      const next = new Set(prev);
      custIds.forEach(id => next.delete(id));
      return next;
    });
  };

  const acknowledgeDiscrepancyKeys = (keys: string[]) => {
    if (keys.length === 0) return;
    if (onAcknowledgeSentinelItems) {
      onAcknowledgeSentinelItems('discrepancies', keys);
    } else {
      setLocalDiscrepancyAcks(prev => {
        const next = new Set(prev);
        keys.forEach(k => next.add(k));
        return next;
      });
    }
  };

  const mergeGroupAction = (primaryId: string, duplicateIds: string[]) => {
    if (duplicateIds.length === 0) return;
    if (onMergeCustomerGroup) {
      onMergeCustomerGroup(primaryId, duplicateIds);
    } else {
      for (const dupId of duplicateIds) {
        onMergeCustomers(primaryId, dupId);
      }
    }
  };

  const confirmAndDeleteCustomer = (c: Customer) => {
    const isGhost = isEmptyGhostCustomer(c, orders);
    const custOrdersCount = getCustomerOrderCount(c);
    if (isGhost) {
      if (
        window.confirm(
          `Xóa hồ sơ trống "${c.name}" (#${c.id})?\n(0 SĐT, 0 địa chỉ, 0 đơn hàng, 0 nợ)`
        )
      ) {
        if (onDeleteCustomer) onDeleteCustomer(c.id);
        else onDeleteCustomersBatch?.([c.id]);
        setRepairSuccessLog([`Đã xóa an toàn hồ sơ trống "${c.name}" (#${c.id}).`]);
      }
      return;
    }

    const warningMsg =
      (c.debt || 0) > 0 || custOrdersCount > 0
        ? `⚠️ CẢNH BÁO AN TOÀN: Khách "${c.name}" (#${c.id}) đang có ${custOrdersCount} đơn hàng và ${formatVND(c.debt || 0)} dư nợ!\n\nBạn có chắc chắn muốn XÓA vĩnh viễn hồ sơ này?`
        : `Xác nhận xóa khách hàng "${c.name}" (#${c.id})?`;
    if (window.confirm(warningMsg)) {
      if (onDeleteCustomer) onDeleteCustomer(c.id);
      else onDeleteCustomersBatch?.([c.id]);
      setRepairSuccessLog([`Đã xóa khách hàng "${c.name}" (#${c.id}).`]);
    }
  };

  const handleRunAutoRepair = () => {
    const res = onRepairAll();
    if (res.changesCount > 0) {
      setRepairSuccessLog(res.log);
    } else {
      alert('Tất cả các lỗi đã được sửa hoặc dữ liệu danh bạ đã đạt chuẩn!');
    }
  };

  // Batch counts
  const toneGhostIds = useMemo(() => {
    const groupsToScan =
      selectedToneGroups.size > 0
        ? visibleToneTwins.filter(g => selectedToneGroups.has(g.toneCleanName))
        : visibleToneTwins;
    const ids: string[] = [];
    for (const g of groupsToScan) {
      const analysis = analyzeToneTwinGroup(g, orders);
      for (const gid of analysis.ghostCustomerIds) {
        if (!ids.includes(gid)) ids.push(gid);
      }
    }
    return ids;
  }, [visibleToneTwins, selectedToneGroups, orders]);

  const validMultiPhoneIds = useMemo(() => {
    return auditResult.multiPhoneAnomalies
      .filter(({ customer }) => {
        const a1 = analyzeFusedPhone(customer.phone || '');
        const a2 = analyzeFusedPhone(customer.phone2 || '');
        const unresolvable = (a1.isFused && a1.status !== 'ok') || (a2.isFused && a2.status !== 'ok');
        return !unresolvable && repairCustomerFusedPhones(customer).changed;
      })
      .map(a => a.customer.id);
  }, [auditResult.multiPhoneAnomalies]);

  const targetMultiPhoneBatchIds = useMemo(() => {
    if (selectedMultiPhoneIds.size > 0) {
      return validMultiPhoneIds.filter(id => selectedMultiPhoneIds.has(id));
    }
    return validMultiPhoneIds;
  }, [validMultiPhoneIds, selectedMultiPhoneIds]);

  const discrepancySafeItems = useMemo(() => {
    const items: Array<{ customerId: string; orderId: string }> = [];
    for (const disc of visibleDiscrepancies) {
      const differing = disc.historicalOrders.filter(
        o =>
          (o.customerPhone && disc.differingPhones.includes(o.customerPhone.trim())) ||
          (o.customerAddress && disc.differingAddresses.includes(o.customerAddress.trim())) ||
          (o.customerName && disc.differingNames.includes(o.customerName.normalize('NFC').trim()))
      );
      for (const ord of differing) {
        const analysis = analyzeDiscrepancyOrder(disc.customer, ord);
        if (analysis.recommendedAction === 'add_phone2' || analysis.recommendedAction === 'add_extra_address') {
          items.push({ customerId: disc.customer.id, orderId: ord.id });
        }
      }
    }
    return items;
  }, [visibleDiscrepancies]);

  const effectiveAckCount = Math.max(
    acknowledgedCount,
    localToneAcks.size + localAddressAcks.size + localDiscrepancyAcks.size
  );

  const totalVisibleAnomalies =
    visibleToneTwins.length +
    auditResult.multiPhoneAnomalies.length +
    visibleMultiAddresses.length +
    auditResult.duplicatePhoneGroups.length +
    visibleDiscrepancies.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col overflow-hidden animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 backdrop-blur-md rounded-2xl">
              <ShieldAlert className="w-6 h-6 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black tracking-tight">Trung tâm Kiểm soát & Sửa bất thường Danh bạ</h2>
                <span className="px-2 py-0.5 bg-white/20 rounded-full text-[11px] font-bold">
                  {totalVisibleAnomalies} cảnh báo
                </span>
              </div>
              <p className="text-xs text-amber-100 mt-0.5">
                Đề xuất thông minh, Xóa hồ sơ trống an toàn và Xử lý hàng loạt 1-click
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
        <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-amber-900 leading-snug">
            <span className="font-bold">💡 Tự động khôi phục & tách dữ liệu:</span> Phục hồi sạch sẽ "Thanh Hang" vs "Thanh Hằng", tách số điện thoại 20 chữ số và chuẩn hóa tên gộp chỉ với 1 cú click!
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {effectiveAckCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onResetSentinelAcks?.();
                  setLocalToneAcks(new Set());
                  setLocalAddressAcks(new Set());
                  setLocalDiscrepancyAcks(new Set());
                }}
                className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                title="Hiển thị lại các mục đã xác nhận độc lập hoặc bỏ qua"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Đặt lại {effectiveAckCount} mục đã bỏ qua</span>
              </button>
            )}
            <button
              onClick={handleRunAutoRepair}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 shrink-0"
            >
              <Sparkles className="w-4 h-4 text-amber-200" />
              <span>Tự động sửa toàn bộ lỗi</span>
            </button>
          </div>
        </div>

        {/* Repair Success Notification */}
        {repairSuccessLog && (
          <div className="bg-emerald-50 px-4 py-2.5 border-b border-emerald-200 text-xs text-emerald-900 flex items-start justify-between gap-2 shrink-0">
            <div className="space-y-1">
              <div className="font-bold flex items-center gap-1 text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Thao tác hoàn tất ({repairSuccessLog.length}):</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-emerald-700 pl-1 max-h-24 overflow-y-auto">
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
              activeTab === 'all' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Tất cả ({totalVisibleAnomalies})
          </button>
          <button
            onClick={() => setActiveTab('tone')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'tone' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Trùng tên khác dấu ({visibleToneTwins.length})
          </button>
          <button
            onClick={() => setActiveTab('phone')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'phone' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Gộp nhiều SĐT ({auditResult.multiPhoneAnomalies.length})
          </button>
          <button
            onClick={() => setActiveTab('address')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'address' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Gộp nhiều địa chỉ ({visibleMultiAddresses.length})
          </button>
          <button
            onClick={() => setActiveTab('duplicate')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'duplicate' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Trùng số điện thoại ({auditResult.duplicatePhoneGroups.length})
          </button>
          <button
            onClick={() => setActiveTab('discrepancy')}
            className={`px-3 py-1.5 rounded-xl transition shrink-0 ${
              activeTab === 'discrepancy' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            Lệch với đơn cũ ({visibleDiscrepancies.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
          {totalVisibleAnomalies === 0 && (
            <div className="text-center py-12 text-slate-500 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div className="font-bold text-slate-700 text-base">Tuyệt vời! Danh bạ khách hàng hoàn toàn chuẩn xác.</div>
              <p className="text-xs text-slate-400">Không phát hiện tên trùng khác dấu, gộp SĐT hoặc địa chỉ sai lệch.</p>
              {effectiveAckCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onResetSentinelAcks?.();
                    setLocalToneAcks(new Set());
                    setLocalAddressAcks(new Set());
                    setLocalDiscrepancyAcks(new Set());
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại {effectiveAckCount} mục đã bỏ qua</span>
                </button>
              )}
            </div>
          )}

          {/* 1. TONE TWINS SECTION */}
          {(activeTab === 'all' || activeTab === 'tone') && visibleToneTwins.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Trùng tên khác dấu ({visibleToneTwins.length} nhóm)</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Xóa hồ sơ trống, gộp làm 1, hoặc xác nhận khách độc lập (tự động lưu quyết định)
                  </span>
                </div>
              </div>

              {/* Section Batch Bar */}
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedToneGroups.size === visibleToneTwins.length) {
                        setSelectedToneGroups(new Set());
                      } else {
                        setSelectedToneGroups(new Set(visibleToneTwins.map(g => g.toneCleanName)));
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition text-[11px]"
                  >
                    {selectedToneGroups.size === visibleToneTwins.length ? 'Bỏ chọn tất cả' : `Chọn tất cả (${visibleToneTwins.length})`}
                  </button>
                  {selectedToneGroups.size > 0 && (
                    <span className="text-[11px] font-bold text-amber-800">
                      Đang chọn {selectedToneGroups.size} nhóm
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {toneGhostIds.length > 0 && onDeleteCustomersBatch && (
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Xóa an toàn ${toneGhostIds.length} hồ sơ trống (0 SĐT, 0 địa chỉ, 0 đơn hàng, 0 nợ)?`
                          )
                        ) {
                          const res = onDeleteCustomersBatch(toneGhostIds, { onlySafe: true });
                          setRepairSuccessLog([
                            `Đã xóa an toàn ${res.deletedCount} hồ sơ trống khỏi danh bạ.`,
                          ]);
                        }
                      }}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa tất cả hồ sơ trống ({toneGhostIds.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const targetGroups =
                        selectedToneGroups.size > 0
                          ? Array.from(selectedToneGroups)
                          : visibleToneTwins.map(g => g.toneCleanName);
                      acknowledgeToneTwins(targetGroups);
                      setRepairSuccessLog([
                        `Đã xác nhận & lưu trạng thái độc lập cho ${targetGroups.length} nhóm trùng tên.`,
                      ]);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      Xác nhận độc lập hàng loạt (
                      {selectedToneGroups.size > 0 ? selectedToneGroups.size : visibleToneTwins.length})
                    </span>
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {visibleToneTwins.map(group => {
                  const analysis = analyzeToneTwinGroup(group, orders);
                  const activePrimaryId =
                    tonePrimaryOverrides[group.toneCleanName] &&
                    group.customers.some(c => c.id === tonePrimaryOverrides[group.toneCleanName])
                      ? tonePrimaryOverrides[group.toneCleanName]
                      : analysis.recommendedPrimaryId;
                  const activePrimary =
                    group.customers.find(c => c.id === activePrimaryId) || group.customers[0];
                  const mergeDupIds = group.customers
                    .filter(c => c.id !== activePrimary.id)
                    .map(c => c.id);
                  const isGroupChecked = selectedToneGroups.has(group.toneCleanName);

                  return (
                    <div
                      key={group.toneCleanName}
                      className="p-3.5 bg-amber-50/40 rounded-2xl border border-amber-200 space-y-3 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isGroupChecked}
                            onChange={() => {
                              setSelectedToneGroups(prev => {
                                const next = new Set(prev);
                                if (next.has(group.toneCleanName)) next.delete(group.toneCleanName);
                                else next.add(group.toneCleanName);
                                return next;
                              });
                            }}
                            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-slate-500">Nhóm tên gốc không dấu:</span>
                          <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                            "{group.toneCleanName}"
                          </span>
                          <span className="text-slate-500">({group.customers.length} khách)</span>
                        </label>

                        {/* Alternative actions right beside each other */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {analysis.ghostCustomerIds.length > 0 && onDeleteCustomersBatch && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Xóa ${analysis.ghostCustomerIds.length} hồ sơ trống trong nhóm "${group.toneCleanName}"?`
                                  )
                                ) {
                                  const res = onDeleteCustomersBatch(analysis.ghostCustomerIds, { onlySafe: true });
                                  setRepairSuccessLog([
                                    `Đã xóa ${res.deletedCount} hồ sơ trống trong nhóm "${group.toneCleanName}".`,
                                  ]);
                                }
                              }}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>Xóa hồ sơ trống ({analysis.ghostCustomerIds.length})</span>
                            </button>
                          )}

                          {mergeDupIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Gộp ${mergeDupIds.length} hồ sơ còn lại vào "${activePrimary.name}" (#${activePrimary.id})?`
                                  )
                                ) {
                                  mergeGroupAction(activePrimary.id, mergeDupIds);
                                  setRepairSuccessLog([
                                    `Đã gộp ${group.customers.length} hồ sơ nhóm "${group.toneCleanName}" vào #${activePrimary.id}.`,
                                  ]);
                                }
                              }}
                              className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                            >
                              <Merge className="w-3 h-3" />
                              <span>Gộp làm 1</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => acknowledgeToneTwins([group.toneCleanName])}
                            className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Xác nhận {group.customers.length} khách độc lập (Lưu)</span>
                          </button>
                        </div>
                      </div>

                      {/* Recommended Action Banner */}
                      <div className="p-2.5 bg-white rounded-xl border-2 border-emerald-300/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-start gap-2 min-w-0 flex-1">
                          <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-black uppercase shrink-0 mt-0.5">
                            Phương án Đề xuất
                          </span>
                          <span className="text-slate-700 font-medium leading-snug">{analysis.reasonLabel}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (analysis.recommendation === 'delete_ghosts') {
                              if (
                                window.confirm(
                                  `Áp dụng đề xuất: ${analysis.actionLabel}? (Chỉ xóa hồ sơ trống 0 nợ, 0 đơn)`
                                )
                              ) {
                                if (onDeleteCustomersBatch) {
                                  const res = onDeleteCustomersBatch(analysis.ghostCustomerIds, { onlySafe: true });
                                  setRepairSuccessLog([`Đã xóa ${res.deletedCount} hồ sơ trống.`]);
                                } else {
                                  analysis.ghostCustomerIds.forEach(id => onDeleteCustomer?.(id));
                                }
                              }
                            } else if (analysis.recommendation === 'merge_into_primary') {
                              if (
                                window.confirm(
                                  `Áp dụng đề xuất: Gộp cả nhóm vào "${activePrimary.name}" (#${activePrimary.id})?`
                                )
                              ) {
                                mergeGroupAction(activePrimary.id, mergeDupIds);
                                setRepairSuccessLog([
                                  `Đã gộp nhóm "${group.toneCleanName}" vào "${activePrimary.name}" (#${activePrimary.id}).`,
                                ]);
                              }
                            } else {
                              acknowledgeToneTwins([group.toneCleanName]);
                            }
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{analysis.actionLabel}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.customers.map(c => {
                          const custOrders = getCustomerOrders(c.id);
                          const ordCount = getCustomerOrderCount(c);
                          const isGhost = isEmptyGhostCustomer(c, orders);
                          const isPrimarySelected = c.id === activePrimary.id;
                          const extraAddrs = c.extraAddresses || [];
                          return (
                            <div
                              key={c.id}
                              className={`bg-white p-3 rounded-xl border space-y-2 shadow-2xs flex flex-col justify-between ${
                                isGhost
                                  ? 'border-rose-200 bg-rose-50/20'
                                  : isPrimarySelected
                                  ? 'border-emerald-300 ring-1 ring-emerald-200'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-black text-slate-800 text-sm">{c.name}</span>
                                    {isGhost && (
                                      <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 border border-rose-200 rounded text-[10px] font-black">
                                        Hồ sơ trống
                                      </span>
                                    )}
                                    {!isGhost && isPrimarySelected && (
                                      <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-[10px] font-bold">
                                        Chính để gộp
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 shrink-0">
                                    #{c.id}
                                  </span>
                                </div>

                                <div className="text-xs space-y-1 text-slate-600">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                    <span className="font-semibold text-slate-700">{c.phone || 'Chưa có SĐT'}</span>
                                    {c.phone2 && (
                                      <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                        SĐT 2: {c.phone2}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-start gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                    <span className="truncate text-slate-600" title={getAllCustomerAddresses(c).join(' | ')}>
                                      {c.address || 'Chưa có địa chỉ'}
                                      {extraAddrs.length > 0 && ` (+${extraAddrs.length} Đ/C phụ)`}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-[11px] font-semibold">
                                    <span className="text-slate-600">{ordCount} đơn hàng</span>
                                    <span className={c.debt > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                                      Nợ: {formatVND(c.debt || 0)}
                                    </span>
                                  </div>
                                </div>

                                {/* Order Snapshot History */}
                                {custOrders.length > 0 && (
                                  <div className="pt-1.5 border-t border-slate-100 text-[10px] space-y-1">
                                    <div className="font-bold text-slate-500 flex items-center gap-1">
                                      <History className="w-3 h-3" />
                                      <span>Đơn hàng gần đây:</span>
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

                              <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                                {!isGhost && !isPrimarySelected ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTonePrimaryOverrides(prev => ({
                                        ...prev,
                                        [group.toneCleanName]: c.id,
                                      }))
                                    }
                                    className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Star className="w-3 h-3" />
                                    <span>Chọn làm Chính để gộp</span>
                                  </button>
                                ) : (
                                  <span />
                                )}

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onEditCustomer(c)}
                                    className="px-2.5 py-1 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Sửa</span>
                                  </button>
                                  {(onDeleteCustomer || onDeleteCustomersBatch) && (
                                    <button
                                      type="button"
                                      onClick={() => confirmAndDeleteCustomer(c)}
                                      className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Xóa</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 2. MULTI-PHONE SECTION */}
          {(activeTab === 'all' || activeTab === 'phone') && auditResult.multiPhoneAnomalies.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <GitFork className="w-4 h-4 text-amber-600" />
                    <span>Khách hàng gộp nhiều SĐT / SĐT bất thường ({auditResult.multiPhoneAnomalies.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Đề xuất: Tách vào SĐT 1 & SĐT 2 trên cùng 1 khách hoặc tách thành 2 khách độc lập
                  </span>
                </div>
              </div>

              {/* Section Batch Bar */}
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedMultiPhoneIds.size === auditResult.multiPhoneAnomalies.length) {
                        setSelectedMultiPhoneIds(new Set());
                      } else {
                        setSelectedMultiPhoneIds(
                          new Set(auditResult.multiPhoneAnomalies.map(a => a.customer.id))
                        );
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition text-[11px]"
                  >
                    {selectedMultiPhoneIds.size === auditResult.multiPhoneAnomalies.length
                      ? 'Bỏ chọn tất cả'
                      : `Chọn tất cả (${auditResult.multiPhoneAnomalies.length})`}
                  </button>
                  {selectedMultiPhoneIds.size > 0 && (
                    <span className="text-[11px] font-bold text-amber-800">
                      Đã chọn {selectedMultiPhoneIds.size} khách
                    </span>
                  )}
                </div>

                {validMultiPhoneIds.length > 0 && (onAcceptAllPhoneSplits || onAcceptPhoneSplit) && (
                  <button
                    type="button"
                    disabled={targetMultiPhoneBatchIds.length === 0}
                    onClick={() => {
                      if (targetMultiPhoneBatchIds.length === 0) return;
                      if (onAcceptAllPhoneSplits) {
                        const count = onAcceptAllPhoneSplits(targetMultiPhoneBatchIds);
                        setSelectedMultiPhoneIds(new Set());
                        setRepairSuccessLog([
                          `Đã chấp nhận tách SĐT 1 & SĐT 2 cho ${count} khách hàng hợp lệ.`,
                        ]);
                      } else if (onAcceptPhoneSplit) {
                        targetMultiPhoneBatchIds.forEach(id => onAcceptPhoneSplit(id));
                        setSelectedMultiPhoneIds(new Set());
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Chấp nhận tách tất cả SĐT hợp lệ ({targetMultiPhoneBatchIds.length})</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {auditResult.multiPhoneAnomalies.map(({ customer, phones }) => {
                  const analysis1 = analyzeFusedPhone(customer.phone || '');
                  const analysis2 = analyzeFusedPhone(customer.phone2 || '');
                  const isUnresolvableFused =
                    (analysis1.isFused && analysis1.status !== 'ok') ||
                    (analysis2.isFused && analysis2.status !== 'ok');
                  const unresolvableAnalysis =
                    analysis1.isFused && analysis1.status !== 'ok' ? analysis1 : analysis2;
                  const repairPreview = repairCustomerFusedPhones(customer);
                  const canAcceptSplit = !isUnresolvableFused && repairPreview.changed;
                  const isChecked = selectedMultiPhoneIds.has(customer.id);

                  return (
                    <div
                      key={customer.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setSelectedMultiPhoneIds(prev => {
                                const next = new Set(prev);
                                if (next.has(customer.id)) next.delete(customer.id);
                                else next.add(customer.id);
                                return next;
                              });
                            }}
                            className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-slate-800 text-sm">{customer.name}</span>
                              <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                #{customer.id}
                              </span>
                              {canAcceptSplit && (
                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                  Phương án Đề xuất: Lưu SĐT 1 & 2
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                              <span className="text-slate-400">SĐT gốc:</span>
                              <span className="font-mono bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-200 font-bold">
                                {customer.phone || 'Trống'}
                              </span>
                              {customer.phone2 && (
                                <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-bold">
                                  SĐT 2: {customer.phone2}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                          {canAcceptSplit && onAcceptPhoneSplit && (
                            <button
                              type="button"
                              onClick={() => onAcceptPhoneSplit(customer.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{phones.length >= 2 ? 'Chấp nhận SĐT 1 & 2' : 'Chuẩn hóa số trùng'}</span>
                            </button>
                          )}
                          {phones.length >= 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Tách khách hàng "${customer.name}" thành 2 hồ sơ độc lập theo 2 số điện thoại?`
                                  )
                                ) {
                                  onSplitCustomer(customer.id, 'phone');
                                }
                              }}
                              className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                            >
                              <GitFork className="w-3.5 h-3.5" />
                              <span>Tách thành 2 khách</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditCustomer(customer)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Sửa SĐT</span>
                          </button>
                          {(onDeleteCustomer || onDeleteCustomersBatch) && (
                            <button
                              type="button"
                              onClick={() => confirmAndDeleteCustomer(customer)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Xóa</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isUnresolvableFused ? (
                        <div className="bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            Chuỗi số ({unresolvableAnalysis.rawDigits.length} chữ số) không tách được chắc chắn theo đầu số Việt Nam. Vui lòng bấm <strong>Sửa SĐT</strong> để kiểm tra thủ công.
                          </span>
                        </div>
                      ) : (
                        phones.length >= 1 && (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 text-xs flex flex-wrap items-center gap-3">
                            <span className="font-semibold text-slate-500">Đề xuất tách:</span>
                            {phones.map((p, idx) => (
                              <span
                                key={idx}
                                className="font-mono bg-white px-2 py-1 rounded-md border border-slate-200 text-slate-800 font-bold"
                              >
                                {idx === 0 ? 'SĐT 1' : `SĐT ${idx + 1}`}: {p}
                              </span>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. MULTI-ADDRESS SECTION */}
          {(activeTab === 'all' || activeTab === 'address') && visibleMultiAddresses.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-600" />
                    <span>Khách hàng có nhiều địa chỉ giao hàng ({visibleMultiAddresses.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Phương án Đề xuất: Chuyển địa chỉ thứ 2 trở đi thành Địa chỉ phụ trên cùng 1 khách hàng
                  </span>
                </div>
              </div>

              {/* Inline Search & Multi-Action Batch Toolbar */}
              <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={addressSearchQuery}
                      onChange={e => setAddressSearchQuery(e.target.value)}
                      placeholder="Tìm trong danh sách nhiều địa chỉ theo Tên, SĐT hoặc Địa chỉ..."
                      className="w-full pl-8 pr-7 py-1.5 bg-white border border-amber-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                    />
                    {addressSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAddressSearchQuery('')}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 shrink-0">
                    Đang hiện {filteredMultiAddresses.length}/{visibleMultiAddresses.length} khách
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAddressIds(new Set(filteredMultiAddresses.map(a => a.customer.id)))
                      }
                      className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition text-[11px]"
                    >
                      Chọn tất cả đang lọc ({filteredMultiAddresses.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAddressIds(new Set())}
                      disabled={selectedAddressIds.size === 0}
                      className="px-2.5 py-1 bg-white border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-100 disabled:opacity-40 transition text-[11px]"
                    >
                      Bỏ chọn
                    </button>
                    {selectedAddressIds.size > 0 && (
                      <span className="text-[11px] font-extrabold text-amber-800">
                        Đã chọn {selectedAddressIds.size} khách
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {onConvertAddressesBatch && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetIds =
                            selectedAddressIds.size > 0
                              ? Array.from(selectedAddressIds)
                              : filteredMultiAddresses.map(a => a.customer.id);
                          if (targetIds.length === 0) return;
                          const updatedCount = onConvertAddressesBatch(targetIds);
                          setSelectedAddressIds(new Set());
                          setRepairSuccessLog([
                            `Đã chuyển thành công địa chỉ thứ 2 trở đi sang Địa chỉ phụ cho ${updatedCount} khách hàng.`,
                          ]);
                        }}
                        disabled={filteredMultiAddresses.length === 0}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>
                          Chuyển sang Đ/C phụ (
                          {selectedAddressIds.size > 0 ? selectedAddressIds.size : filteredMultiAddresses.length})
                        </span>
                        <span className="px-1.5 py-0.2 bg-white/20 rounded text-[9px] font-black">Đề xuất</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={selectedAddressIds.size === 0}
                      onClick={() => {
                        const targetIds = Array.from(selectedAddressIds);
                        if (targetIds.length === 0) return;
                        acknowledgeMultiAddresses(targetIds);
                        setRepairSuccessLog([
                          `Đã giữ nguyên và ẩn cảnh báo cho ${targetIds.length} khách hàng.`,
                        ]);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 border border-slate-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Giữ nguyên / Ẩn cảnh báo ({selectedAddressIds.size})</span>
                    </button>

                    <button
                      type="button"
                      disabled={selectedAddressIds.size === 0}
                      onClick={() => {
                        const targetIds = Array.from(selectedAddressIds);
                        if (targetIds.length === 0) return;
                        if (
                          window.confirm(
                            `Tách ${targetIds.length} khách hàng đã chọn thành các hồ sơ độc lập theo từng địa chỉ?`
                          )
                        ) {
                          targetIds.forEach(id => onSplitCustomer(id, 'address'));
                          setSelectedAddressIds(new Set());
                          setRepairSuccessLog([`Đã tách ${targetIds.length} khách hàng theo địa chỉ.`]);
                        }
                      }}
                      className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 text-amber-900 border border-amber-300 rounded-xl text-[11px] font-bold transition flex items-center gap-1"
                    >
                      <GitFork className="w-3.5 h-3.5" />
                      <span>Tách thành 2 khách ({selectedAddressIds.size})</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tall Scrollable Multi-Address List */}
              <div className="max-h-96 overflow-y-auto space-y-2.5 pr-1">
                {filteredMultiAddresses.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    Không tìm thấy khách hàng nào khớp với "{addressSearchQuery}"
                  </div>
                ) : (
                  filteredMultiAddresses.map(({ customer, addresses }) => {
                    const isChecked = selectedAddressIds.has(customer.id);
                    return (
                      <div
                        key={customer.id}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedAddressIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(customer.id)) next.delete(customer.id);
                                  else next.add(customer.id);
                                  return next;
                                });
                              }}
                              className="mt-1 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-800 text-sm">{customer.name}</span>
                                <span className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">
                                  #{customer.id}
                                </span>
                                {customer.phone && (
                                  <span className="text-[11px] font-mono text-slate-600">{customer.phone}</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-600 mt-1">
                                <span className="text-slate-400">Địa chỉ gốc: </span>
                                <span className="font-medium text-slate-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 break-words">
                                  {customer.address}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                            {addresses.length >= 2 && onConvertAddressToExtra && (
                              <button
                                type="button"
                                onClick={() => onConvertAddressToExtra(customer.id)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Chuyển thành địa chỉ phụ</span>
                                <span className="px-1.5 py-0.2 bg-white/20 rounded text-[9px] font-black">Đề xuất</span>
                              </button>
                            )}
                            {addresses.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Tách khách hàng "${customer.name}" thành 2 hồ sơ độc lập theo 2 địa chỉ giao hàng?`
                                    )
                                  ) {
                                    onSplitCustomer(customer.id, 'address');
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              >
                                <GitFork className="w-3.5 h-3.5" />
                                <span>Tách thành 2 khách</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => acknowledgeMultiAddresses([customer.id])}
                              className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              title="Giữ nguyên chuỗi địa chỉ này và ẩn cảnh báo"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              <span>Giữ nguyên (Ẩn)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditCustomer(customer)}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Sửa</span>
                            </button>
                            {(onDeleteCustomer || onDeleteCustomersBatch) && (
                              <button
                                type="button"
                                onClick={() => confirmAndDeleteCustomer(customer)}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Xóa</span>
                              </button>
                            )}
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
                                  <span className="font-bold text-slate-500 mr-1">
                                    {idx === 0 ? 'Chính:' : `Phụ ${idx + 1}:`}
                                  </span>
                                  <span>{addr}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 4. DUPLICATE PHONE SECTION */}
          {(activeTab === 'all' || activeTab === 'duplicate') && auditResult.duplicatePhoneGroups.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <Merge className="w-4 h-4 text-amber-600" />
                    <span>Trùng số điện thoại giữa các khách hàng khác nhau ({auditResult.duplicatePhoneGroups.length})</span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Tự động chọn hồ sơ giàu dữ liệu nhất làm Chính — hỗ trợ gộp 2, 3+ khách hoặc gộp hàng loạt
                  </span>
                </div>
              </div>

              {/* Section Batch Bar */}
              <div className="p-2.5 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedDuplicatePhones.size === auditResult.duplicatePhoneGroups.length) {
                        setSelectedDuplicatePhones(new Set());
                      } else {
                        setSelectedDuplicatePhones(
                          new Set(auditResult.duplicatePhoneGroups.map(g => g.normalizedPhone))
                        );
                      }
                    }}
                    className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg font-bold hover:bg-amber-100 transition text-[11px]"
                  >
                    {selectedDuplicatePhones.size === auditResult.duplicatePhoneGroups.length
                      ? 'Bỏ chọn tất cả'
                      : `Chọn tất cả (${auditResult.duplicatePhoneGroups.length})`}
                  </button>
                  {selectedDuplicatePhones.size > 0 && (
                    <span className="text-[11px] font-bold text-amber-800">
                      Đang chọn {selectedDuplicatePhones.size} nhóm
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const targetGroups =
                      selectedDuplicatePhones.size > 0
                        ? auditResult.duplicatePhoneGroups.filter(g =>
                            selectedDuplicatePhones.has(g.normalizedPhone)
                          )
                        : auditResult.duplicatePhoneGroups;
                    if (targetGroups.length === 0) return;

                    if (
                      !window.confirm(
                        `Gộp toàn bộ ${targetGroups.length} nhóm trùng SĐT vào hồ sơ Chính đã đề xuất?\n(Dư nợ, SĐT phụ, địa chỉ phụ và toàn bộ đơn hàng sẽ được cộng dồn an toàn)`
                      )
                    ) {
                      return;
                    }

                    const payload = targetGroups.map(g => {
                      const recommended = rankPrimaryCustomer(g.customers, orders);
                      const chosenId =
                        duplicatePrimaryOverrides[g.normalizedPhone] &&
                        g.customers.some(c => c.id === duplicatePrimaryOverrides[g.normalizedPhone])
                          ? duplicatePrimaryOverrides[g.normalizedPhone]
                          : recommended.id;
                      return {
                        primaryId: chosenId,
                        duplicateIds: g.customers.filter(c => c.id !== chosenId).map(c => c.id),
                      };
                    });

                    if (onMergeDuplicateGroupsBatch) {
                      const count = onMergeDuplicateGroupsBatch(payload);
                      setSelectedDuplicatePhones(new Set());
                      setRepairSuccessLog([`Đã gộp thành công ${count} nhóm trùng SĐT.`]);
                    } else {
                      payload.forEach(p => mergeGroupAction(p.primaryId, p.duplicateIds));
                      setSelectedDuplicatePhones(new Set());
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shadow-2xs transition flex items-center gap-1.5"
                >
                  <Merge className="w-3.5 h-3.5" />
                  <span>
                    Gộp toàn bộ nhóm theo đề xuất (
                    {selectedDuplicatePhones.size > 0
                      ? selectedDuplicatePhones.size
                      : auditResult.duplicatePhoneGroups.length}
                    )
                  </span>
                </button>
              </div>

              <div className="space-y-2.5">
                {auditResult.duplicatePhoneGroups.map(group => {
                  const recommendedPrimary = rankPrimaryCustomer(group.customers, orders);
                  const activePrimaryId =
                    duplicatePrimaryOverrides[group.normalizedPhone] &&
                    group.customers.some(c => c.id === duplicatePrimaryOverrides[group.normalizedPhone])
                      ? duplicatePrimaryOverrides[group.normalizedPhone]
                      : recommendedPrimary.id;
                  const primary =
                    group.customers.find(c => c.id === activePrimaryId) || recommendedPrimary;
                  const duplicateIds = group.customers
                    .filter(c => c.id !== primary.id)
                    .map(c => c.id);
                  const isGroupChecked = selectedDuplicatePhones.has(group.normalizedPhone);

                  return (
                    <div
                      key={group.normalizedPhone}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isGroupChecked}
                            onChange={() => {
                              setSelectedDuplicatePhones(prev => {
                                const next = new Set(prev);
                                if (next.has(group.normalizedPhone)) next.delete(group.normalizedPhone);
                                else next.add(group.normalizedPhone);
                                return next;
                              });
                            }}
                            className="rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                          />
                          <span className="text-slate-500">Số điện thoại trùng:</span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {group.normalizedPhone}
                          </span>
                          <span className="text-slate-400">({group.customers.length} hồ sơ)</span>
                        </label>

                        {duplicateIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Gộp cả ${group.customers.length} khách vào hồ sơ Chính "${primary.name}" (#${primary.id})?\nDư nợ, SĐT phụ, địa chỉ phụ và lịch sử đơn hàng sẽ được cộng dồn tự động.`
                                )
                              ) {
                                mergeGroupAction(primary.id, duplicateIds);
                                setRepairSuccessLog([
                                  `Đã gộp ${group.customers.length} hồ sơ SĐT ${group.normalizedPhone} vào "${primary.name}" (#${primary.id}).`,
                                ]);
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                          >
                            <Merge className="w-3.5 h-3.5" />
                            <span>Gộp cả {group.customers.length} khách vào Chính</span>
                          </button>
                        )}
                      </div>

                      <div className="p-2 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded font-black text-[10px] uppercase">
                          Phương án Đề xuất
                        </span>
                        <span>
                          Giữ <strong>{primary.name}</strong> (#{primary.id}) làm hồ sơ Chính và gộp{' '}
                          {duplicateIds.length} bản sao còn lại vào.
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {group.customers.map(c => {
                          const isRecommended = c.id === recommendedPrimary.id;
                          const isChosenPrimary = c.id === primary.id;
                          const ordCount = getCustomerOrderCount(c);
                          return (
                            <div
                              key={c.id}
                              className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 ${
                                isChosenPrimary
                                  ? 'bg-emerald-50/60 border-emerald-300 ring-1 ring-emerald-200'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                    <span>{c.name}</span>
                                    {isRecommended && (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded font-bold">
                                        Đề xuất Chính
                                      </span>
                                    )}
                                    {isChosenPrimary && !isRecommended && (
                                      <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 border border-amber-200 rounded font-bold">
                                        Đang chọn Chính
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-400">#{c.id}</span>
                                </div>
                                <div className="text-[11px] text-slate-500 truncate" title={c.address}>
                                  {c.address || 'Chưa có địa chỉ'}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] font-semibold">
                                  <span className="text-slate-600">{ordCount} đơn</span>
                                  <span className={c.debt > 0 ? 'text-rose-600 font-bold' : 'text-emerald-700'}>
                                    Nợ: {formatVND(c.debt || 0)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-200/70">
                                {!isChosenPrimary ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDuplicatePrimaryOverrides(prev => ({
                                        ...prev,
                                        [group.normalizedPhone]: c.id,
                                      }))
                                    }
                                    className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                  >
                                    <Star className="w-3 h-3" />
                                    <span>Đặt làm Chính</span>
                                  </button>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-700">✓ Hồ sơ Chính</span>
                                )}

                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onEditCustomer(c)}
                                    className="px-2 py-1 bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-700 border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Sửa</span>
                                  </button>
                                  {(onDeleteCustomer || onDeleteCustomersBatch) && (
                                    <button
                                      type="button"
                                      onClick={() => confirmAndDeleteCustomer(c)}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Xóa</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 5. HISTORICAL ORDER DISCREPANCY SECTION (ADR-0018 & ADR-0021) */}
          {(activeTab === 'all' || activeTab === 'discrepancy') && visibleDiscrepancies.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-800 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-amber-600" />
                    <span>
                      Bất thường lịch sử: Hồ sơ lệch so với đơn hàng cũ ({visibleDiscrepancies.length})
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Thêm SĐT 2 / Địa chỉ phụ không ghi đè, khôi phục theo đơn, hoặc tách thành 2 khách
                  </span>
                </div>

                {discrepancySafeItems.length > 0 && onApplyDiscrepancyBatch && (
                  <button
                    type="button"
                    onClick={() => {
                      const res = onApplyDiscrepancyBatch(discrepancySafeItems);
                      setRepairSuccessLog([
                        `Đã áp dụng đề xuất an toàn (thêm SĐT 2 / Đ/C phụ không ghi đè) cho ${res.updatedCount} khách hàng.`,
                      ]);
                    }}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Áp dụng đề xuất hàng loạt ({discrepancySafeItems.length})</span>
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {visibleDiscrepancies.map(disc => {
                  const differingOrders = disc.historicalOrders
                    .filter(
                      o =>
                        (o.customerPhone && disc.differingPhones.includes(o.customerPhone.trim())) ||
                        (o.customerAddress && disc.differingAddresses.includes(o.customerAddress.trim())) ||
                        (o.customerName && disc.differingNames.includes(o.customerName.normalize('NFC').trim()))
                    )
                    .slice(0, 5);

                  return (
                    <div
                      key={disc.customer.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">{disc.customer.name}</span>
                            <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{disc.customer.id}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex flex-wrap items-center gap-3 mt-1">
                            <span>
                              SĐT hiện tại: <strong className="text-slate-800">{disc.customer.phone || 'Chưa có'}</strong>
                              {disc.customer.phone2 && (
                                <span className="ml-1 text-[11px] font-mono text-amber-800 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
                                  SĐT 2: {disc.customer.phone2}
                                </span>
                              )}
                            </span>
                            <span>•</span>
                            <span>
                              Đ/C hiện tại: <strong className="text-slate-800">{disc.customer.address || 'Chưa có'}</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onEditCustomer(disc.customer)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Sửa</span>
                          </button>
                        </div>
                      </div>

                      {/* Differing historical orders */}
                      <div className="space-y-2 pt-1">
                        <div className="text-[11px] font-bold text-amber-800">Các đơn hàng có thông tin khác:</div>
                        {differingOrders.map(ord => {
                          const analysis = analyzeDiscrepancyOrder(disc.customer, ord);
                          const ackKey = `${disc.customer.id}::${ord.id}`;
                          const hasCustomerPhone = Boolean(
                            (disc.customer.phone || '').trim() || (disc.customer.phone2 || '').trim()
                          );
                          const canSplitPhone = Boolean(
                            hasCustomerPhone &&
                              ord.customerPhone &&
                              !isPhoneMatching(ord.customerPhone, disc.customer.phone || '') &&
                              (!disc.customer.phone2 || !isPhoneMatching(ord.customerPhone, disc.customer.phone2))
                          );

                          return (
                            <div
                              key={ord.id}
                              className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2 text-xs"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-800">#{ord.id}</span>
                                    <span className="text-[10px] text-slate-400">({formatDate(ord.createdAt)})</span>
                                    {ord.customerName && ord.customerName !== disc.customer.name && (
                                      <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                        Tên đơn: {ord.customerName}
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-black">
                                      Đề xuất: {analysis.actionLabel}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-600 flex flex-wrap gap-2">
                                    {ord.customerPhone && (
                                      <span>
                                        SĐT đơn: <strong className="text-amber-900">{ord.customerPhone}</strong>
                                      </span>
                                    )}
                                    {ord.customerAddress && (
                                      <span>
                                        • ĐC đơn: <strong className="text-amber-900">{ord.customerAddress}</strong>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-emerald-800 font-medium">{analysis.reasonLabel}</div>
                                </div>
                              </div>

                              {/* All 4 actions + Bỏ qua side-by-side */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-amber-200/60">
                                {onAddSecondaryPhone && analysis.canAddPhone2 && ord.customerPhone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ok = onAddSecondaryPhone(disc.customer.id, ord.customerPhone!);
                                      if (ok) {
                                        setRepairSuccessLog([
                                          `Đã lưu thêm SĐT 2 (${ord.customerPhone}) cho "${disc.customer.name}".`,
                                        ]);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                      analysis.recommendedAction === 'add_phone2'
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    <PlusCircle className="w-3 h-3" />
                                    <span>+ Lưu thành SĐT 2</span>
                                  </button>
                                )}

                                {onAddExtraAddress && analysis.canAddExtraAddress && ord.customerAddress && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const ok = onAddExtraAddress(disc.customer.id, ord.customerAddress!);
                                      if (ok) {
                                        setRepairSuccessLog([
                                          `Đã thêm địa chỉ phụ "${ord.customerAddress}" cho "${disc.customer.name}".`,
                                        ]);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                      analysis.recommendedAction === 'add_extra_address'
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                        : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    }`}
                                  >
                                    <PlusCircle className="w-3 h-3" />
                                    <span>+ Thêm làm Đ/C phụ</span>
                                  </button>
                                )}

                                {onRestoreFromOrder && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Khôi phục thông tin khách "${disc.customer.name}" theo đơn #${ord.id}?\n\n- Tên: ${ord.customerName || disc.customer.name}\n- SĐT: ${ord.customerPhone || disc.customer.phone}\n- ĐC: ${ord.customerAddress || disc.customer.address}`
                                        )
                                      ) {
                                        onRestoreFromOrder(disc.customer.id, ord.id);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                      analysis.recommendedAction === 'restore_order'
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                        : 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300'
                                    }`}
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    <span>Khôi phục theo đơn này</span>
                                  </button>
                                )}

                                {onSplitByHistoricalOrder && canSplitPhone && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (
                                        window.confirm(
                                          `Tách SĐT "${ord.customerPhone}" thành một khách hàng riêng biệt?\nCác đơn hàng dùng số này sẽ được tự động chuyển sang khách mới.`
                                        )
                                      ) {
                                        onSplitByHistoricalOrder(disc.customer.id, ord.customerPhone!);
                                      }
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
                                      analysis.recommendedAction === 'split_customer'
                                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-2xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                    }`}
                                  >
                                    <GitFork className="w-3 h-3" />
                                    <span>Tách thành 2 khách</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => acknowledgeDiscrepancyKeys([ackKey])}
                                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold transition flex items-center gap-1"
                                >
                                  <EyeOff className="w-3 h-3" />
                                  <span>Bỏ qua (Đã đúng)</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>Hệ thống Sentinel tự động giám sát danh bạ và cảnh báo ngay tại quầy POS.</span>
            {effectiveAckCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  onResetSentinelAcks?.();
                  setLocalToneAcks(new Set());
                  setLocalAddressAcks(new Set());
                  setLocalDiscrepancyAcks(new Set());
                }}
                className="text-amber-700 hover:underline font-bold"
              >
                Đặt lại các mục đã bỏ qua ({effectiveAckCount})
              </button>
            )}
          </div>
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
