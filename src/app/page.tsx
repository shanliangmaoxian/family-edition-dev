'use client';

import { useState, useEffect, useTransition } from 'react';
import { searchProducts, recordTransaction, addProduct, backupDatabase, checkForUpdates } from '@/lib/actions-client';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isPending, startTransition] = useTransition();
  const [showAddForm, setShowAddForm] = useState(false);

  // 初始化检查
  useEffect(() => {
    setMounted(true);
    // 延迟 100ms 搜索，确保 Tauri 环境已就绪
    const timer = setTimeout(() => {
      handleSearch('');
      checkForUpdates();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (typeof window !== 'undefined') {
      const results = await searchProducts(val);
      setProducts(results || []);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-gray-50 flex items-center justify-center font-bold">载入中...</div>;

  const handleTransaction = async (type: 'in' | 'out', e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const quantity = parseFloat(formData.get('quantity') as string);
    const price = parseFloat(formData.get('price') as string);

    startTransition(async () => {
      await recordTransaction({
        productId: selectedProduct.id,
        type,
        quantity,
        price,
        remark: ''
      });
      setSelectedProduct(null);
      handleSearch(query);
    });
  };

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await addProduct({
        name: formData.get('name') as string,
        spec: formData.get('spec') as string,
        unit: formData.get('unit') as string,
        price: parseFloat(formData.get('price') as string || '0'),
        initialStock: parseFloat(formData.get('stock') as string || '0'),
      });
      setShowAddForm(false);
      handleSearch(query);
    });
  };

  const handleBackup = async () => {
    const res = await backupDatabase();
    if (res.success) {
      alert(`✅ 备份成功！已保存到桌面：\n${res.path}`);
    } else {
      alert(`❌ 备份失败：${res.message}`);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 md:p-8 text-xl">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h1 className="text-4xl font-bold text-blue-600">家庭进销存</h1>
          <button 
            onClick={handleBackup}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg transition-all active:scale-95"
          >
            💾 一键备份到桌面
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <input
            type="text"
            placeholder="🔍 搜索名称或规格..."
            className="flex-1 p-5 rounded-2xl border-2 border-gray-200 focus:border-blue-400 outline-none text-2xl shadow-sm"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <button 
            onClick={() => setShowAddForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-5 rounded-2xl font-bold text-2xl shadow-lg transition-all active:scale-95"
          >
            ➕ 新增商品
          </button>
        </div>

        {/* Product List */}
        <div className="grid gap-4">
          {products.map((p) => (
            <div 
              key={p.id} 
              className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4 hover:border-blue-200 transition-colors"
            >
              <div className="flex-1">
                <div className="font-bold text-3xl text-gray-800">{p.name}</div>
                <div className="text-gray-500 mt-1">
                  规格: <span className="text-gray-700">{p.spec || '无'}</span> | 单位: {p.unit}
                </div>
              </div>
              
              <div className="text-right flex items-center gap-8">
                <div className="text-center">
                  <div className="text-gray-400 text-sm uppercase">当前库存</div>
                  <div className={`text-4xl font-black ${p.stock <= 2 ? 'text-red-500' : 'text-blue-600'}`}>
                    {p.stock} <span className="text-lg font-normal text-gray-400">{p.unit}</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    onClick={() => setSelectedProduct({ ...p, mode: 'in' })}
                    className="bg-orange-100 text-orange-600 hover:bg-orange-500 hover:text-white p-4 rounded-xl font-bold transition-colors"
                  >
                    📥 入库
                  </button>
                  <button 
                    onClick={() => setSelectedProduct({ ...p, mode: 'out' })}
                    className="bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white p-4 rounded-xl font-bold transition-colors"
                  >
                    📤 出库
                  </button>
                </div>
              </div>
            </div>
          ))}
          {products.length === 0 && (
            <div className="text-center py-20 text-gray-400 italic">暂无商品，请点击“新增商品”</div>
          )}
        </div>

        {/* In/Out Form Modal */}
        {selectedProduct && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
              <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
                {selectedProduct.mode === 'in' ? '📥 确认入库' : '📤 确认出库'}
                <span className="text-blue-600">[{selectedProduct.name}]</span>
              </h2>
              <form onSubmit={(e) => handleTransaction(selectedProduct.mode, e)} className="space-y-6">
                <div>
                  <label className="block text-gray-500 mb-2">数量 ({selectedProduct.unit})</label>
                  <input name="quantity" type="number" step="0.01" required autoFocus className="w-full p-5 bg-gray-50 rounded-xl border-2 border-gray-200 text-3xl outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-gray-500 mb-2">{selectedProduct.mode === 'in' ? '买入' : '卖出'}价格 (元)</label>
                  <input name="price" type="number" step="0.01" defaultValue={selectedProduct.price} required className="w-full p-5 bg-gray-50 rounded-xl border-2 border-gray-200 text-3xl outline-none focus:border-blue-400" />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setSelectedProduct(null)} className="flex-1 py-5 rounded-2xl bg-gray-100 font-bold text-gray-500 hover:bg-gray-200 transition-colors">取消</button>
                  <button type="submit" disabled={isPending} className="flex-1 py-5 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-all">
                    {isPending ? '提交中...' : '确认提交'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Product Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
              <h2 className="text-3xl font-bold mb-6">➕ 新增商品资料</h2>
              <form onSubmit={handleAddProduct} className="space-y-5">
                <div>
                  <label className="block text-gray-500 mb-1">商品名称</label>
                  <input name="name" required placeholder="例如：大米、鸡蛋" className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-2xl outline-none focus:border-blue-400" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1">规格</label>
                    <input name="spec" placeholder="例如：5kg/袋" className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-2xl outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">单位</label>
                    <input name="unit" defaultValue="个" className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-2xl outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-500 mb-1">初始价格</label>
                    <input name="price" type="number" step="0.01" defaultValue="0" className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-2xl outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-gray-500 mb-1">初始库存</label>
                    <input name="stock" type="number" step="0.01" defaultValue="0" className="w-full p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-2xl outline-none focus:border-blue-400" />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowAddForm(false)} className="flex-1 py-5 rounded-2xl bg-gray-100 font-bold text-gray-500 hover:bg-gray-200 transition-colors">取消</button>
                  <button type="submit" disabled={isPending} className="flex-1 py-5 rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg disabled:opacity-50 transition-all">
                    {isPending ? '提交中...' : '确认添加'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
