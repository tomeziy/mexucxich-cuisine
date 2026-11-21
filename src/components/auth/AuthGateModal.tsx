import React, { useState, useEffect } from 'react';
import { useStore } from '../../context/StoreContext';
import { Lock, User, KeyRound, Eye, EyeOff, AlertTriangle, RefreshCw, X, ShieldCheck } from 'lucide-react';

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
  const { authConfig, loginWithPassword, syncCloudToLocal, isCloudSyncing } = useStore();

  const [username, setUsername] = useState(authConfig.username || 'hang');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setUsername(authConfig.username || 'hang');
      setPassword('');
      setErrorMsg(null);
    }
  }, [isOpen, authConfig.username]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên đăng nhập và Mật khẩu!');
      return;
    }

    const ok = loginWithPassword(username.trim(), password);
    if (!ok) {
      setErrorMsg('Tên đăng nhập hoặc mật khẩu chưa đúng. Thử lại hoặc đồng bộ cấu hình từ Cloud.');
      return;
    }

    setPassword('');
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
              <span>Đăng nhập MexucxichCuisine</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMandatoryLock
                ? 'Phiên làm việc đang khóa. Đăng nhập nhanh để tiếp tục bán hàng.'
                : 'Đăng nhập để mở khóa hoặc lưu mật khẩu trên trình duyệt này.'}
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
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="hang hoặc mexucxich"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
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
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu cửa hàng..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition"
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
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm shadow-md shadow-amber-500/25 transition flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Đăng nhập ngay (Nhớ 30 ngày)</span>
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Mẹo: Lưu mật khẩu trên Chrome để tự điền trong 1 giây.
          </span>
          <button
            type="button"
            onClick={() => syncCloudToLocal()}
            disabled={isCloudSyncing}
            className="text-amber-700 hover:text-amber-800 font-bold flex items-center gap-1 shrink-0 ml-2"
            title="Cập nhật mật khẩu mới nhất nếu vừa đổi từ máy khác"
          >
            <RefreshCw className={`w-3 h-3 ${isCloudSyncing ? 'animate-spin' : ''}`} />
            <span>Đồng bộ Cloud</span>
          </button>
        </div>
      </div>
    </div>
  );
};
