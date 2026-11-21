import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, User, KeyRound, Eye, EyeOff, AlertTriangle, X, ShieldCheck, Loader2 } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  isMandatoryLock: boolean;
  onClose?: () => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({
  isOpen,
  isMandatoryLock,
  onClose,
}) => {
  const { authConfig, loginWithPassword } = useStore();

  const [username, setUsername] = useState(authConfig.username || 'mexucxich');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(prev => prev || authConfig.username || 'mexucxich');
      setPassword('');
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, authConfig.username]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await loginWithPassword(username.trim(), password);
      if (!res.success) {
        setErrorMsg(res.error || 'Tên đăng nhập hoặc mật khẩu chưa đúng.');
        return;
      }
      setPassword('');
      onClose?.();
    } catch {
      setErrorMsg('Không thể kết nối máy chủ. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-amber-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 relative animate-in fade-in zoom-in duration-150">
        {!isMandatoryLock && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0 font-black text-2xl">
            🌭
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>MexucxichCuisine POS</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Đăng nhập để đồng bộ tự động dữ liệu cửa hàng mới nhất từ Cloud.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label htmlFor="mxc-auth-username" className="font-bold text-slate-700 block mb-1">
              Tên đăng nhập (Username)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="mxc-auth-username"
                type="text"
                name="username"
                autoComplete="username"
                autoFocus
                disabled={isSubmitting}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="mexucxich"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label htmlFor="mxc-auth-password" className="font-bold text-slate-700 block mb-1">
              Mật khẩu (Password)
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="mxc-auth-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                disabled={isSubmitting}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition"
                title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/25 transition flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang đăng nhập & tải dữ liệu Cloud...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng nhập (Tự nhớ trên máy này)</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 text-center">
          <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Kết nối Cloud tự động • Cho phép Chrome lưu mật khẩu để mở nhanh 1 giây</span>
        </div>
      </div>
    </div>
  );
};
