import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../context/StoreContext';
import { PaperSize, ReceiptSettings, PrintFontSize, PrintCopies, Order } from '../types';
import { formatVND } from '../utils/format';
import { ThermalReceipt } from '../components/pos/ThermalReceipt';
import {
  Settings,
  Printer,
  QrCode,
  Store,
  Check,
  Save,
  Sparkles,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Copy,
  HelpCircle,
  CheckCircle2,
  Lock,
  KeyRound,
  ShieldCheck,
  UserPlus,
  LogOut,
  Shield,
} from 'lucide-react';
import { SUPABASE_SCHEMA_SQL } from '../services/supabase';
import type { StoreRole } from '../utils/auth';

const VIETNAM_BANKS = [
  { code: 'MB', name: 'MB Bank (Ngân hàng Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank (Ngoại thương Việt Nam)' },
  { code: 'TCB', name: 'Techcombank (Kỹ Thương Việt Nam)' },
  { code: 'VPB', name: 'VPBank (Việt Nam Thịnh Vượng)' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'CTG', name: 'VietinBank (Công Thương Việt Nam)' },
  { code: 'BIDV', name: 'BIDV (Đầu tư & Phát triển Việt Nam)' },
  { code: 'VBA', name: 'Agribank (Nông nghiệp & PT Nông thôn)' },
  { code: 'TPB', name: 'TPBank (Tiên Phong)' },
  { code: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { code: 'HDB', name: 'HDBank (Phát triển TP.HCM)' },
  { code: 'OCB', name: 'OCB (Phương Đông)' },
  { code: 'MSB', name: 'MSB (Hàng Hải)' },
  { code: 'VIB', name: 'VIB (Quốc Tế)' },
  { code: 'LPB', name: 'LPBank (Lộc Phát Việt Nam)' },
  { code: 'SHB', name: 'SHB (Sài Gòn - Hà Nội)' },
];

const SAMPLE_ORDER: Order = {
  id: 'HD-SAMPLE',
  createdAt: '2026-09-15T15:30:00Z',
  customerId: 'KH-SAMPLE',
  customerName: 'Chị Lan (Zalo Đội Cấn)',
  customerPhone: '0988123456',
  customerAddress: '12 Đội Cấn, Ba Đình, Hà Nội',
  orderType: 'delivery',
  status: 'completed',
  items: [
    {
      productId: 'SP01',
      name: 'Xúc xích Heo Thảo Mộc Phô Mai Mozzarella',
      unit: 'Gói 500g',
      price: 145000,
      cost: 95000,
      qty: 1,
      image: '🌭',
    },
    {
      productId: 'SP02',
      name: 'Lõi vai bò vân tuyết Aukobe (Cân ký lẻ)',
      unit: 'kg',
      price: 380000,
      cost: 260000,
      qty: 0.59,
      image: '🥩',
    },
    {
      productId: 'SP03',
      name: 'Pate Gan Gà Nấm Truffle Thượng Hạng',
      unit: 'Hũ 250g',
      price: 120000,
      cost: 75000,
      qty: 1,
      image: '🥣',
    },
  ],
  subtotal: 489200,
  discountType: 'cash',
  discountValue: 0,
  discountAmount: 0,
  shippingFee: 25000,
  shippingNote: 'Giao giờ hành chính, gọi trước khi đến',
  total: 514200,
  paymentMethod: 'transfer',
  paidAmount: 514200,
  debtAmount: 0,
};

export const SettingsPage: React.FC = () => {
  const {
    products,
    customers,
    orders,
    debtPayments,
    receiptSettings,
    updateReceiptSettings,
    exportAllData,
    importAllData,
    currentUser,
    changeOwnPassword,
    adminManageStoreUser,
    logoutOrLockScreen,
  } = useStore();

  const isAdmin = currentUser?.role === 'admin';

  const [settings, setSettings] = useState<ReceiptSettings>(receiptSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const lastAppliedReceiptSettingsRef = React.useRef(JSON.stringify(receiptSettings));

  React.useEffect(() => {
    const incomingJson = JSON.stringify(receiptSettings);
    if (incomingJson !== lastAppliedReceiptSettingsRef.current) {
      setSettings(prev =>
        JSON.stringify(prev) === lastAppliedReceiptSettingsRef.current ? receiptSettings : prev
      );
      lastAppliedReceiptSettingsRef.current = incomingJson;
    }
  }, [receiptSettings]);

  // Personal password change states
  const [newOwnPassword, setNewOwnPassword] = useState('');
  const [confirmOwnPassword, setConfirmOwnPassword] = useState('');
  const [ownPassSaving, setOwnPassSaving] = useState(false);
  const [ownPassStatus, setOwnPassStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  // Admin-only account creation / password reset & SQL setup helper states
  const [targetUsername, setTargetUsername] = useState('');
  const [targetPassword, setTargetPassword] = useState('');
  const [targetRole, setTargetRole] = useState<StoreRole>('staff');
  const [adminUserSaving, setAdminUserSaving] = useState(false);
  const [adminUserStatus, setAdminUserStatus] = useState<{
    success?: boolean;
    message?: string;
    needsEdgeDeploy?: boolean;
  } | null>(null);
  const [showAdminInfraGuide, setShowAdminInfraGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleChangeOwnPassword = async () => {
    setOwnPassStatus(null);
    if (newOwnPassword.trim().length < 6) {
      setOwnPassStatus({ success: false, message: 'Mật khẩu mới cần tối thiểu 6 ký tự!' });
      return;
    }
    if (newOwnPassword !== confirmOwnPassword) {
      setOwnPassStatus({ success: false, message: 'Mật khẩu nhập lại chưa khớp!' });
      return;
    }
    setOwnPassSaving(true);
    try {
      const res = await changeOwnPassword(newOwnPassword);
      setOwnPassStatus(res);
      if (res.success) {
        setNewOwnPassword('');
        setConfirmOwnPassword('');
      }
    } finally {
      setOwnPassSaving(false);
    }
  };

  const handleAdminManageUser = async () => {
    setAdminUserStatus(null);
    if (!targetUsername.trim() || targetPassword.trim().length < 6) {
      setAdminUserStatus({
        success: false,
        message: 'Nhập Tên đăng nhập và Mật khẩu (>= 6 ký tự)!',
      });
      return;
    }
    setAdminUserSaving(true);
    try {
      const res = await adminManageStoreUser({
        username: targetUsername.trim(),
        password: targetPassword,
        role: targetRole,
      });
      setAdminUserStatus(res);
      if (res.success) {
        setTargetUsername('');
        setTargetPassword('');
      }
    } finally {
      setAdminUserSaving(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    lastAppliedReceiptSettingsRef.current = JSON.stringify(settings);
    updateReceiptSettings(settings);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleBackup = () => {
    const data = exportAllData();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mexucxich_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json || typeof json !== 'object') {
          alert('Tệp sao lưu không đúng cấu trúc!');
          return;
        }

        const inProds = Array.isArray(json.products) ? json.products.length : 0;
        const inCusts = Array.isArray(json.customers) ? json.customers.length : 0;
        const inOrders = Array.isArray(json.orders) ? json.orders.length : 0;
        const inDebts = Array.isArray(json.debtPayments) ? json.debtPayments.length : 0;
        const exportedLabel = json.exportedAt
          ? new Date(json.exportedAt).toLocaleString('vi-VN')
          : 'Không rõ thời gian';

        const confirmSummary =
          `KIỂM TRA ĐỐI SOÁT TRƯỚC KHI KHÔI PHỤC FILE JSON (${file.name})\n` +
          `Ngày xuất sao lưu: ${exportedLabel}\n\n` +
          `• Món ăn: File có ${inProds} món (Hiện tại: ${products.length} món)\n` +
          `• Khách hàng: File có ${inCusts} khách (Hiện tại: ${customers.length} khách)\n` +
          `• Đơn hàng: File có ${inOrders} đơn (Hiện tại: ${orders.length} đơn)\n` +
          `• Phiếu thu nợ: File có ${inDebts} phiếu (Hiện tại: ${debtPayments.length} phiếu)\n\n` +
          `Hệ thống sẽ HỢP NHẤT AN TOÀN (không xóa mất dữ liệu mới hơn hiện có và tự lọc món demo SP01–SP08). Tiếp tục?`;

        if (!window.confirm(confirmSummary)) {
          return;
        }

        if (importAllData(json)) {
          alert(
            'Đã gộp và khôi phục dữ liệu từ file JSON an toàn!\n- Toàn bộ món ăn và đơn hàng mới hiện có vẫn được giữ nguyên.\n- Các món demo cũ (SP01–SP08) đã tự động loại bỏ và đang đồng bộ lên Cloud.'
          );
        } else {
          alert('Tệp sao lưu không đúng cấu trúc!');
        }
      } catch {
        alert('Lỗi định dạng tệp JSON!');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleTestPrint = () => {
    window.print();
  };

  const printRoot = typeof document !== 'undefined' ? document.getElementById('print-root') : null;

  const paperWidthStyle =
    settings.paperSize === 'k57'
      ? 'w-[57mm]'
      : settings.paperSize === 'a5'
      ? 'w-[148mm]'
      : settings.paperSize === 'a4'
      ? 'w-[210mm]'
      : 'w-[80mm]'; // default k80

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <span>Cài đặt Mẫu Hóa đơn & VietQR</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tùy biến thông tin cửa hàng, khổ in nhiệt và mã VietQR chuẩn Napas 24/7
          </p>
        </div>

        <div className="flex items-center gap-2">
          {savedSuccess && (
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>Đã lưu thành công!</span>
            </span>
          )}

          <button
            type="button"
            onClick={handleTestPrint}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>In thử ({settings.paperSize.toUpperCase()})</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column: Form (Left) + Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT: FORM SETTINGS (7 Cols) */}
        <form onSubmit={handleSave} className="lg:col-span-7 space-y-4">
          {/* Store Info Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-amber-500" />
              <span>Thông tin cửa hàng</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Tên cửa hàng</label>
                <input
                  type="text"
                  value={settings.storeName}
                  onChange={e => setSettings({ ...settings, storeName: e.target.value })}
                  placeholder="MexucxichCuisine"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Khẩu hiệu / Phụ đề</label>
                <input
                  type="text"
                  value={settings.storeSubtitle}
                  onChange={e => setSettings({ ...settings, storeSubtitle: e.target.value })}
                  placeholder="Ẩm thực Thủ công & Đặc sản Tuyển chọn"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Số hotline / Zalo</label>
                <input
                  type="text"
                  value={settings.hotline}
                  onChange={e => setSettings({ ...settings, hotline: e.target.value })}
                  placeholder="0904047976"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Facebook / Thông tin liên hệ in trên bill</label>
                <input
                  type="text"
                  value={settings.facebook || ''}
                  onChange={e => setSettings({ ...settings, facebook: e.target.value })}
                  placeholder="Hoàng Minh Hằng - 0904047976"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Địa chỉ cửa hàng (nếu có)</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={e => setSettings({ ...settings, address: e.target.value })}
                  placeholder="Để trống nếu chỉ bán online"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Lời cảm ơn chân trang (Footer)</label>
                <input
                  type="text"
                  value={settings.footerMessage}
                  onChange={e => setSettings({ ...settings, footerMessage: e.target.value })}
                  placeholder="Chúc quý khách có một bữa ăn hạnh phúc!"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Paper Size & Print Configuration Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Printer className="w-3.5 h-3.5 text-amber-500" />
              <span>Cấu hình In ấn (Khổ giấy, Số liên & Cỡ chữ)</span>
            </h3>

            {/* Paper Size Selection */}
            <div>
              <label className="font-bold text-slate-700 text-xs block mb-1.5">Khổ giấy in:</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { id: 'k80', name: 'K80 (80mm)', desc: 'Máy in nhiệt quầy chuẩn KiotViet' },
                  { id: 'k57', name: 'K57 (57mm)', desc: 'Máy in hóa đơn cầm tay mini' },
                  { id: 'a5', name: 'A5 (148mm)', desc: 'Khổ in phiếu bán sỉ nhỏ' },
                  { id: 'a4', name: 'A4 (210mm)', desc: 'Khổ giấy in văn phòng tiêu chuẩn' },
                ].map(paper => (
                  <button
                    key={paper.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, paperSize: paper.id as PaperSize })}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                      settings.paperSize === paper.id
                        ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <strong className="block text-xs">{paper.name}</strong>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">{paper.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Number of Copies & Font Size */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
              {/* Copies Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Số liên in:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, printCopies: 1 })}
                    className={`p-2.5 rounded-xl border text-center font-bold transition ${
                      (settings.printCopies || 1) === 1
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">1 liên (Mặc định)</div>
                    <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Tiết kiệm giấy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, printCopies: 2 })}
                    className={`p-2.5 rounded-xl border text-center font-bold transition ${
                      settings.printCopies === 2
                        ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="text-xs">2 liên</div>
                    <span className="text-[10px] text-slate-400 font-normal block mt-0.5">Lưu quầy & Giao khách</span>
                  </button>
                </div>
              </div>

              {/* Delivery Callout Header Size Selection (ADR-0011) */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 block text-xs">
                    Khối thông tin người nhận cho Shipper:
                  </label>
                  <span className="text-[10px] font-extrabold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    ADR-0011 Mới
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, deliveryCalloutSize: 'standard_large' })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      (settings.deliveryCalloutSize || 'standard_large') === 'standard_large'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs font-bold text-slate-900">
                        🌟 Khuyên dùng cho Shipper (To rõ - Tiết kiệm giấy)
                      </strong>
                      <span className="text-[10px] font-black px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded shrink-0 ml-1">
                        ~15px
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      To rõ gấp ~1.5x cỡ bill • font-black • Ngắt dòng tối ưu, bill chỉ dài thêm ~1cm giấy
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, deliveryCalloutSize: 'extra_large' })}
                    className={`p-2.5 rounded-xl border text-left transition ${
                      settings.deliveryCalloutSize === 'extra_large'
                        ? 'border-amber-500 bg-amber-50 text-amber-950 shadow-xs ring-1 ring-amber-500'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <strong className="text-xs font-bold text-slate-900">
                        🔍 Cỡ Đại nổi bật
                      </strong>
                      <span className="text-[10px] font-black px-1.5 py-0.5 bg-purple-200 text-purple-900 rounded shrink-0 ml-1">
                        ~18px
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Cực kỳ to rõ gấp ~1.8x • Dễ đọc khi chạy xe máy • Kiểm soát line-height chống tràn lề K80
                    </span>
                  </button>
                </div>
              </div>

              {/* Simplified Whole-Bill Font Size */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-700 block text-xs">Cỡ chữ danh sách món & tổng tiền:</label>
                  <span className="text-[10px] text-slate-400">Mặc định: Nhỏ (Tiết kiệm giấy in)</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'small', name: 'Nhỏ (11.5px)', desc: '🌟 Tiết kiệm giấy' },
                    { id: 'medium', name: 'Vừa (13.5px)', desc: 'Chuẩn KiotViet' },
                    { id: 'large', name: 'To (16px)', desc: 'Chữ to toàn bill' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, fontSize: f.id as PrintFontSize })}
                      className={`p-2 rounded-xl border text-center font-bold transition ${
                        (settings.fontSize || 'small') === f.id
                          ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs ring-1 ring-amber-500'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs">{f.name}</div>
                      <span className="text-[9px] text-slate-400 font-normal block mt-0.5">{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Font Family Selection (Plus Jakarta Sans vs Arial vs System) */}
            <div className="pt-2 border-t border-slate-100 text-xs">
              <label className="font-bold text-slate-700 block mb-1.5">Phông chữ in nhiệt:</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, fontFamily: 'plus_jakarta' })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    (settings.fontFamily || 'plus_jakarta') === 'plus_jakarta'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs ring-1 ring-amber-400'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <strong className="block text-xs font-bold text-amber-700">🌟 Plus Jakarta Sans (Khuyên dùng)</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Sắc nét, không lỗi dấu tiếng Việt, triệt tiêu nhòe mực
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, fontFamily: 'arial' })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    settings.fontFamily === 'arial'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs ring-1 ring-amber-400'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <strong className="block text-xs font-bold">Arial (Truyền thống)</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Nét mảnh chuẩn in hóa đơn văn phòng
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, fontFamily: 'system' })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    settings.fontFamily === 'system'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs ring-1 ring-amber-400'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <strong className="block text-xs font-bold">Phông hệ thống</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Mặc định của trình duyệt / máy POS
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* VietQR Bank Account Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-blue-500" />
              <span>Cấu hình Ngân hàng nhận thanh toán (VietQR)</span>
            </h3>

            <div className="text-xs space-y-3">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Ngân hàng</label>
                <select
                  value={settings.bankCode}
                  onChange={e => setSettings({ ...settings, bankCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-bold text-slate-800 focus:outline-none"
                >
                  {VIETNAM_BANKS.map(b => (
                    <option key={b.code} value={b.code}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Số tài khoản ngân hàng</label>
                  <input
                    type="text"
                    value={settings.bankAccount}
                    onChange={e => setSettings({ ...settings, bankAccount: e.target.value })}
                    placeholder="0859136899"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tên chủ tài khoản (không dấu)</label>
                  <input
                    type="text"
                    value={settings.bankAccountName}
                    onChange={e => setSettings({ ...settings, bankAccountName: e.target.value.toUpperCase() })}
                    placeholder="BUI THI TUYET MAI"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 uppercase font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Ghi chú chuyển khoản (in dưới STK)</label>
                <input
                  type="text"
                  value={settings.bankNote || ''}
                  onChange={e => setSettings({ ...settings, bankNote: e.target.value })}
                  placeholder="Nội dung: ghi rõ tên / Facebook / Sđt và gửi bill cho chủ shop ạ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Display Toggles Card */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400">
              Các trường hiển thị trên hóa đơn
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <span className="font-bold text-slate-800">Hiển thị Logo / Biểu tượng tiệm</span>
                <input
                  type="checkbox"
                  checked={settings.showLogo}
                  onChange={e => setSettings({ ...settings, showLogo: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <span className="font-bold text-slate-800">Hiển thị Thông tin Khách hàng</span>
                <input
                  type="checkbox"
                  checked={settings.showCustomer}
                  onChange={e => setSettings({ ...settings, showCustomer: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <span className="font-bold text-slate-800">Hiển thị Tên thu ngân / nhân viên</span>
                <input
                  type="checkbox"
                  checked={settings.showStaff}
                  onChange={e => setSettings({ ...settings, showStaff: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <span className="font-bold text-slate-800">In kèm mã VietQR Napas</span>
                <input
                  type="checkbox"
                  checked={settings.showVietQR}
                  onChange={e => setSettings({ ...settings, showVietQR: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">Hiển thị Hình thức đơn (Tại chỗ / Ship)</span>
                  <span className="text-[10px] text-slate-400">Mặc định tắt để hóa đơn ngắn gọn</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.showOrderType}
                  onChange={e => setSettings({ ...settings, showOrderType: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">Hiển thị Phương thức thanh toán</span>
                  <span className="text-[10px] text-slate-400">Tiền mặt / Chuyển khoản / Ghi nợ 100%</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.showPaymentMethod}
                  onChange={e => setSettings({ ...settings, showPaymentMethod: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer">
                <div>
                  <span className="font-bold text-slate-800 block">Hiển thị Chi tiết số tiền Ghi nợ</span>
                  <span className="text-[10px] text-slate-400">Dòng "Ghi nợ đơn này: +...đ"</span>
                </div>
                <input
                  type="checkbox"
                  checked={!!settings.showDebtInfo}
                  onChange={e => setSettings({ ...settings, showDebtInfo: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/20 transition flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>Lưu tất cả cài đặt hóa đơn</span>
          </button>

          {/* Account & Security Card (ADR-0025 - clean for Hang & Admin) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Tài khoản & Bảo mật đăng nhập</span>
              </h3>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                  isAdmin
                    ? 'bg-slate-900 text-amber-300'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {currentUser
                  ? `${currentUser.username} • ${isAdmin ? 'Admin Hệ thống' : 'Chủ quán'}`
                  : 'Đã đăng nhập'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Mật khẩu mới</label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={newOwnPassword}
                    onChange={e => setNewOwnPassword(e.target.value)}
                    placeholder="Ít nhất 6 ký tự..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nhập lại mật khẩu mới</label>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmOwnPassword}
                  onChange={e => setConfirmOwnPassword(e.target.value)}
                  placeholder="Xác nhận mật khẩu mới..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            {ownPassStatus && (
              <div
                className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  ownPassStatus.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {ownPassStatus.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{ownPassStatus.message}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-bold">
              <button
                type="button"
                onClick={handleChangeOwnPassword}
                disabled={ownPassSaving}
                className="flex-1 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{ownPassSaving ? 'Đang cập nhật...' : 'Đổi mật khẩu tài khoản này'}</span>
              </button>
              <button
                type="button"
                onClick={() => logoutOrLockScreen()}
                className="py-2.5 px-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 text-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

          {/* Backup & Restore Card (Retained cleanly for JSON/Backup workflows per user Q3A) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span>Sao lưu & Nhập tệp dự phòng (JSON)</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                Cloud Backup
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Tải về bản sao lưu toàn bộ thực đơn, khách hàng, công nợ và đơn hàng dạng JSON để lưu trữ ngoài, hoặc nạp lại có kiểm tra đối soát trước khi gộp.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs font-bold">
              <button
                type="button"
                onClick={handleBackup}
                className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Xuất file Sao lưu (JSON)</span>
              </button>

              <label className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Nhập file Sao lưu (JSON)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Admin-Only Console: Edge Function User Creation & Database Security SQL */}
          {isAdmin && (
            <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl border border-slate-800 shadow-md space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  <span>Quản trị Tài khoản & Bảo mật (Chỉ Admin)</span>
                </h3>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  admin tools
                </span>
              </div>

              <p className="text-xs text-slate-300">
                Tạo tài khoản nhân viên mới hoặc đặt lại mật khẩu cho Hằng (<code>mexucxich</code>) trực tiếp qua Supabase Edge Function <code>create-store-user</code>.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Tên đăng nhập</label>
                  <input
                    type="text"
                    value={targetUsername}
                    onChange={e => setTargetUsername(e.target.value)}
                    placeholder="vd: nhanvien1 hoặc mexucxich"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Mật khẩu</label>
                  <input
                    type="text"
                    value={targetPassword}
                    onChange={e => setTargetPassword(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-300 block mb-1">Vai trò</label>
                  <select
                    value={targetRole}
                    onChange={e => setTargetRole(e.target.value as StoreRole)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                  >
                    <option value="staff">Nhân viên</option>
                    <option value="owner">Chủ quán (Hằng)</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              {adminUserStatus && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
                    adminUserStatus.success
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-200'
                      : 'bg-rose-950/60 border-rose-700 text-rose-200'
                  }`}
                >
                  {adminUserStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  )}
                  <span>{adminUserStatus.message}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleAdminManageUser}
                disabled={adminUserSaving}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <UserPlus className="w-4 h-4" />
                <span>{adminUserSaving ? 'Đang xử lý...' : 'Tạo tài khoản / Đặt lại mật khẩu ngay'}</span>
              </button>

              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAdminInfraGuide(!showAdminInfraGuide)}
                  className="text-slate-300 hover:text-amber-300 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Cài đặt khóa bảo mật RLS + Edge Function (1 lần duy nhất)</span>
                </button>

                {showAdminInfraGuide && (
                  <div className="mt-2 p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-2 text-[11px] text-slate-300">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Mở Supabase SQL Editor, dán mã SQL và nhấn <strong>Run</strong> để tạo sẵn user <code>mexucxich</code> / <code>admin</code> và khóa RLS <code>authenticated</code>.</li>
                      <li>Deploy Edge Function <code>supabase/functions/create-store-user/index.ts</code> (<code>supabase functions deploy create-store-user</code>) để nút tạo tài khoản bên trên hoạt động vĩnh viễn.</li>
                    </ol>
                    <button
                      type="button"
                      onClick={handleCopySql}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-600 hover:border-amber-400 text-amber-300 font-bold inline-flex items-center gap-1.5 transition"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedSql ? '✓ Đã sao chép SQL khóa bảo mật!' : 'Sao chép SQL (supabase_schema.sql)'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </form>

        {/* RIGHT: LIVE PREVIEW (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center sticky top-[72px]">
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-100 text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Xem trước hóa đơn trực quan (Live)</span>
            </span>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600">
              {settings.paperSize.toUpperCase()}
            </span>
          </div>

          {/* Paper Container */}
          <div className="w-full overflow-x-auto custom-scroll flex justify-center bg-slate-100 p-4 rounded-xl">
            <div
              id="thermal-receipt-preview"
              className={`${paperWidthStyle} bg-white p-4 text-slate-900 font-sans border-t-4 border-amber-500 rounded-xs shadow-sm`}
              style={{
                fontSize: `${
                  settings.fontSize === 'large' ? 16 : settings.fontSize === 'medium' ? 13.5 : 11.5
                }px`,
                lineHeight: 1.35,
              }}
            >
              {settings.printCopies === 2 ? (
                <div>
                  <ThermalReceipt order={SAMPLE_ORDER} settings={settings} copyTitle="LIÊN 1: LƯU BẾP / QUẦY" isPreview />
                  <div className="my-5 py-2 border-b-2 border-dashed border-slate-400 text-center text-[10px] font-bold text-slate-400 uppercase tracking-normal">
                    ✂ - - - - - - - CẮT TẠI ĐÂY - - - - - - - ✂
                  </div>
                  <ThermalReceipt order={SAMPLE_ORDER} settings={settings} copyTitle="LIÊN 2: GIAO KHÁCH" isPreview />
                </div>
              ) : (
                <ThermalReceipt order={SAMPLE_ORDER} settings={settings} isPreview />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real Thermal Print Portal for Settings Test Print */}
      {printRoot && createPortal(
        <div
          className={settings.fontFamily === 'system' ? 'font-system' : settings.fontFamily === 'arial' ? 'font-arial' : 'font-plus-jakarta'}
          style={{
            fontSize: `${
              settings.fontSize === 'large' ? 16 : settings.fontSize === 'medium' ? 13.5 : 11.5
            }px`,
            lineHeight: 1.35,
            width: settings.paperSize === 'k57' ? '57mm' : '80mm',
          }}
        >
          {settings.printCopies === 2 ? (
            <>
              <div className="thermal-print-copy has-next-copy">
                <ThermalReceipt order={SAMPLE_ORDER} settings={settings} copyTitle="LIÊN 1: LƯU BẾP / QUẦY" />
                <div style={{ height: '6mm' }} />
              </div>
              <div className="thermal-print-copy">
                <ThermalReceipt order={SAMPLE_ORDER} settings={settings} copyTitle="LIÊN 2: GIAO CHO KHÁCH" />
                <div style={{ height: '6mm' }} />
              </div>
            </>
          ) : (
            <div className="thermal-print-copy">
              <ThermalReceipt order={SAMPLE_ORDER} settings={settings} />
              <div style={{ height: '6mm' }} />
            </div>
          )}
        </div>,
        printRoot
      )}
    </div>
  );
};
