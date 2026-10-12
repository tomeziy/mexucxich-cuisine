import React from 'react';
import { createPortal } from 'react-dom';
import { Order, ReceiptSettings, PrintFontSize } from '../../types';
import { useStore } from '../../context/StoreContext';
import { Printer, X, Edit2, Trash2 } from 'lucide-react';
import { ThermalReceipt } from './ThermalReceipt';

interface ReceiptModalProps {
  order: Order | null;
  settings: ReceiptSettings;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (order: Order) => void;
  onDelete?: (order: Order) => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  order,
  settings,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}) => {
  const { updateReceiptSettings } = useStore();

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const paperWidthClass =
    settings.paperSize === 'k57'
      ? 'w-[57mm] max-w-[57mm]'
      : settings.paperSize === 'a5'
      ? 'w-[148mm] max-w-[148mm]'
      : settings.paperSize === 'a4'
      ? 'w-[210mm] max-w-[210mm]'
      : 'w-[80mm] max-w-[80mm]'; // default k80

  // Smart proportional base font size
  const baseFontSizePx =
    settings.fontSize === 'small'
      ? 11.5
      : settings.fontSize === 'large'
      ? 16
      : 13.5;

  const printCopies = settings.printCopies || 1;
  const printRoot = typeof document !== 'undefined' ? document.getElementById('print-root') : null;

  return (
    <>
      {/* 1. ON-SCREEN INTERACTIVE MODAL (Rendered inside #root, completely hidden during window.print()) */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in duration-150">
          {/* Header */}
          <div className="p-3.5 bg-amber-500 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Printer className="w-4 h-4" />
              <span>Hóa đơn bán hàng ({settings.paperSize.toUpperCase()} • {printCopies} liên)</span>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center transition text-sm font-bold"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Toolbar: Chỉnh trực tiếp Cỡ chữ & Số liên ngay trên popup */}
          <div className="bg-amber-50 px-3.5 py-2.5 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
            {/* Cỡ chữ in */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 text-xs">Cỡ chữ:</span>
              <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-200 font-bold text-xs shadow-2xs">
                {[
                  { id: 'small', label: 'Nhỏ (11.5px)' },
                  { id: 'medium', label: 'Vừa (13.5px)' },
                  { id: 'large', label: 'To (16px)' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => updateReceiptSettings({ fontSize: f.id as PrintFontSize })}
                    className={`px-2.5 py-1 rounded-md transition ${
                      (settings.fontSize || 'medium') === f.id
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Số liên in */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 text-xs">Số liên:</span>
              <div className="inline-flex bg-white p-0.5 rounded-lg border border-amber-200 font-bold text-xs shadow-2xs">
                <button
                  type="button"
                  onClick={() => updateReceiptSettings({ printCopies: 1 })}
                  className={`px-2.5 py-1 rounded-md transition ${
                    (settings.printCopies || 1) === 1
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  1 liên
                </button>
                <button
                  type="button"
                  onClick={() => updateReceiptSettings({ printCopies: 2 })}
                  className={`px-2.5 py-1 rounded-md transition ${
                    settings.printCopies === 2
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  2 liên
                </button>
              </div>
            </div>
          </div>

          {/* On-Screen Receipt Paper Preview */}
          <div className="flex-1 min-h-0 overflow-y-auto custom-scroll bg-slate-200/80 p-4 sm:p-6 flex flex-col items-center">
            <div
              className={`${paperWidthClass} bg-white text-black font-sans shadow-xl rounded-xs border-t-4 border-amber-500 box-border p-4 sm:p-5 h-auto shrink-0 mb-6`}
              style={{ fontSize: `${baseFontSizePx}px`, lineHeight: 1.35 }}
            >
              {printCopies === 2 ? (
                <div>
                  {/* Copy 1 */}
                  <div>
                    <ThermalReceipt order={order} settings={settings} copyTitle="LIÊN 1: LƯU BẾP / QUẦY" isPreview />
                  </div>

                  {/* On-screen visual cut divider */}
                  <div
                    className="my-6 py-2.5 border-y-2 border-dashed border-slate-400 text-center font-bold text-slate-500 uppercase tracking-normal bg-slate-50 rounded-xs select-none"
                    style={{ fontSize: '0.82em' }}
                  >
                    ✂ - - - - - - - CẮT TẠI ĐÂY (DAO CẮT TỰ ĐỘNG KHI IN) - - - - - - - ✂
                  </div>

                  {/* Copy 2 */}
                  <div>
                    <ThermalReceipt order={order} settings={settings} copyTitle="LIÊN 2: GIAO CHO KHÁCH" isPreview />
                  </div>
                </div>
              ) : (
                <div>
                  <ThermalReceipt order={order} settings={settings} isPreview />
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-600 flex items-center gap-1 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>Sửa đơn</span>
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(order)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center gap-1 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa đơn</span>
                </button>
              )}
              <div className="text-[11px] text-slate-400 font-medium hidden sm:block">
                In: <strong className="text-slate-700">{printCopies} liên</strong> • Cỡ chữ: <strong className="text-slate-700">{settings.fontSize === 'small' ? 'Nhỏ' : settings.fontSize === 'large' ? 'To' : 'Vừa'}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Đóng
              </button>
              <button
                onClick={handlePrint}
                className="px-5 py-2 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/20 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>In Hóa Đơn</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. REAL THERMAL PRINT PORTAL (Rendered directly into #print-root outside #root) */}
      {printRoot && createPortal(
        <div
          className={settings.fontFamily === 'system' ? 'font-system' : 'font-arial'}
          style={{
            fontSize: `${baseFontSizePx}px`,
            lineHeight: 1.35,
            width: settings.paperSize === 'k57' ? '57mm' : '80mm',
          }}
        >
          {printCopies === 2 ? (
            <>
              <div className="thermal-print-copy has-next-copy">
                <ThermalReceipt order={order} settings={settings} copyTitle="LIÊN 1: LƯU BẾP / QUẦY" />
                <div style={{ height: '6mm' }} />
              </div>
              <div className="thermal-print-copy">
                <ThermalReceipt order={order} settings={settings} copyTitle="LIÊN 2: GIAO CHO KHÁCH" />
                <div style={{ height: '6mm' }} />
              </div>
            </>
          ) : (
            <div className="thermal-print-copy">
              <ThermalReceipt order={order} settings={settings} />
              <div style={{ height: '6mm' }} />
            </div>
          )}
        </div>,
        printRoot
      )}
    </>
  );
};
