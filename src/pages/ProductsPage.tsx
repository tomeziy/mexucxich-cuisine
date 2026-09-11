import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { formatVND } from '../utils/format';
import { matchesSearch } from '../utils/vietnamese';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  Filter,
  FileSpreadsheet,
  Upload,
  Download,
  Check,
} from 'lucide-react';
import {
  exportProductsToExcel,
  downloadProductTemplate,
  parseProductsExcel,
} from '../utils/excel';

const EMOJI_OPTIONS = ['🧀', '🥩', '🥣', '🍳', '🥓', '🌶️', '🍄', '🍢', '🍗', '🌭', '🥗', '🥖', '🥟', '🧃', '🍯'];

export const ProductsPage: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct } = useStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tất cả');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Đồ tự làm');
  const [formUnit, setFormUnit] = useState('Gói 500g');
  const [formPrice, setFormPrice] = useState<number>(100000);
  const [formCost, setFormCost] = useState<number>(70000);
  const [formStock, setFormStock] = useState<number>(10);
  const [formImage, setFormImage] = useState('🌭');

  // Excel Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Partial<Product>[]>([]);
  const [importFileName, setImportFileName] = useState('');

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportFileName(file.name);
      const parsed = await parseProductsExcel(file);
      if (parsed.length === 0) {
        alert('Không tìm thấy dòng sản phẩm hợp lệ nào trong file Excel!');
        return;
      }
      setPreviewProducts(parsed);
      setIsImportModalOpen(true);
    } catch (err) {
      alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file!');
    }
  };

  const handleConfirmImport = () => {
    if (previewProducts.length === 0) return;
    previewProducts.forEach(p => {
      addProduct({
        name: p.name || 'Món mới',
        category: p.category || 'Đồ tự làm',
        unit: p.unit || 'Gói',
        cost: p.cost || 0,
        price: p.price || 0,
        stock: p.stock || 0,
        image: p.image || '🌭',
      });
    });
    alert(`Đã nhập thành công ${previewProducts.length} món ăn vào thực đơn!`);
    setIsImportModalOpen(false);
    setPreviewProducts([]);
  };

  const categories = ['Tất cả', 'Đồ tự làm', 'Đặc sản tuyển chọn', 'Ăn vặt & Khô', 'Gia vị & Sốt'];

  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCategory === 'Tất cả' || p.category === selectedCategory;
    const matchesQuery = matchesSearch(p.name, searchQuery) || matchesSearch(p.id, searchQuery);
    const matchesStock = filterLowStock ? p.stock <= 5 : true;
    return matchesCat && matchesQuery && matchesStock;
  });

  const lowStockCount = products.filter(p => p.stock <= 5).length;

  const openAddModal = () => {
    setFormName('');
    setFormCategory('Đồ tự làm');
    setFormUnit('Gói 500g');
    setFormPrice(100000);
    setFormCost(70000);
    setFormStock(10);
    setFormImage('🌭');
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormName(product.name);
    setFormCategory(product.category);
    setFormUnit(product.unit);
    setFormPrice(product.price);
    setFormCost(product.cost);
    setFormStock(product.stock);
    setFormImage(product.image);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert('Vui lòng nhập tên sản phẩm!');
      return;
    }

    if (editingProduct) {
      updateProduct(editingProduct.id, {
        name: formName.trim(),
        category: formCategory,
        unit: formUnit.trim() || 'Cái',
        price: Number(formPrice) || 0,
        cost: Number(formCost) || 0,
        stock: Number(formStock) || 0,
        image: formImage,
      });
      setEditingProduct(null);
    } else {
      addProduct({
        name: formName.trim(),
        category: formCategory,
        unit: formUnit.trim() || 'Cái',
        price: Number(formPrice) || 0,
        cost: Number(formCost) || 0,
        stock: Number(formStock) || 0,
        image: formImage,
      });
      setIsAddModalOpen(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Bạn có chắc chắn muốn xóa món "${name}" khỏi kho hàng?`)) {
      deleteProduct(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
              Quản lý Sản phẩm & Kho hàng
            </h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {products.length} món
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi danh mục, giá vốn, giá bán niêm yết và tồn kho thực tế
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {lowStockCount > 0 && (
            <button
              onClick={() => setFilterLowStock(!filterLowStock)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                filterLowStock
                  ? 'bg-rose-500 border-rose-500 text-white shadow-xs'
                  : 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Cảnh báo tồn ≤ 5 ({lowStockCount})</span>
            </button>
          )}

          <button
            onClick={() => exportProductsToExcel(products)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            title="Xuất danh sách sản phẩm ra Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Xuất Excel</span>
          </button>

          <label className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-600" />
            <span>Nhập Excel</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelUpload}
              className="hidden"
            />
          </label>

          <button
            onClick={downloadProductTemplate}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition"
            title="Tải file mẫu Excel (.xlsx)"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold shadow-sm shadow-amber-500/20 transition flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm món mới</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Tìm kiếm món ăn theo tên hoặc mã SP..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scroll">
          {categories.map(cat => {
            const count =
              cat === 'Tất cả'
                ? products.length
                : products.filter(p => p.category === cat).length;
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`
                  shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5
                  ${active
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                `}
              >
                <span>{cat}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-3.5">Món ăn</th>
                <th className="py-3 px-3">Mã SP</th>
                <th className="py-3 px-3">Danh mục</th>
                <th className="py-3 px-3">Đơn vị</th>
                <th className="py-3 px-3 text-right">Giá vốn</th>
                <th className="py-3 px-3 text-right">Giá bán</th>
                <th className="py-3 px-3 text-center">Tồn kho</th>
                <th className="py-3 px-3 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 text-xs">
                    Không có sản phẩm nào phù hợp với bộ lọc
                  </td>
                </tr>
              ) : (
                filteredProducts.map(p => {
                  const isLowStock = p.stock <= 5;
                  const isOutOfStock = p.stock <= 0;
                  const profitMargin = p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0;

                  return (
                    <tr key={p.id} className="hover:bg-amber-50/30 transition">
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200/80 flex items-center justify-center text-xl shrink-0">
                            {p.image}
                          </div>
                          <div>
                            <strong className="text-slate-900 block truncate max-w-[180px] sm:max-w-xs">
                              {p.name}
                            </strong>
                            <span className="text-[10px] text-slate-400">Lãi gộp: ~{profitMargin}%</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono font-bold text-[11px]">
                        {p.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {p.category}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 font-semibold">{p.unit}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-semibold">
                        {formatVND(p.cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-700">
                        {formatVND(p.price)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-md bg-slate-200 text-slate-700 text-[10px] font-extrabold">
                            Hết hàng
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-extrabold inline-flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> Còn {p.stock}
                          </span>
                        ) : (
                          <span className="font-extrabold text-slate-800">{p.stock}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-amber-600 transition"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition"
                            title="Xóa món"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {(isAddModalOpen || editingProduct) && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-500" />
                <span>{editingProduct ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới vào kho'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 pt-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Tên món ăn / sản phẩm <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ví dụ: Xúc xích Tiêu đen, Pate nấm..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-slate-900"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Danh mục</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="Đồ tự làm">Đồ tự làm</option>
                    <option value="Đặc sản tuyển chọn">Đặc sản tuyển chọn</option>
                    <option value="Ăn vặt & Khô">Ăn vặt & Khô</option>
                    <option value="Gia vị & Sốt">Gia vị & Sốt</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    placeholder="Gói 500g, Hũ 250g..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá vốn (đ)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formCost || ''}
                    onChange={e => setFormCost(Number(e.target.value) || 0)}
                    placeholder="70000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-right font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Giá bán (đ)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formPrice || ''}
                    onChange={e => setFormPrice(Number(e.target.value) || 0)}
                    placeholder="100000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-right font-bold text-amber-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Tồn kho</label>
                  <input
                    type="number"
                    min="0"
                    value={formStock !== undefined ? formStock : ''}
                    onChange={e => setFormStock(Number(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-center font-black focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Chọn biểu tượng / icon món</label>
                <div className="flex flex-wrap gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormImage(emoji)}
                      className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition ${
                        formImage === emoji
                          ? 'bg-amber-500 shadow-xs scale-110'
                          : 'hover:bg-slate-200'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingProduct(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition"
                >
                  {editingProduct ? 'Cập nhật món' : 'Thêm vào thực đơn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Import Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Xem trước dữ liệu nhập từ Excel
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    File: <strong>{importFileName}</strong> • Tìm thấy <strong>{previewProducts.length}</strong> món ăn
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview Table */}
            <div className="flex-1 overflow-y-auto custom-scroll my-3 border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-extrabold sticky top-0">
                  <tr className="border-b border-slate-200">
                    <th className="py-2 px-3">Tên món</th>
                    <th className="py-2 px-3">Danh mục</th>
                    <th className="py-2 px-3">Đơn vị</th>
                    <th className="py-2 px-3 text-right">Giá vốn</th>
                    <th className="py-2 px-3 text-right">Giá bán</th>
                    <th className="py-2 px-3 text-center">Tồn kho</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {previewProducts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-bold text-slate-800">{p.name}</td>
                      <td className="py-2 px-3 text-slate-500">{p.category}</td>
                      <td className="py-2 px-3 text-slate-500">{p.unit}</td>
                      <td className="py-2 px-3 text-right text-slate-600">{formatVND(p.cost || 0)}</td>
                      <td className="py-2 px-3 text-right font-bold text-amber-700">{formatVND(p.price || 0)}</td>
                      <td className="py-2 px-3 text-center font-bold">{p.stock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs font-bold">
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImport}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Xác nhận nhập {previewProducts.length} món vào kho</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
