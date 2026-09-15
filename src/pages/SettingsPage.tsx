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
} from 'lucide-react';

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
    exportAllData,
    importAllData,
    resetToMockData,
  } = useStore();

  const [settings, setSettings] = useState<ReceiptSettings>(receiptSettings);
  const [savedSuccess, setSavedSuccess] = useState(false);

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
                  <div className="space-y-2 text-slate-900 leading-snug">
                    {copyLabel && (
                      <div className="text-center pb-1 border-b border-dashed border-slate-300">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded bg-slate-100 font-extrabold text-slate-800 tracking-wider uppercase"
                          style={{ fontSize: '0.85em' }}
                        >
                          {copyLabel}
                        </span>
                      </div>
                    )}

                    {/* Header */}
                    <div className="text-center pb-2 border-b border-dashed border-slate-300 space-y-0.5">
                      {settings.showLogo && <div className="mb-1 leading-none" style={{ fontSize: '1.6em' }}>🌭</div>}
                      <h2 className="font-black uppercase tracking-wider text-slate-900 leading-tight" style={{ fontSize: '1.28em' }}>
                        {settings.storeName || 'MEXUCXICH CUISINE'}
                      </h2>
                      {settings.storeSubtitle && (
                        <p className="text-slate-600 italic leading-tight" style={{ fontSize: '0.88em' }}>{settings.storeSubtitle}</p>
                      )}
                      {settings.facebook && (
                        <p className="text-slate-700 font-semibold leading-tight" style={{ fontSize: '0.92em' }}>{settings.facebook}</p>
                      )}
                      {!settings.facebook && settings.hotline && (
                        <p className="text-slate-700 font-bold leading-tight" style={{ fontSize: '0.92em' }}>Hotline: {settings.hotline}</p>
                      )}
                      {settings.address && (
                        <p className="text-slate-500 leading-tight" style={{ fontSize: '0.82em' }}>Đ/c: {settings.address}</p>
                      )}
                    </div>

                    {/* Order Info Sample */}
                    <div className="text-center py-1 border-b border-dashed border-slate-300 space-y-0.5">
                      <h3 className="font-black uppercase tracking-wide text-slate-900 leading-tight" style={{ fontSize: '1.22em' }}>
                        HÓA ĐƠN BÁN HÀNG
                      </h3>
                      <p className="text-slate-700 leading-tight" style={{ fontSize: '0.92em' }}>
                        Số HĐ: <strong className="font-black text-slate-900">#DH-SAMPLE</strong>
                      </p>
                      <p className="text-slate-500 italic leading-tight" style={{ fontSize: '0.85em' }}>
                        15/09/2026 15:30
                      </p>
                    </div>

                    {/* Customer Info Sample */}
                    {settings.showCustomer && (
                      <div className="py-1.5 border-b border-dashed border-slate-300 space-y-1" style={{ fontSize: '0.92em' }}>
                        <div className="flex justify-between items-baseline">
                          <span className="text-slate-600">Khách hàng:</span>
                          <strong className="text-slate-900 font-bold">Chị Lan (Zalo Đội Cấn)</strong>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-slate-600">SĐT:</span>
                          <span className="font-bold text-slate-800">0988123456</span>
                        </div>
                        <div className="flex justify-between items-start gap-2">
                          <span className="text-slate-600 shrink-0">Địa chỉ:</span>
                          <span className="text-right text-slate-800">12 Đội Cấn, Ba Đình, Hà Nội</span>
                        </div>
                        <div className="flex justify-between items-baseline">
                          <span className="text-slate-600">Hình thức:</span>
                          <span className="font-bold text-blue-800">Giao hàng (Ship)</span>
                        </div>
                      </div>
                    )}

                    {/* Items Table Sample (KiotViet 2-Line Layout) */}
                    <div className="py-2 border-b border-dashed border-slate-300">
                      <div className="flex justify-between font-bold pb-1 border-b border-slate-300 text-slate-800 uppercase tracking-wider" style={{ fontSize: '0.88em' }}>
                        <span className="w-1/3 text-left">Đơn giá</span>
                        <span className="w-1/3 text-center">SL</span>
                        <span className="w-1/3 text-right">Thành tiền</span>
                      </div>
                      <div className="divide-y divide-dashed divide-slate-200">
                        <div className="py-1.5 space-y-0.5">
                          <div className="font-bold text-slate-900 leading-snug" style={{ fontSize: '1.02em' }}>
                            Xúc xích Heo Thảo Mộc Phô Mai Mozzarella
                            <span className="font-normal text-slate-500 ml-1" style={{ fontSize: '0.85em' }}>(Gói 500g)</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700" style={{ fontSize: '0.95em' }}>
                            <span className="w-1/3 text-left font-semibold">145.000đ</span>
                            <span className="w-1/3 text-center font-bold">x1</span>
                            <span className="w-1/3 text-right font-black text-slate-900" style={{ fontSize: '1.05em' }}>145.000đ</span>
                          </div>
                        </div>
                        <div className="py-1.5 space-y-0.5">
                          <div className="font-bold text-slate-900 leading-snug" style={{ fontSize: '1.02em' }}>
                            Pate Gan Gà Nấm Truffle Thượng Hạng
                            <span className="font-normal text-slate-500 ml-1" style={{ fontSize: '0.85em' }}>(Hũ 250g)</span>
                          </div>
                          <div className="flex justify-between items-center text-slate-700" style={{ fontSize: '0.95em' }}>
                            <span className="w-1/3 text-left font-semibold">120.000đ</span>
                            <span className="w-1/3 text-center font-bold">x1</span>
                            <span className="w-1/3 text-right font-black text-slate-900" style={{ fontSize: '1.05em' }}>120.000đ</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="py-2 border-b border-dashed border-slate-300 space-y-1" style={{ fontSize: '0.92em' }}>
                      <div className="flex justify-between text-slate-700">
                        <span>Tổng số lượng:</span>
                        <span className="font-bold text-slate-900">2</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Tổng tiền hàng:</span>
                        <span className="font-bold text-slate-900">265.000đ</span>
                      </div>
                      <div className="flex justify-between text-slate-700">
                        <span>Phí vận chuyển:</span>
                        <span className="font-bold">+25.000đ</span>
                      </div>
                      <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-300 font-black text-slate-900">
                        <span className="uppercase" style={{ fontSize: '1.12em' }}>TỔNG THANH TOÁN:</span>
                        <span className="font-black text-amber-700" style={{ fontSize: '1.28em' }}>290.000đ</span>
                      </div>
                    </div>

                    {/* Dynamic VietQR Preview */}
                    {settings.showVietQR && qrUrl && (
                      <div className="py-2 text-center border-b border-dashed border-slate-300 space-y-1">
                        <p className="font-extrabold uppercase tracking-wide text-slate-900" style={{ fontSize: '0.98em' }}>
                          THÔNG TIN CHUYỂN KHOẢN:
                        </p>
                        <p className="font-bold text-slate-800" style={{ fontSize: '0.92em' }}>
                          {settings.bankCode} - CTK: {settings.bankAccountName}
                        </p>
                        <p className="font-black tracking-wider text-slate-900" style={{ fontSize: '1.25em' }}>
                          {settings.bankAccount}
                        </p>
                        {settings.bankNote && (
                          <p className="text-slate-600 italic" style={{ fontSize: '0.85em' }}>
                            ({settings.bankNote})
                          </p>
                        )}
                        <div className="pt-2 flex flex-col items-center justify-center">
                          <div className="w-28 h-28 bg-white border border-slate-300 rounded p-1 flex items-center justify-center shadow-2xs">
                            <img
                              src={qrUrl}
                              alt="VietQR Napas"
                              className="w-24 h-24 object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <p className="text-slate-500 mt-1" style={{ fontSize: '0.8em' }}>Quét mã VietQR chuyển khoản nhanh</p>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-center pt-2 text-slate-600 space-y-0.5">
                      <p className="font-bold text-slate-800" style={{ fontSize: '0.95em' }}>
                        {settings.footerMessage || 'Chúc quý khách có một bữa ăn hạnh phúc!'}
                      </p>
                      <p className="text-slate-400 italic" style={{ fontSize: '0.8em' }}>
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
