import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { PaperSize, ReceiptSettings, PrintFontSize, PrintCopies } from '../types';
import { formatVND } from '../utils/format';
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
import { testSupabaseConnection, SUPABASE_SCHEMA_SQL } from '../services/supabase';

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
  const [cloudUrl, setCloudUrl] = useState(cloudConfig.supabaseUrl || '');
  const [cloudKey, setCloudKey] = useState(cloudConfig.supabaseAnonKey || '');
  const [autoSync, setAutoSync] = useState(cloudConfig.autoSync ?? true);
  const [cloudTesting, setCloudTesting] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSqlGuide, setShowSqlGuide] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

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

  // Live VietQR preview URL
  const sampleAmount = 265000;
  const qrUrl = settings.bankAccount && settings.bankCode
    ? `https://img.vietqr.io/image/${settings.bankCode}-${settings.bankAccount}-compact2.png?amount=${sampleAmount}&addInfo=HD-MAU&accountName=${encodeURIComponent(settings.bankAccountName || '')}`
    : '';

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

              {/* Font Size Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1.5">Cỡ chữ hóa đơn in:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'small', name: 'Nhỏ', desc: '11px' },
                    { id: 'medium', name: 'Vừa', desc: '13px (KiotViet)' },
                    { id: 'large', name: 'To', desc: '15px (Rõ nét)' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSettings({ ...settings, fontSize: f.id as PrintFontSize })}
                      className={`p-2 rounded-xl border text-center font-bold transition ${
                        (settings.fontSize || 'medium') === f.id
                          ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
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
              <div className="flex items-center gap-1">
                {cloudConfig.supabaseUrl && cloudConfig.supabaseAnonKey ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Đã kết nối Cloud</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                    Chưa kết nối Cloud (Đang chạy Offline)
                  </span>
                )}
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
                  settings.fontSize === 'small' ? 11.5 : settings.fontSize === 'large' ? 16 : 13.5
                }px`,
                lineHeight: 1.35,
              }}
            >
              {(() => {
                const renderPreviewContent = (copyLabel?: string) => (
                  <div className="space-y-2 text-black leading-snug font-sans">
                    {copyLabel && (
                      <div className="text-center pb-1 border-b border-dashed border-black">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded border border-black font-black text-black tracking-wider uppercase"
                          style={{ fontSize: '0.85em' }}
                        >
                          {copyLabel}
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className="text-center pb-2 border-b border-dashed border-black space-y-0.5">
                      {settings.showLogo && <div className="mb-1 leading-none text-black" style={{ fontSize: '1.6em' }}>🌭</div>}
                      <h2 className="font-black uppercase tracking-wider text-black leading-tight" style={{ fontSize: '1.28em' }}>
                        {settings.storeName || 'MEXUCXICH CUISINE'}
                      </h2>
                      {settings.storeSubtitle && (
                        <p className="text-black font-semibold italic leading-tight" style={{ fontSize: '0.88em' }}>{settings.storeSubtitle}</p>
                      )}
                      {settings.facebook && (
                        <p className="text-black font-bold leading-tight" style={{ fontSize: '0.92em' }}>{settings.facebook}</p>
                      )}
                      {!settings.facebook && settings.hotline && (
                        <p className="text-black font-black leading-tight" style={{ fontSize: '0.92em' }}>Hotline: {settings.hotline}</p>
                      )}
                      {settings.address && (
                        <p className="text-black font-medium leading-tight" style={{ fontSize: '0.85em' }}>Đ/c: {settings.address}</p>
                      )}
                    </div>

                    {/* Order Info Sample */}
                    <div className="text-center py-1 border-b border-dashed border-black space-y-0.5">
                      <h3 className="font-black uppercase tracking-wide text-black leading-tight" style={{ fontSize: '1.22em' }}>
                        HÓA ĐƠN BÁN HÀNG
                      </h3>
                      <p className="text-black font-bold leading-tight" style={{ fontSize: '0.92em' }}>
                        Số HĐ: <strong className="font-black text-black">#DH-SAMPLE</strong>
                      </p>
                      <p className="text-black font-semibold italic leading-tight" style={{ fontSize: '0.85em' }}>
                        15/09/2026 15:30
                      </p>
                    </div>

                    {/* Customer Info Sample */}
                    {settings.showCustomer && (
                      <div className="py-1.5 border-b border-dashed border-black space-y-1" style={{ fontSize: '0.92em' }}>
                        <div className="flex justify-between items-baseline">
                          <span className="text-black font-bold">Khách hàng:</span>
                          <strong className="text-black font-black">Chị Lan (Zalo Đội Cấn)</strong>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-black font-bold">SĐT:</span>
                          <span className="font-black text-black">0988123456</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-black font-bold shrink-0">Địa chỉ:</span>
                          <span className="text-right text-black font-bold">12 Đội Cấn, Ba Đình, Hà Nội</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-black font-bold">Hình thức:</span>
                          <span className="font-black text-black uppercase">Giao hàng (Ship)</span>
                        </div>
                      </div>
                    )}

                    {/* Items Table Sample (KiotViet 2-Line Layout) */}
                    <div className="py-2 border-b border-dashed border-black">
                      <div className="flex justify-between font-black pb-1 border-b border-black text-black uppercase tracking-wider" style={{ fontSize: '0.88em' }}>
                        <span className="w-1/3 text-left">Đơn giá</span>
                        <span className="w-1/3 text-center">SL</span>
                        <span className="w-1/3 text-right">Thành tiền</span>
                      </div>
                      <div className="divide-y divide-dashed divide-black">
                        <div className="py-1.5 space-y-0.5">
                          <div className="font-black text-black leading-snug" style={{ fontSize: '1.02em' }}>
                            Xúc xích Heo Thảo Mộc Phô Mai Mozzarella
                            <span className="font-semibold text-black ml-1" style={{ fontSize: '0.85em' }}>(Gói 500g)</span>
                          </div>
                          <div className="flex justify-between items-center text-black" style={{ fontSize: '0.95em' }}>
                            <span className="w-1/3 text-left font-bold">145.000đ</span>
                            <span className="w-1/3 text-center font-black">x1</span>
                            <span className="w-1/3 text-right font-black text-black" style={{ fontSize: '1.05em' }}>145.000đ</span>
                          </div>
                        </div>
                        <div className="py-1.5 space-y-0.5">
                          <div className="font-black text-black leading-snug" style={{ fontSize: '1.02em' }}>
                            Pate Gan Gà Nấm Truffle Thượng Hạng
                            <span className="font-semibold text-black ml-1" style={{ fontSize: '0.85em' }}>(Hũ 250g)</span>
                          </div>
                          <div className="flex justify-between items-center text-black" style={{ fontSize: '0.95em' }}>
                            <span className="w-1/3 text-left font-bold">120.000đ</span>
                            <span className="w-1/3 text-center font-black">x1</span>
                            <span className="w-1/3 text-right font-black text-black" style={{ fontSize: '1.05em' }}>120.000đ</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="py-2 border-b border-dashed border-black space-y-1" style={{ fontSize: '0.92em' }}>
                      <div className="flex justify-between text-black">
                        <span className="font-bold">Tổng số lượng:</span>
                        <span className="font-black text-black">2</span>
                      </div>
                      <div className="flex justify-between text-black">
                        <span className="font-bold">Tổng tiền hàng:</span>
                        <span className="font-black text-black">265.000đ</span>
                      </div>
                      <div className="flex justify-between text-black">
                        <span className="font-bold">Phí vận chuyển:</span>
                        <span className="font-black">+25.000đ</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1.5 border-t border-black font-black text-black">
                        <span className="uppercase" style={{ fontSize: '1.12em' }}>TỔNG THANH TOÁN:</span>
                        <span className="font-black text-black" style={{ fontSize: '1.35em' }}>290.000đ</span>
                      </div>
                    </div>

                    {/* Dynamic VietQR Preview */}
                    {settings.showVietQR && qrUrl && (
                      <div className="py-2 text-center border-b border-dashed border-black space-y-1">
                        <p className="font-black uppercase tracking-wide text-black" style={{ fontSize: '0.98em' }}>
                          THÔNG TIN CHUYỂN KHOẢN:
                        </p>
                        <p className="font-bold text-black" style={{ fontSize: '0.92em' }}>
                          {settings.bankCode} - CTK: {settings.bankAccountName}
                        </p>
                        <p className="font-black tracking-wider text-black" style={{ fontSize: '1.25em' }}>
                          {settings.bankAccount}
                        </p>
                        {settings.bankNote && (
                          <p className="text-black font-semibold italic" style={{ fontSize: '0.85em' }}>
                            ({settings.bankNote})
                          </p>
                        )}
                        <div className="pt-2 flex flex-col items-center justify-center">
                          <div className="w-28 h-28 bg-white border-2 border-black rounded p-1 flex items-center justify-center">
                            <img
                              src={qrUrl}
                              alt="VietQR Napas"
                              className="w-24 h-24 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <p className="text-black font-bold mt-1" style={{ fontSize: '0.8em' }}>Quét mã VietQR chuyển khoản nhanh</p>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-center pt-2 text-black space-y-0.5">
                      <p className="font-black text-black" style={{ fontSize: '0.95em' }}>
                        {settings.footerMessage || 'Chúc quý khách có một bữa ăn hạnh phúc!'}
                      </p>
                      <p className="text-black font-semibold italic" style={{ fontSize: '0.8em' }}>
                        MexucxichCuisine - Ẩm thực thủ công & Đặc sản tuyển chọn
                      </p>
                    </div>
                  </div>
                );

                if (settings.printCopies === 2) {
                  return (
                    <>
                      {renderPreviewContent('LIÊN 1: LƯU BẾP / QUẦY')}
                      <div className="my-5 py-2 border-b-2 border-dashed border-slate-400 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        ✂ - - - - - - - CẮT TẠI ĐÂY - - - - - - - ✂
                      </div>
                      {renderPreviewContent('LIÊN 2: GIAO KHÁCH')}
                    </>
                  );
                }

                return renderPreviewContent();
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
