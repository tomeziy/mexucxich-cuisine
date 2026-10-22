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
  RotateCcw,
  Sparkles,
  Download,
  Upload,
  Database,
  AlertTriangle,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Copy,
  ExternalLink,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  testSupabaseConnection,
  SUPABASE_SCHEMA_SQL,
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY,
} from '../services/supabase';

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
    receiptSettings,
    updateReceiptSettings,
    cloudConfig,
    updateCloudConfig,
    syncLocalToCloud,
    syncCloudToLocal,
    exportAllData,
    importAllData,
    resetToMockData,
  } = useStore();

  const [settings, setSettings] = useState<ReceiptSettings>(receiptSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Cloud Supabase states
  const [cloudUrl, setCloudUrl] = useState(cloudConfig.supabaseUrl || DEFAULT_SUPABASE_URL);
  const [cloudKey, setCloudKey] = useState(cloudConfig.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY);
  const [autoSync, setAutoSync] = useState(cloudConfig.autoSync ?? true);
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Tự động ghim cấu hình Cloud mặc định nếu máy tính/điện thoại chưa có
  React.useEffect(() => {
    if (!cloudUrl && (cloudConfig.supabaseUrl || DEFAULT_SUPABASE_URL)) {
      setCloudUrl(cloudConfig.supabaseUrl || DEFAULT_SUPABASE_URL);
    }
    if (!cloudKey && (cloudConfig.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY)) {
      setCloudKey(cloudConfig.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY);
    }
  }, [cloudConfig.supabaseUrl, cloudConfig.supabaseAnonKey]);

  const handleResetToDefaultCloud = () => {
    setCloudUrl(DEFAULT_SUPABASE_URL);
    setCloudKey(DEFAULT_SUPABASE_ANON_KEY);
    updateCloudConfig({
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      autoSync: true,
      lastSyncedAt: new Date().toISOString(),
    });
    setCloudStatus({ success: true, message: 'Đã kết nối lại tài khoản Cloud chính thức của tiệm MexucxichCuisine!' });
  };

  const handleTestCloud = async () => {
    setCloudTesting(true);
    setCloudStatus(null);
    try {
      const res = await testSupabaseConnection(cloudUrl.trim(), cloudKey.trim());
      setCloudStatus(res);
      if (res.success) {
        updateCloudConfig({
          supabaseUrl: cloudUrl.trim(),
          supabaseAnonKey: cloudKey.trim(),
          autoSync,
          lastSyncedAt: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      setCloudStatus({ success: false, message: e.message || 'Lỗi không xác định' });
    } finally {
      setCloudTesting(false);
    }
  };

  const handleSaveCloudSettings = () => {
    updateCloudConfig({
      supabaseUrl: cloudUrl.trim(),
      supabaseAnonKey: cloudKey.trim(),
      autoSync,
      lastSyncedAt: cloudConfig.lastSyncedAt,
    });
    alert('Đã lưu cấu hình kết nối Cloud Supabase!');
  };

  const handlePushCloud = async () => {
    if (!cloudUrl.trim() || !cloudKey.trim()) {
      alert('Vui lòng nhập URL và Anon Key trước khi đẩy dữ liệu!');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncLocalToCloud();
      alert(res.message);
    } catch (e: any) {
      alert(`Đồng bộ thất bại: ${e.message || e}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullCloud = async () => {
    if (!cloudUrl.trim() || !cloudKey.trim()) {
      alert('Vui lòng nhập URL và Anon Key trước khi tải dữ liệu!');
      return;
    }
    if (!window.confirm('Hành động này sẽ tải toàn bộ dữ liệu từ Cloud về máy và ghi đè dữ liệu hiện tại trên trình duyệt này. Bạn có chắc chắn?')) {
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncCloudToLocal();
      alert(res.message);
      window.location.reload();
    } catch (e: any) {
      alert(`Tải dữ liệu thất bại: ${e.message || e}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 3000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
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
        if (importAllData(json)) {
          alert('Khôi phục toàn bộ dữ liệu thành công!');
          window.location.reload();
        } else {
          alert('Tệp sao lưu không đúng cấu trúc!');
        }
      } catch {
        alert('Lỗi định dạng tệp JSON!');
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (window.confirm('CẢNH BÁO: Hành động này sẽ đặt lại toàn bộ sản phẩm, khách hàng và xóa lịch sử đơn hàng về dữ liệu mẫu ban đầu. Bạn có chắc chắn?')) {
      resetToMockData();
      alert('Đã khôi phục dữ liệu về mặc định ban đầu!');
      window.location.reload();
    }
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

            {/* Font Family Selection (Arial vs System) */}
            <div className="pt-2 border-t border-slate-100 text-xs">
              <label className="font-bold text-slate-700 block mb-1.5">Phông chữ in nhiệt:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, fontFamily: 'arial' })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    (settings.fontFamily || 'arial') === 'arial'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <strong className="block text-xs font-bold">Arial (Khuyên dùng in nhiệt)</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Nét chữ thanh mảnh, triệt tiêu bết dính mực ở 203 DPI
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, fontFamily: 'system' })}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    settings.fontFamily === 'system'
                      ? 'border-amber-500 bg-amber-50/50 text-amber-900 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <strong className="block text-xs font-bold">Phông hệ thống</strong>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Phông web mặc định của hệ điều hành
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

          {/* Cloud Database Sync (ADR-0006) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-blue-500" />
                <span>Đồng bộ Cloud Supabase (Cửa hàng & Nhà)</span>
              </h3>
              <div className="flex items-center gap-1.5">
                {cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Đã kết nối Cloud chính của quán</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Chưa kết nối Cloud (Đang chạy Offline)
                  </span>
                )}
                <button
                  type="button"
                  onClick={handleResetToDefaultCloud}
                  className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full transition flex items-center gap-1"
                  title="Nhấn để tự động khôi phục cấu hình Cloud chính thức của tiệm MexucxichCuisine mà không cần nhập tay"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  <span>Dùng Cloud chuẩn của Quán</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-500">
              Đồng bộ dữ liệu thời gian thực giữa máy tính ở cửa hàng và điện thoại/máy ở nhà qua dịch vụ cơ sở dữ liệu Supabase miễn phí. Dễ dàng chuyển giao toàn bộ tài khoản cho Hằng.
            </p>

            <div className="space-y-2.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  value={cloudUrl}
                  onChange={e => setCloudUrl(e.target.value)}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Anon Public Key
                </label>
                <input
                  type="password"
                  value={cloudKey}
                  onChange={e => setCloudKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoSync}
                    onChange={e => setAutoSync(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500"
                  />
                  <span>Tự động đồng bộ khi mở ứng dụng (Auto-sync)</span>
                </label>

                {cloudConfig.lastSyncedAt && (
                  <span className="text-[10px] text-slate-400">
                    Lần đồng bộ gần nhất: {new Date(cloudConfig.lastSyncedAt).toLocaleString('vi-VN')}
                  </span>
                )}
              </div>

              {/* Status message */}
              {cloudStatus && (
                <div
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                    cloudStatus.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {cloudStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{cloudStatus.message}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-bold">
                <button
                  type="button"
                  onClick={handleTestCloud}
                  disabled={cloudTesting}
                  className="py-2 px-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition flex items-center justify-center gap-1.5 text-center disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${cloudTesting ? 'animate-spin' : ''}`} />
                  <span>{cloudTesting ? 'Đang kiểm tra...' : 'Kiểm tra kết nối'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveCloudSettings}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-1.5 text-center"
                >
                  <Save className="w-3.5 h-3.5 text-amber-600" />
                  <span>Lưu cấu hình</span>
                </button>

                <button
                  type="button"
                  onClick={handlePushCloud}
                  disabled={isSyncing}
                  className="py-2 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-2xs transition flex items-center justify-center gap-1.5 text-center disabled:opacity-50"
                  title="Đẩy toàn bộ món ăn, khách hàng, đơn hàng hiện tại lên Supabase"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  <span>Đẩy lên Cloud</span>
                </button>

                <button
                  type="button"
                  onClick={handlePullCloud}
                  disabled={isSyncing}
                  className="py-2 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-1.5 text-center disabled:opacity-50"
                  title="Tải toàn bộ dữ liệu từ Cloud về máy này"
                >
                  <CloudDownload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Tải từ Cloud về</span>
                </button>
              </div>

              {/* Handover & SQL Helper dropdown */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowSqlGuide(!showSqlGuide)}
                  className="text-slate-500 hover:text-slate-800 text-[11px] font-bold flex items-center gap-1 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Hướng dẫn tạo tài khoản Supabase & mã SQL tạo bảng (1 phút)</span>
                </button>

                {showSqlGuide && (
                  <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px] text-slate-600">
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Đăng nhập <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-amber-600 font-bold underline inline-flex items-center gap-0.5">supabase.com <ExternalLink className="w-2.5 h-2.5" /></a> bằng Google (miễn phí 100%).</li>
                      <li>Tạo New Project (Đặt tên: <code>mexucxich-cuisine</code>, chọn mật khẩu database).</li>
                      <li>Vào mục <strong>SQL Editor</strong> ở thanh menu bên trái, dán đoạn mã SQL bên dưới và ấn <strong>Run</strong>.</li>
                      <li>Vào <strong>Project Settings &rarr; Data API</strong>, sao chép <code>Project URL</code> và <code>anon public key</code> dán vào 2 ô bên trên.</li>
                    </ol>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-mono text-[10px] text-slate-400">Tệp: supabase_schema.sql (5 bảng chuẩn)</span>
                      <button
                        type="button"
                        onClick={handleCopySql}
                        className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-bold flex items-center gap-1 transition"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{copiedSql ? '✓ Đã sao chép SQL!' : 'Sao chép mã SQL'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Backup & Restore Card (ADR-0001) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-500" />
                <span>Sao lưu & Khôi phục dữ liệu (1-Click)</span>
              </h3>
              <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                LocalStorage Offline
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Xuất toàn bộ danh mục sản phẩm, khách hàng, dư nợ và đơn hàng thành file JSON an toàn. Không phụ thuộc máy chủ, không lo mất mạng.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs font-bold">
              <button
                type="button"
                onClick={handleBackup}
                className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Sao lưu toàn bộ (JSON)</span>
              </button>

              <label className="py-2.5 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-blue-600" />
                <span>Khôi phục từ file</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Kiểm thử lại với dữ liệu ban đầu?</span>
              <button
                type="button"
                onClick={handleResetData}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold hover:underline flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại dữ liệu mẫu</span>
              </button>
            </div>
          </div>
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
          className={settings.fontFamily === 'system' ? 'font-system' : 'font-arial'}
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
