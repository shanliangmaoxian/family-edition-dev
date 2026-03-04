'use client';

import { useState, useEffect, useTransition } from 'react';
import { searchProducts, addProduct, backupDatabase, checkForUpdates, recordBatchTransaction, getTransactionHistory, getBillDetails, deleteProduct, askConfirm, showMessage, exportInventoryToExcel, exportBillToExcel } from '@/lib/actions-client';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  
  // 弹窗状态
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState<'in' | 'out' | null>(null);
  const [selectedBill, setSelectedBill] = useState<any>(null);
  const [billItems, setBillItems] = useState<any[]>([]);
  
  // 订单录入中的“清单”
  const [orderCart, setOrderCart] = useState<any[]>([]);
  const [orderRemark, setOrderRemark] = useState('');
  const [actualAmount, setActualAmount] = useState<number>(0);

  // 当订单内容变化时，自动更新实收金额默认值
  const calculatedTotal = orderCart.reduce((s, i) => s + (i.qty * i.curPrice), 0);
  
  useEffect(() => {
    setActualAmount(calculatedTotal);
  }, [calculatedTotal]);

  useEffect(() => {
    setMounted(true);
    refreshData();
    checkForUpdates();
  }, []);

  const refreshData = async () => {
    const p = await searchProducts('');
    const h = await getTransactionHistory();
    setProducts(p || []);
    setHistory(h || []);
  };

  const handleSearch = async (val: string) => {
    setQuery(val);
    const results = await searchProducts(val);
    setProducts(results || []);
  };

  const addToOrder = (p: any) => {
    if (orderCart.find(i => i.id === p.id)) return;
    setOrderCart([...orderCart, { ...p, qty: 1, curPrice: p.price }]);
  };

  const submitOrder = async () => {
    if (orderCart.length === 0 || !showOrderModal) return;
    if (!orderRemark.trim()) {
      await showMessage(`请先输入${showOrderModal === 'in' ? '供应商名称' : '客户名称'}或备注信息！`, '提示');
      return;
    }
    
    startTransition(async () => {
      const billNo = await recordBatchTransaction({
        type: showOrderModal,
        remark: orderRemark,
        actualAmount: actualAmount,
        items: orderCart.map(i => ({ productId: i.id, quantity: i.qty, price: i.curPrice }))
      });
      
      await showMessage(`✅ 单据已生成！\n单号：${billNo}`, '过账成功');
      setShowOrderModal(null);
      setOrderCart([]);
      setOrderRemark('');
      refreshData();
    });
  };

  const handleDeleteProduct = async (p: any) => {
    const ok = await askConfirm(`确定要彻底删除 [${p.name}] 吗？`, '删除商品确认');
    if (!ok) return;
    try {
      const res = await deleteProduct(p.id);
      if (res) refreshData();
    } catch (e: any) {
      await showMessage(`无法删除：${e.message || '该商品可能有关联单据。'}`, '删除失败');
    }
  };

  const handleBillClick = async (bill: any) => {
    const details = await getBillDetails(bill.bill_no);
    setBillItems(details || []);
    setSelectedBill(bill);
  };

  const handleBackup = async () => {
    const res = await backupDatabase();
    if (res.success) {
      await showMessage(`✅ 备份成功！已保存到：\n${res.path}`, '备份成功');
    } else {
      await showMessage(`❌ 备份失败：${res.message}`, '备份失败');
    }
  };

  const handleExportExcel = async () => {
    const res = await exportInventoryToExcel();
    if (res?.success) {
      await showMessage(`📊 导出成功！可以用 Excel 直接打开：\n${res.path}`, '导出成功');
    } else if (res) {
      await showMessage(`❌ 导出失败：${res.message}`, '导出失败');
    }
  };

  const handleExportBill = async () => {
    if (!selectedBill || billItems.length === 0) return;
    const res = await exportBillToExcel(selectedBill, billItems);
    if (res?.success) {
      await showMessage(`📄 单据已导出！请将其发送至微信：\n${res.path}`, '导出成功');
    }
  };

  const handleCopySummary = async () => {
    if (!selectedBill || billItems.length === 0) return;
    const total = selectedBill.total_amount || 0;
    const actual = selectedBill.actual_amount ?? total;
    const discount = Math.max(0, total - actual);

    const text = `【九月进销存 - ${selectedBill.type === 'in' ? '入库单' : '出库单'}】
客户/备注：${selectedBill.remark || '无'}
单号：${selectedBill.bill_no}
日期：${selectedBill.time}
--------------------
${billItems.map(i => `· ${i.name}[${i.spec || '常规'}] x${i.quantity}${i.unit} (单价¥${i.price})`).join('\n')}
--------------------
应收合计：¥${total.toFixed(2)}
实收合计：¥${actual.toFixed(2)}
抹零优惠：¥${discount.toFixed(2)}
(本信息由九月进销存自动生成)`;

    await navigator.clipboard.writeText(text);
    await showMessage('📋 摘要已复制到剪贴板，请直接到微信粘贴。', '复制成功');
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-100 flex flex-col font-sans">
      
      <header className="bg-blue-700 text-white px-8 py-4 flex justify-between items-center shadow-lg">
        <div className="flex items-center gap-6">
          <h1 className="text-3xl font-black tracking-tighter italic">九月进销存 <span className="text-xs font-normal opacity-60 not-italic ml-2">财源广进</span></h1>
          <div className="flex gap-2">
            <button onClick={() => setShowOrderModal('in')} className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-xl font-bold transition-all border border-white/10">➕ 新增入库单</button>
            <button onClick={() => setShowOrderModal('out')} className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-xl font-bold transition-all shadow-md">📤 新增出库单</button>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={handleExportExcel} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold text-sm transition-all border border-white/5">📊 导出库存</button>
          <button onClick={handleBackup} className="text-sm opacity-80 hover:opacity-100">💾 数据备份</button>
        </div>
      </header>

      <div className="flex-1 flex p-6 gap-6 overflow-hidden">
        
        <section className="flex-[2] bg-white rounded-3xl shadow-xl border border-slate-200 flex flex-col overflow-hidden">
          <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">📦 当前实时库存清单</h2>
            <div className="flex gap-2">
              <input 
                placeholder="快速筛选名称/分类..." 
                className="px-4 py-2 bg-white border rounded-xl outline-none focus:border-blue-500 w-64"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
              <button onClick={() => setShowAddProduct(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold text-sm">+ 新增品项</button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0 bg-white/90 backdrop-blur z-10 shadow-sm text-slate-400 text-sm border-b">
                <tr>
                  <th className="p-6 text-left font-bold">商品分类 / 名称 / 规格</th>
                  <th className="p-6 text-right font-bold">参考价</th>
                  <th className="p-6 text-right font-bold text-slate-800">当前库存</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="p-6 relative group">
                      <div className="flex justify-between items-center pr-10">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-50 text-blue-500 text-[10px] px-2 py-0.5 rounded-md font-black uppercase">{p.category}</span>
                          </div>
                          <div className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                            {p.name} 
                            <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-sm font-bold border border-slate-100">
                              {p.spec || '无规格'}
                            </span>
                          </div>
                          <div className="text-slate-300 text-sm mt-0.5">单位: {p.unit}</div>
                        </div>
                        <button 
                          onClick={() => handleDeleteProduct(p)}
                          className="opacity-0 group-hover:opacity-100 p-2 text-slate-200 hover:text-red-500 transition-all text-sm font-bold bg-slate-50 rounded-lg shadow-sm border"
                          title="删除商品"
                        >
                          🗑️ 删除
                        </button>
                      </div>
                    </td>
                    <td className="p-6 text-right text-slate-400 text-xl">¥ {(p.price || 0).toFixed(2)}</td>
                    <td className="p-6 text-right">
                      <div className={`text-4xl font-black tracking-tighter ${p.stock <= 2 ? 'text-red-500' : 'text-blue-700'}`}>
                        {p.stock} <span className="text-sm font-normal text-slate-400">{p.unit}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex-1 bg-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-white">
          <div className="p-6 border-b border-white/10 bg-white/5">
            <h2 className="text-xl font-black flex items-center gap-2 italic">📝 最近出入库单据</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.map(h => {
              const hTotal = h.total_amount || 0;
              const hActual = h.actual_amount ?? hTotal;
              return (
                <div 
                  key={h.bill_no} 
                  onClick={() => handleBillClick(h)}
                  className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/15 transition-all group cursor-pointer active:scale-95"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${h.type === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                      {h.type === 'in' ? '采购入库' : '销售出库'}
                    </span>
                    <span className="text-[10px] text-white/30">{h.time}</span>
                  </div>
                  <div className="font-bold text-sm text-white/90 truncate mb-1">{h.remark || '无备注'}</div>
                  <div className="flex justify-between items-end border-t border-white/5 pt-2">
                    <div className="text-[10px] text-white/40">{h.item_count} 件商品</div>
                    <div className="text-right">
                      {hTotal > hActual && <div className="text-[9px] text-white/30 line-through">¥{hTotal.toFixed(2)}</div>}
                      <div className="text-xl font-bold text-white/90">¥ {hActual.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {showOrderModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 z-[100] animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl h-full max-h-[90vh] rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className={`p-8 flex justify-between items-center text-white ${showOrderModal === 'in' ? 'bg-blue-600' : 'bg-orange-600'}`}>
              <div>
                <h2 className="text-4xl font-black italic">生成 {showOrderModal === 'in' ? '采购入库单' : '销售出库单'}</h2>
                <div className="mt-2 flex gap-4">
                  <input 
                    placeholder={showOrderModal === 'in' ? '请输入供应商名称或备注...' : '请输入客户名称或备注...'}
                    className="bg-white/20 border border-white/10 rounded-xl px-4 py-2 w-96 outline-none focus:bg-white/30 transition-all placeholder:text-white/50 text-xl"
                    value={orderRemark}
                    onChange={(e) => setOrderRemark(e.target.value)}
                  />
                </div>
              </div>
              <button onClick={() => setShowOrderModal(null)} className="bg-black/20 hover:bg-black/40 w-12 h-12 rounded-full flex items-center justify-center text-2xl">✕</button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              <div className="w-1/2 border-r flex flex-col bg-slate-50">
                <div className="p-6 border-b bg-white">
                  <input 
                    placeholder="🔍 搜索商品..." 
                    className="w-full p-4 rounded-2xl border-2 border-slate-100 outline-none focus:border-blue-500 text-xl shadow-sm"
                    onChange={(e) => handleSearch(e.target.value)}
                  />
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {products.map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => addToOrder(p)}
                      className={`p-4 rounded-2xl border flex justify-between items-center cursor-pointer transition-all ${orderCart.find(i => i.id === p.id) ? 'bg-blue-600 border-blue-600 text-white shadow-lg scale-95' : 'bg-white hover:border-blue-300'}`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1 rounded ${orderCart.find(i => i.id === p.id) ? 'bg-white/20' : 'bg-slate-100'}`}>{p.category}</span>
                          <div className="font-bold text-xl">{p.name}</div>
                        </div>
                        <div className={`text-xs ${orderCart.find(i => i.id === p.id) ? 'text-white/60' : 'text-slate-400'}`}>规格: {p.spec} | 库存: {p.stock}</div>
                      </div>
                      <div className="font-mono font-bold">¥{(p.price || 0).toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-1/2 flex flex-col bg-white shadow-inner overflow-hidden">
                {/* 产品清单区 - 确保占据足够空间 */}
                <div className="flex-1 overflow-y-auto p-8 space-y-4">
                  {orderCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-4">
                      <div className="text-6xl italic opacity-20">EMPTY</div>
                      <p className="font-bold">点击左侧商品加入单据</p>
                    </div>
                  ) : (
                    orderCart.map((item, idx) => (
                      <div key={item.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-bold text-slate-800"><span className="text-slate-300 font-mono mr-2">{idx+1}.</span>{item.name}</span>
                          <button onClick={() => setOrderCart(orderCart.filter(i => i.id !== item.id))} className="text-red-400 text-sm font-bold">移除</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border">
                            <label className="text-[10px] font-bold text-slate-400">数量:</label>
                            <input 
                              type="number" 
                              value={item.qty} 
                              onChange={(e) => setOrderCart(orderCart.map(i => i.id === item.id ? {...i, qty: parseFloat(e.target.value) || 0} : i))}
                              className="flex-1 bg-transparent text-xl font-bold text-blue-600 outline-none w-20"
                            />
                            <span className="text-xs text-slate-400">{item.unit}</span>
                          </div>
                          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-xl border">
                            <label className="text-[10px] font-bold text-slate-400">单价:</label>
                            <input 
                              type="number" 
                              value={item.curPrice} 
                              onChange={(e) => setOrderCart(orderCart.map(i => i.id === item.id ? {...i, curPrice: parseFloat(e.target.value) || 0} : i))}
                              className="flex-1 bg-transparent text-xl font-bold text-slate-700 outline-none w-24"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                {/* 底部结算区 - 锁定右侧按钮，防止被输入框挤压 */}
                <div className="p-6 border-t bg-slate-100 flex-shrink-0">
                  <div className="flex gap-4">
                    {/* 左侧区域：占据剩余所有空间 */}
                    <div className="flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-2 px-1">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">系统计算应收合计</span>
                          <span className="text-2xl font-black text-slate-700 tracking-tighter italic bg-slate-200/50 px-2 py-0.5 rounded-lg border border-slate-300 shadow-sm">¥ {calculatedTotal.toFixed(2)}</span>
                        </div>
                        {calculatedTotal > actualAmount && (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest">本次已优惠</span>
                            <div className="text-xl font-black text-orange-600">- ¥{(calculatedTotal - actualAmount).toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                      <div className="bg-white px-3 py-2 rounded-xl border-4 border-blue-600 flex items-center shadow-lg overflow-hidden">
                        <span className="text-xl font-black text-blue-600 italic mr-2 flex-shrink-0">实收¥</span>
                        <input 
                          type="number"
                          value={actualAmount}
                          onChange={(e) => setActualAmount(parseFloat(e.target.value) || 0)}
                          className="w-full bg-transparent text-3xl font-black text-slate-900 outline-none min-w-[50px] text-right"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* 右侧区域：固定宽度，绝对保证可见 */}
                    <div className="w-48 flex-shrink-0 h-24">
                      <button 
                        disabled={orderCart.length === 0 || isPending}
                        onClick={submitOrder}
                        className={`w-full h-full rounded-2xl font-black text-xl shadow-xl transition-all active:scale-95 flex items-center justify-center ${showOrderModal === 'in' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'} text-white disabled:bg-slate-300`}
                      >
                        {isPending ? '提交中' : '立即过账'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddProduct && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[101]">
          <div className="bg-white w-full max-w-lg rounded-[40px] p-10 shadow-2xl animate-in zoom-in duration-200">
            <h2 className="text-3xl font-black mb-8 text-slate-800 italic">➕ 新增商品</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await addProduct({
                name: f.get('name') as string,
                spec: f.get('spec') as string,
                category: f.get('category') as string,
                unit: f.get('unit') as string,
                price: parseFloat(f.get('price') as string || '0'),
                initialStock: parseFloat(f.get('stock') as string || '0')
              });
              setShowAddProduct(false);
              refreshData();
            }} className="space-y-6">
              <input name="name" required placeholder="商品名称" className="w-full p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 text-2xl outline-none focus:border-blue-400" />
              <div className="grid grid-cols-2 gap-4">
                <input name="category" defaultValue="三角带" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xl outline-none focus:border-blue-400" />
                <input name="spec" placeholder="规格" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xl outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input name="unit" defaultValue="条" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xl outline-none" />
                <input name="price" type="number" step="0.01" placeholder="默认单价" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xl outline-none" />
              </div>
              <input name="stock" type="number" step="0.01" placeholder="初始库存" className="w-full p-4 bg-slate-50 rounded-2xl border-2 border-slate-100 text-xl outline-none" />
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowAddProduct(false)} className="flex-1 py-5 rounded-2xl font-bold text-slate-400">取消</button>
                <button type="submit" className="flex-1 py-5 rounded-2xl bg-slate-900 text-white font-bold shadow-lg">确认入库</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedBill && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-8 z-[120]">
          <div className="bg-white w-full max-w-3xl rounded-[40px] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in duration-200">
            <div className={`p-8 text-white flex justify-between items-start ${selectedBill.type === 'in' ? 'bg-blue-600' : 'bg-orange-600'}`}>
              <div>
                <h2 className="text-3xl font-black italic">{selectedBill.type === 'in' ? '📥 入库单' : '📤 出库单'}</h2>
                <div className="mt-2 font-bold text-xl">{selectedBill.remark || '无备注'}</div>
                <div className="mt-2 text-white/50 font-mono text-xs">{selectedBill.bill_no}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCopySummary} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-white/10">📋 复制摘要</button>
                <button onClick={handleExportBill} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm font-bold transition-all border border-white/10">📊 导出本单</button>
                <button onClick={() => setSelectedBill(null)} className="bg-black/20 hover:bg-black/40 w-10 h-10 rounded-full flex items-center justify-center ml-2">✕</button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              <div className="space-y-4">
                {billItems.map((item, i) => (
                  <div key={i} className="flex justify-between items-center border-b pb-4 border-slate-50 last:border-0">
                    <div>
                      <div className="text-[9px] bg-slate-100 text-slate-400 px-1 rounded inline-block mb-1">{item.category}</div>
                      <div className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        {item.name} <span className="text-slate-400 text-sm font-normal">[{item.spec || '无'}]</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-xl text-slate-700">{item.quantity} <span className="text-sm font-normal text-slate-400">{item.unit}</span></div>
                      <div className="text-sm text-slate-400">单价 ¥{(item.price || 0).toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(() => {
              const sTotal = selectedBill.total_amount || 0;
              const sActual = selectedBill.actual_amount ?? sTotal;
              const sDiscount = Math.max(0, sTotal - sActual);
              return (
                <div className="p-8 bg-slate-50 border-t flex justify-between items-center px-12">
                  <div className="flex gap-8">
                    <div>
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">应收金额</div>
                      <div className="text-2xl font-bold text-slate-400 line-through italic">¥{sTotal.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">实收金额</div>
                      <div className="text-4xl font-black text-slate-900 italic">¥ {sActual.toFixed(2)}</div>
                    </div>
                  </div>
                  {sDiscount > 0 && <div className="text-right text-orange-500 font-black italic text-xl">优惠 ¥{sDiscount.toFixed(2)}</div>}
                </div>
              );
            })()}
          </div>
        </div>
      )}

    </main>
  );
}
