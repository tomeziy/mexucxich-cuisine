import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Product } from '../types';
import { formatVND } from '../utils/format';
import { matchesSearch, removeVietnameseTones } from '../utils/vietnamese';
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
import {
  analyzeProductImportRows,
  buildProductImportPlan,
  AnalyzedProductImportRow,
  MissingCatalogProductItem,
} from '../utils/importReconciler';

const EMOJI_OPTIONS = ['🧀', '🥩', '🥣', '🍳', '🥓', '🌶️', '🍄', '🍢', '🍗', '🌭', '🥗', '🥖', '🥟', '🧃', '🍯'];

export type ProductImportRowItem = AnalyzedProductImportRow;

export const ProductsPage: React.FC = () => {
  const {
    products,
    addProduct,
    addProductsBatch,
    updateProduct,
    updateProductsBatch,
    deleteProduct,
    deleteProductsBatch,
  } = useStore();

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

  // Excel Import states (ADR-0024 Smart Diff Reconciliation)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<AnalyzedProductImportRow[]>([]);
  const [missingCatalogItems, setMissingCatalogItems] = useState<MissingCatalogProductItem[]>([]);
  const [importTab, setImportTab] = useState<'all' | 'new' | 'changed' | 'identical' | 'missing'>('all');
  const [importFileName, setImportFileName] = useState('');

  // Row Inline Edit State in Import Preview
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowEditName, setRowEditName] = useState('');
  const [rowEditCategory, setRowEditCategory] = useState('Đồ tự làm');
  const [rowEditUnit, setRowEditUnit] = useState('Gói');
  const [rowEditCost, setRowEditCost] = useState<number>(0);
  const [rowEditPrice, setRowEditPrice] = useState<number>(0);
  const [rowEditStock, setRowEditStock] = useState<number>(0);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setImportFileName(file.name);
      const parsed = await parseProductsExcel(file);
      e.target.value = ''; // Reset file input so re-uploading the same file works
      if (parsed.length === 0) {
        alert('Không tìm thấy dòng sản phẩm hợp lệ nào trong file Excel!');
        return;
      }

      const analyzed = analyzeProductImportRows(parsed, products);
      setImportRows(analyzed.rows);
      setMissingCatalogItems(analyzed.missingFromFile);
      const hasChanged = analyzed.rows.some(
        r => r.diffStatus === 'info_changed' || r.diffStatus === 'stock_changed' || r.diffStatus === 'both_changed'
      );
      setImportTab(hasChanged ? 'changed' : 'all');
      setIsImportModalOpen(true);
    } catch (err) {
      e.target.value = '';
      alert('Lỗi khi đọc file Excel. Vui lòng kiểm tra định dạng file!');
    }
  };

  const handleApplyRecommendedAll = () => {
    setImportRows(prev => prev.map(r => ({ ...r, action: r.recommendedAction })));
    setMissingCatalogItems(prev => prev.map(m => ({ ...m, action: 'keep' })));
  };

  const handleApplyAllOverwrite = () => {
    setImportRows(prev => prev.map(r => (r.isDuplicate ? { ...r, action: 'overwrite' } : r)));
  };

  const handleApplyAllAccumulate = () => {
    setImportRows(prev => prev.map(r => (r.isDuplicate ? { ...r, action: 'accumulate' } : r)));
  };

  const handleSkipAllDuplicates = () => {
    setImportRows(prev => prev.map(r => (r.isDuplicate ? { ...r, action: 'skip' } : r)));
  };

  const startEditRow = (row: AnalyzedProductImportRow) => {
    setEditingRowId(row.id);
    setRowEditName(row.name);
    setRowEditCategory(row.category);
    setRowEditUnit(row.unit);
    setRowEditCost(row.cost);
    setRowEditPrice(row.price);
    setRowEditStock(row.stock);
  };

  const saveEditRow = (rowId: string) => {
    setImportRows(prev =>
      prev.map(r => {
        if (r.id === rowId) {
          const updatedParsed = {
            name: rowEditName.trim() || r.name,
            category: rowEditCategory.trim() || r.category,
            unit: rowEditUnit.trim() || r.unit,
            cost: Math.max(0, rowEditCost || 0),
            price: Math.max(0, rowEditPrice || 0),
            stock: Math.max(0, rowEditStock || 0),
            image: r.image,
          };
          const reanalyzed = analyzeProductImportRows([updatedParsed], products).rows[0];
          if (reanalyzed) {
            return { ...reanalyzed, id: r.id };
          }
        }
        return r;
      })
    );
    setEditingRowId(null);
  };

  const handleConfirmImport = () => {
    if (importRows.length === 0 && missingCatalogItems.length === 0) return;

    const plan = buildProductImportPlan(importRows, missingCatalogItems);

    if (plan.productUpdates.length > 0) {
      updateProductsBatch(plan.productUpdates);
    }
    if (plan.newProducts.length > 0) {
      addProductsBatch(plan.newProducts);
    }
    if (plan.productIdsToDelete.length > 0) {
      deleteProductsBatch(plan.productIdsToDelete);
    }

    alert(
      `Đã xử lý xong ${importRows.length} món ăn từ Excel:\n` +
        `- Thêm mới: ${plan.counts.created} món\n` +
        `- Cập nhật (giá/ĐVT/kho): ${plan.counts.updated} món\n` +
        `- Bỏ qua (không thay đổi): ${plan.counts.skipped} món` +
        (plan.counts.deleted > 0 ? `\n- Đã xóa khỏi thực đơn: ${plan.counts.deleted} món` : '')
    );
    setIsImportModalOpen(false);
    setImportRows([]);
    setMissingCatalogItems([]);
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
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5"
            title="Tải file mẫu Excel (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Tải file mẫu</span>
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

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scroll pb-0.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-amber-500 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto custom-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3 px-3.5">Món ăn</th>
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
                  <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                    Không tìm thấy món nào
                  </td>
                </tr>
              ) : (
                filteredProducts.map(product => {
                  const isLow = product.stock <= 5;
                  const isOut = product.stock <= 0;

                  return (
                    <tr key={product.id} className="hover:bg-amber-50/30 transition">
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-xl shrink-0 p-1 bg-slate-50 rounded-lg border border-slate-150">
                            {product.image}
                          </span>
                          <div>
                            <strong className="text-slate-900 block font-bold">{product.name}</strong>
                            <span className="text-[10px] text-slate-400 font-mono">{product.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{product.category}</td>
                      <td className="py-2.5 px-3 text-slate-500">{product.unit}</td>
                      <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                        {formatVND(product.cost)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-black text-amber-700 font-mono">
                        {formatVND(product.price)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
                            Hết hàng (0)
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 flex items-center justify-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Còn {product.stock}</span>
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700">{product.stock}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEditModal(product)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                            title="Sửa món"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 transition"
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
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-slate-900">
                {editingProduct ? 'Chỉnh sửa món ăn' : 'Thêm món ăn mới'}
              </h3>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingProduct(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3 pt-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Tên món ăn (*)
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Xúc xích Gà Nấm Phô Mai"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Danh mục</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    {categories.filter(c => c !== 'Tất cả').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Đơn vị tính</label>
                  <input
                    type="text"
                    value={formUnit}
                    onChange={e => setFormUnit(e.target.value)}
                    placeholder="Gói 500g, Hũ 250g..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Giá vốn (VNĐ)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={formCost || ''}
                    onChange={e => setFormCost(Number(e.target.value) || 0)}
                    placeholder="70000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Giá bán (VNĐ) (*)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1000"
                    value={formPrice || ''}
                    onChange={e => setFormPrice(Number(e.target.value) || 0)}
                    placeholder="120000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-black text-amber-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tồn kho ban đầu</label>
                  <input
                    type="number"
                    min="0"
                    value={formStock || ''}
                    onChange={e => setFormStock(Number(e.target.value) || 0)}
                    placeholder="10"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Biểu tượng</label>
                  <div className="flex items-center gap-1 overflow-x-auto custom-scroll py-1">
                    {EMOJI_OPTIONS.map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setFormImage(emoji)}
                        className={`text-lg p-1 rounded-lg transition shrink-0 ${
                          formImage === emoji ? 'bg-amber-100 ring-2 ring-amber-500 scale-110' : 'hover:bg-slate-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
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

      {/* Excel Product Import & Duplicate Resolution Preview Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-2xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900">
                    Xem trước & Xử lý Trùng lặp Sản phẩm từ Excel
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    File: <strong>{importFileName}</strong> • Tìm thấy <strong>{importRows.length}</strong> món ăn
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsImportModalOpen(false);
                  setEditingRowId(null);
                }}
                className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Summary Tabs & Bulk Action Controls (ADR-0024) */}
            {(() => {
              const newRows = importRows.filter(r => r.diffStatus === 'new');
              const changedRows = importRows.filter(
                r =>
                  r.diffStatus === 'info_changed' ||
                  r.diffStatus === 'stock_changed' ||
                  r.diffStatus === 'both_changed'
              );
              const identicalRows = importRows.filter(r => r.diffStatus === 'identical');
              const visibleRows =
                importTab === 'new'
                  ? newRows
                  : importTab === 'changed'
                  ? changedRows
                  : importTab === 'identical'
                  ? identicalRows
                  : importRows;

              return (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 pb-2 shrink-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setImportTab('all')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          importTab === 'all'
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Tất cả ({importRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTab('new')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          importTab === 'new'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                        }`}
                      >
                        ✨ Món mới ({newRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTab('changed')}
                        className={`px-2.5 py-1 rounded-full transition flex items-center gap-1 ${
                          importTab === 'changed'
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                        }`}
                      >
                        <AlertTriangle className="w-3 h-3" />
                        <span>Có thay đổi / Xung đột ({changedRows.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTab('identical')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          importTab === 'identical'
                            ? 'bg-slate-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        Giống hệt - Tự bỏ qua ({identicalRows.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setImportTab('missing')}
                        className={`px-2.5 py-1 rounded-full transition ${
                          importTab === 'missing'
                            ? 'bg-rose-600 text-white'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                        }`}
                      >
                        Không có trong File ({missingCatalogItems.length})
                      </button>
                    </div>

                    {importTab !== 'missing' && importRows.some(r => r.isDuplicate) && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={handleApplyRecommendedAll}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          Đề xuất thông minh
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAllOverwrite}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 transition"
                        >
                          Ghi đè tất cả
                        </button>
                        <button
                          type="button"
                          onClick={handleApplyAllAccumulate}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-800 hover:bg-amber-100 transition"
                        >
                          Cộng kho tất cả
                        </button>
                        <button
                          type="button"
                          onClick={handleSkipAllDuplicates}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-300 text-slate-700 hover:bg-slate-200 transition"
                        >
                          Bỏ qua tất cả trùng
                        </button>
                      </div>
                    )}

                    {importTab === 'missing' && missingCatalogItems.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] font-bold">
                        <button
                          type="button"
                          onClick={() =>
                            setMissingCatalogItems(prev => prev.map(m => ({ ...m, action: 'keep' })))
                          }
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 hover:bg-emerald-100 transition"
                        >
                          Giữ nguyên tất cả
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setMissingCatalogItems(prev => prev.map(m => ({ ...m, action: 'delete' })))
                          }
                          className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-300 text-rose-700 hover:bg-rose-100 transition"
                        >
                          Chọn xóa tất cả món thiếu
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Preview Table */}
                  <div className="flex-1 overflow-y-auto custom-scroll my-2 border border-slate-200 rounded-xl overflow-hidden text-xs">
                    {importTab === 'missing' ? (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-rose-50/70 text-rose-800 uppercase text-[10px] font-extrabold sticky top-0 border-b border-rose-200">
                          <tr>
                            <th className="py-2.5 px-3">Món đang có trên hệ thống (vắng mặt trong File)</th>
                            <th className="py-2.5 px-3">Danh mục / ĐVT</th>
                            <th className="py-2.5 px-3 text-right">Đơn giá</th>
                            <th className="py-2.5 px-3 text-center">Tồn kho</th>
                            <th className="py-2.5 px-3 text-center">Hành động</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {missingCatalogItems.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-400">
                                Không có món nào bị thiếu so với thực đơn hiện tại.
                              </td>
                            </tr>
                          ) : (
                            missingCatalogItems.map(item => (
                              <tr
                                key={item.product.id}
                                className={item.action === 'delete' ? 'bg-rose-50/60' : 'hover:bg-slate-50'}
                              >
                                <td className="py-2.5 px-3">
                                  <strong className="text-slate-900 block">{item.product.name}</strong>
                                  <span className="text-[10px] font-mono text-slate-400">#{item.product.id}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">
                                  {item.product.category} • {item.product.unit}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                  {formatVND(item.product.price)}
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold">{item.product.stock}</td>
                                <td className="py-2.5 px-3 text-center">
                                  <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMissingCatalogItems(prev =>
                                          prev.map(m =>
                                            m.product.id === item.product.id ? { ...m, action: 'keep' } : m
                                          )
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded transition ${
                                        item.action === 'keep'
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      Giữ nguyên
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMissingCatalogItems(prev =>
                                          prev.map(m =>
                                            m.product.id === item.product.id ? { ...m, action: 'delete' } : m
                                          )
                                        )
                                      }
                                      className={`px-2.5 py-1 rounded transition ${
                                        item.action === 'delete'
                                          ? 'bg-rose-600 text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-rose-700'
                                      }`}
                                    >
                                      Xóa khỏi thực đơn
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-600 uppercase text-[10px] font-extrabold sticky top-0 border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Tên món từ File</th>
                            <th className="py-2.5 px-3">Danh mục / ĐVT</th>
                            <th className="py-2.5 px-3 text-right">Giá vốn</th>
                            <th className="py-2.5 px-3 text-right">Đơn giá</th>
                            <th className="py-2.5 px-3 text-center">Tồn kho File</th>
                            <th className="py-2.5 px-3">So sánh Cũ → Mới</th>
                            <th className="py-2.5 px-3 text-center">Xử lý món</th>
                            <th className="py-2.5 px-2 text-center">Sửa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {visibleRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-slate-400">
                                Không có dòng nào trong nhóm lọc này.
                              </td>
                            </tr>
                          ) : (
                            visibleRows.map(row => {
                              const isEditing = editingRowId === row.id;

                              if (isEditing) {
                                return (
                                  <tr key={row.id} className="bg-amber-50/60">
                                    <td className="py-2 px-2">
                                      <input
                                        type="text"
                                        value={rowEditName}
                                        onChange={e => setRowEditName(e.target.value)}
                                        className="w-full bg-white border border-amber-300 rounded px-2 py-1 text-xs font-bold"
                                      />
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="flex gap-1">
                                        <input
                                          type="text"
                                          value={rowEditCategory}
                                          onChange={e => setRowEditCategory(e.target.value)}
                                          className="w-1/2 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs"
                                        />
                                        <input
                                          type="text"
                                          value={rowEditUnit}
                                          onChange={e => setRowEditUnit(e.target.value)}
                                          className="w-1/2 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs"
                                        />
                                      </div>
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={rowEditCost}
                                        onChange={e => setRowEditCost(Number(e.target.value) || 0)}
                                        className="w-20 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-right"
                                      />
                                    </td>
                                    <td className="py-2 px-2 text-right">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1000"
                                        value={rowEditPrice}
                                        onChange={e => setRowEditPrice(Number(e.target.value) || 0)}
                                        className="w-20 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-right font-bold text-amber-700"
                                      />
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <input
                                        type="number"
                                        min="0"
                                        value={rowEditStock}
                                        onChange={e => setRowEditStock(Number(e.target.value) || 0)}
                                        className="w-16 bg-white border border-amber-300 rounded px-1.5 py-1 text-xs text-center font-bold"
                                      />
                                    </td>
                                    <td colSpan={2} className="py-2 px-2 text-center">
                                      <span className="text-[11px] text-amber-700 italic">
                                        Đang sửa trực tiếp dòng này
                                      </span>
                                    </td>
                                    <td className="py-2 px-2 text-center">
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          onClick={() => saveEditRow(row.id)}
                                          className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px]"
                                        >
                                          Lưu
                                        </button>
                                        <button
                                          onClick={() => setEditingRowId(null)}
                                          className="px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[10px]"
                                        >
                                          Hủy
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr
                                  key={row.id}
                                  className={`hover:bg-slate-50 transition ${
                                    row.diffStatus === 'identical'
                                      ? 'opacity-70 bg-slate-50/40'
                                      : row.isDuplicate
                                      ? 'bg-amber-50/20'
                                      : ''
                                  }`}
                                >
                                  <td className="py-2.5 px-3">
                                    <strong className="text-slate-900 block">{row.name}</strong>
                                  </td>
                                  <td className="py-2.5 px-3 text-slate-500">
                                    {row.category} • {row.unit}
                                  </td>
                                  <td className="py-2.5 px-3 text-right text-slate-600 font-mono">
                                    {formatVND(row.cost)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-bold text-amber-700 font-mono">
                                    {formatVND(row.price)}
                                  </td>
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                                    {row.stock}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {row.isDuplicate && row.existingProduct ? (
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-slate-700 block">
                                          Khớp: {row.existingProduct.name} ({row.existingProduct.id})
                                        </span>
                                        {row.diffs.length === 0 ? (
                                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-bold inline-block">
                                            Giống hệt dữ liệu hiện tại
                                          </span>
                                        ) : (
                                          <div className="flex flex-wrap gap-1">
                                            {row.diffs.map(d => {
                                              const formatVal = (v: string | number) =>
                                                (d.field === 'price' || d.field === 'cost') && typeof v === 'number'
                                                  ? formatVND(v)
                                                  : String(v);
                                              return (
                                                <span
                                                  key={d.field}
                                                  className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-900 text-[10px] font-bold"
                                                >
                                                  {d.label}: {formatVal(d.oldValue)} → {formatVal(d.newValue)}
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {row.action === 'accumulate' && (
                                          <span className="text-[10px] font-bold text-emerald-700 block">
                                            → Kho sau cộng: {row.existingProduct.stock + row.stock} (Giữ nguyên giá cũ)
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-block">
                                        Món mới
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-center">
                                    {row.isDuplicate ? (
                                      <div className="inline-flex flex-wrap justify-center rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[10px] font-bold gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImportRows(prev =>
                                              prev.map(r => (r.id === row.id ? { ...r, action: 'update_info' } : r))
                                            )
                                          }
                                          className={`px-2 py-1 rounded transition ${
                                            row.action === 'update_info'
                                              ? 'bg-sky-600 text-white shadow-2xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                          title="Cập nhật giá, ĐVT, danh mục nhưng giữ nguyên tồn kho hiện tại"
                                        >
                                          Giữ kho (Sửa giá/ĐVT)
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImportRows(prev =>
                                              prev.map(r => (r.id === row.id ? { ...r, action: 'overwrite' } : r))
                                            )
                                          }
                                          className={`px-2 py-1 rounded transition ${
                                            row.action === 'overwrite'
                                              ? 'bg-rose-500 text-white shadow-2xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                          title="Ghi đè toàn bộ giá, ĐVT và số tồn kho bằng file"
                                        >
                                          Ghi đè
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImportRows(prev =>
                                              prev.map(r => (r.id === row.id ? { ...r, action: 'accumulate' } : r))
                                            )
                                          }
                                          className={`px-2 py-1 rounded transition ${
                                            row.action === 'accumulate'
                                              ? 'bg-amber-500 text-white shadow-2xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                          title="Cộng thêm tồn kho từ file vào kho hiện tại (giữ nguyên giá hiện có)"
                                        >
                                          Cộng kho
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setImportRows(prev =>
                                              prev.map(r => (r.id === row.id ? { ...r, action: 'skip' } : r))
                                            )
                                          }
                                          className={`px-2 py-1 rounded transition ${
                                            row.action === 'skip'
                                              ? 'bg-slate-600 text-white shadow-2xs'
                                              : 'text-slate-600 hover:text-slate-900'
                                          }`}
                                          title="Bỏ qua dòng này, không thay đổi"
                                        >
                                          Bỏ qua
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-[11px] font-bold text-emerald-700">Thêm mới</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => startEditRow(row)}
                                      className="p-1.5 rounded-lg border border-slate-200 hover:bg-amber-50 hover:text-amber-600 text-slate-500 transition"
                                      title="Sửa nhanh thông tin món trước khi nhập"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Modal Footer Controls */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0 text-xs font-bold">
              <span className="text-[11px] text-slate-500">
                Sẽ xử lý <strong>{importRows.length}</strong> món vào thực đơn & kho
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận nhập kho</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
