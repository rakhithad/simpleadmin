import React, { useState } from 'react';
import axios from 'axios';

const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

export default function PaymentTerminal({ booking, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [payData, setPayData] = useState({ 
    amount: '', 
    method: 'BANK', 
    date: new Date().toISOString().split('T')[0],
    creditNoteId: null 
  });

  const [searchFolder, setSearchFolder] = useState('');
  const [foundWallet, setFoundWallet] = useState(null);
  const [searchError, setSearchError] = useState('');

  // --- CALCULATIONS ---
  const depositTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const transactionTotal = booking.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalCollected = depositTotal + transactionTotal;

  const expectedRevenue = booking.revenue || 0;
  const expectedProfit = booking.profit || 0;
  const productCost = booking.prodCost || 0;
  
  const realizedProfit = totalCollected - productCost;
  const difference = totalCollected - expectedRevenue;

  const totalInstalmentExpected = booking.instalments?.reduce((sum, i) => sum + i.amount, 0) || 0;
  const overpaidAmount = Math.max(0, transactionTotal - totalInstalmentExpected);

  // --- MILESTONE BAR MATH ---
  const maxScale = Math.max(expectedRevenue, totalCollected, productCost, 1); 
  const costPercent = Math.min((productCost / maxScale) * 100, 100);
  const revPercent = Math.min((expectedRevenue / maxScale) * 100, 100);
  const collectedPercent = Math.min((totalCollected / maxScale) * 100, 100);
  const isOverpaid = totalCollected > expectedRevenue;
  const depositPercent = Math.min((depositTotal / maxScale) * 100, 100);
  
  let cumulativePlan = depositTotal;
  const instMilestones = booking.instalments?.map((inst, i) => {
      cumulativePlan += inst.amount;
      return {
          label: `INST ${i+1}`,
          amount: cumulativePlan,
          percent: Math.min((cumulativePlan / maxScale) * 100, 100)
      };
  }) || [];

  const searchPaxWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/bookings/credits/pax/search?folder=${searchFolder}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.data.success) {
        setFoundWallet(res.data.data);
        setSearchError('');
      } else {
        setFoundWallet(null);
        setSearchError(res.data.message);
      }
    } catch (setSearchError) { setSearchError("Wallet not found."); }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if(!payData.amount) return;

    if(payData.method === 'PAX_CREDIT' && (!foundWallet || parseFloat(payData.amount) > foundWallet.remainingAmount)) {
        return alert("Invalid credit amount or wallet not found.");
    }

    try {
      const token = localStorage.getItem('token');
      const payload = { ...payData, creditNoteId: foundWallet?.id };
      await axios.post(`http://localhost:5000/api/bookings/${booking.id}/transactions`, payload, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      alert("Payment Allocated Successfully!");
      setShowAddModal(false);
      setFoundWallet(null); 
      setSearchFolder(''); 
      setPayData({ amount: '', method: 'BANK', date: new Date().toISOString().split('T')[0], creditNoteId: null });
      onUpdate(); 
    } catch (alert) { alert("Failed to record payment"); }
  };

  const handleSettle = async () => {
    const msg = difference < 0 ? `Deficit of ${formatMoney(Math.abs(difference))}. Write off?` : `Surplus of ${formatMoney(difference)}. Settle?`;
    if(!window.confirm(msg)) return;
    try {
        const token = localStorage.getItem('token');
        await axios.post(`http://localhost:5000/api/bookings/${booking.id}/settle`, {}, { headers: { Authorization: `Bearer ${token}` } });
        onUpdate();
    } catch (alert) { alert("Failed to settle"); }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 mt-6 shadow-sm">
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-3">
          <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-lg text-sm">💳</span>
          Client Payment Terminal
          {booking.isSettled && <span className="bg-slate-800 text-white text-[10px] px-2.5 py-1 rounded-full uppercase tracking-wider font-bold shadow-sm">Settled & Closed</span>}
        </h3>
        {!booking.isSettled && !booking.isLocked && (
           <button onClick={() => setShowAddModal(true)} className="text-xs bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5">
             + Record Payment
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT: THE PLAN */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Expected Plan</h4>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
             {booking.instalments?.length === 0 ? (
                <div className="text-sm text-slate-400 italic text-center py-4">Full Payment Booking</div>
             ) : (
                booking.instalments?.map(inst => {
                  const percentage = Math.min(((inst.paidAmount || 0) / (inst.amount || 1)) * 100, 100);
                  const isFullyPaid = inst.status === 'PAID' || (inst.paidAmount >= inst.amount - 0.05);

                  return (
                    <div key={inst.id} className="flex justify-between items-center text-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-700">{inst.dueDate.split('T')[0]}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isFullyPaid ? 'text-emerald-500' : (inst.paidAmount > 0 ? 'text-blue-500' : 'text-slate-400')}`}>
                          {isFullyPaid ? 'PAID' : (inst.paidAmount > 0 ? 'PARTIAL' : 'PENDING')}
                        </span>
                      </div>
                      <div className="text-right w-32">
                        <span className="block font-bold text-slate-800 font-mono">{formatMoney(inst.amount)}</span>
                        <div className="w-full h-1.5 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                            <div className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
             )}
             
             <div className="border-t border-slate-200 pt-3 flex flex-col gap-1">
               <div className="flex justify-between font-bold text-slate-800 text-sm">
                 <span>Contract Revenue</span><span className="font-mono">{formatMoney(expectedRevenue)}</span>
               </div>
               {overpaidAmount > 0 && (
                 <div className="flex justify-between font-bold text-xs bg-purple-50 text-purple-700 p-2 rounded-lg border border-purple-100 mt-2">
                   <span>Overpaid by Client</span><span className="font-mono">+{formatMoney(overpaidAmount)}</span>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* RIGHT: PASSENGER PAYMENTS */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-widest">Passenger Payments</h4>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 h-[180px] overflow-y-auto space-y-3 custom-scrollbar">
             {booking.initialPayments?.map(p => (
               <div key={`init-${p.id}`} className="flex justify-between items-center text-sm text-slate-600 border-b border-dashed border-slate-200 pb-2">
                 <div className="flex flex-col">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>{p.paymentDate.split('T')[0]}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-3.5">
                       Deposit ({p.transactionMethod}) 
                       {/* DISPLAY SOURCE FOLDER FOR DEPOSITS */}
                       {p.paxCreditNote && <span className="text-purple-600 font-bold ml-1">FROM FOLDER: {p.paxCreditNote.booking?.folderNo}</span>}
                    </span>
                 </div>
                 <span className="font-mono font-bold text-slate-800">{formatMoney(p.amount)}</span>
               </div>
             ))}
             {booking.transactions?.map(t => (
               <div key={`trans-${t.id}`} className="flex justify-between items-center text-sm text-slate-600 border-b border-dashed border-slate-200 pb-2">
                 <div className="flex flex-col">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span>{t.date.split('T')[0]}</span>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest ml-3.5">
                       Instalment ({t.method})
                       {/* DISPLAY SOURCE FOLDER FOR INSTALMENTS */}
                       {t.paxCreditNote && <span className="text-purple-600 font-bold ml-1">FROM FOLDER: {t.paxCreditNote.booking?.folderNo}</span>}
                    </span>
                 </div>
                 <span className="font-mono font-bold text-slate-800">{formatMoney(t.amount)}</span>
               </div>
             ))}
             {(!booking.transactions?.length && !booking.initialPayments?.length) && (
                <div className="h-full flex items-center justify-center text-sm text-slate-400 italic">No payments recorded yet</div>
             )}
          </div>
        </div>
      </div>

      {/* --- MILESTONE TRACKER --- */}
      <div className="mt-8 px-5 bg-white border border-slate-100 rounded-xl pb-10 pt-5 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-8 tracking-widest flex justify-between">
          <span>Financial Milestone Tracker</span>
          <span className="text-slate-500">Collected: <strong className="text-blue-600 text-sm font-mono">{formatMoney(totalCollected)}</strong></span>
        </h4>
        
        <div className="relative w-full">
           {productCost > 0 && (
             <div className="absolute bottom-full mb-1.5 w-0 flex flex-col items-center z-10" style={{ left: `${costPercent}%` }}>
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 whitespace-nowrap shadow-sm">COST {formatMoney(productCost)}</span>
                <div className="h-2 w-[2px] bg-rose-400 mt-1"></div>
             </div>
           )}
           {expectedRevenue > 0 && (
             <div className="absolute bottom-full mb-1.5 w-0 flex flex-col items-center z-10" style={{ left: `${revPercent}%` }}>
                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 whitespace-nowrap shadow-sm">REV {formatMoney(expectedRevenue)}</span>
                <div className="h-2 w-[2px] bg-blue-400 mt-1"></div>
             </div>
           )}
           
           <div className="relative w-full h-5 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200">
              <div className={`absolute top-0 left-0 h-full transition-all duration-1000 ease-out ${isOverpaid ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-500'}`} style={{ width: `${collectedPercent}%` }}></div>
              <div className="absolute top-0 bottom-0 border-l-2 border-rose-500 z-20" style={{ left: `${costPercent}%` }}></div>
              <div className="absolute top-0 bottom-0 border-l-2 border-blue-500 z-20" style={{ left: `${revPercent}%` }}></div>
              {depositTotal > 0 && <div className="absolute top-0 bottom-0 border-l border-white/50 z-20" style={{ left: `${depositPercent}%` }}></div>}
              {instMilestones.map((m, i) => (
                  <div key={`line-${i}`} className="absolute top-0 bottom-0 border-l border-white/50 z-20" style={{ left: `${m.percent}%` }}></div>
              ))}
           </div>

           {depositTotal > 0 && (
             <div className="absolute top-full mt-1.5 w-0 flex flex-col items-center z-10" style={{ left: `${depositPercent}%` }}>
                <div className="h-2 w-[2px] bg-slate-300 mb-1"></div>
                <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap uppercase tracking-wider">DEP {formatMoney(depositTotal)}</span>
             </div>
           )}
           {instMilestones.map((m, i) => (
             <div key={`marker-${i}`} className="absolute top-full mt-1.5 w-0 flex flex-col items-center z-10" style={{ left: `${m.percent}%` }}>
                <div className="h-2 w-[2px] bg-slate-300 mb-1"></div>
                <span className="text-[9px] font-bold text-slate-500 whitespace-nowrap uppercase tracking-wider">{m.label} {formatMoney(m.amount)}</span>
             </div>
           ))}
        </div>
      </div>

      {/* --- REDESIGNED COMPARISON & SETTLE BAR --- */}
      <div className="mt-8 bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4 shadow-sm">
        
        <div className="flex gap-8">
            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Profit</span>
                <span className="text-xl font-bold text-slate-700 font-mono">{formatMoney(expectedProfit)}</span>
            </div>
            
            <div className="w-px bg-slate-200"></div>

            <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Realized Profit (Cash)</span>
                <div className="flex items-center gap-2">
                    <span className={`text-xl font-bold font-mono ${realizedProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {formatMoney(realizedProfit)}
                    </span>
                    {realizedProfit < 0 && <span className="bg-rose-100 text-rose-700 text-[9px] px-1.5 rounded font-bold uppercase">Loss</span>}
                </div>
            </div>
        </div>

        <div>
            {!booking.isSettled ? (
               <button 
                  onClick={handleSettle} 
                  className={`px-8 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95 ${difference < -1 ? 'bg-gradient-to-r from-orange-500 to-rose-500 shadow-rose-500/30' : 'bg-gradient-to-r from-slate-800 to-slate-900 shadow-slate-900/30'}`}
               >
                 {difference < -1 ? 'Write Off & Close File' : 'Settle & Close File'}
               </button>
            ) : (
               <div className="px-6 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-400 uppercase tracking-widest shadow-inner">
                  Closed
               </div>
            )}
        </div>
      </div>

      {/* --- ADD TRANSACTION MODAL --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
           <form onSubmit={handleTransactionSubmit} className="bg-white p-8 rounded-2xl w-96 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold mb-6 text-slate-800 text-xl tracking-tight">Record Client Payment</h3>
              <div className="space-y-5">
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Method</label>
                      <select 
                        className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
                        value={payData.method}
                        onChange={e => {
                          setPayData({...payData, method: e.target.value});
                          if (e.target.value !== 'PAX_CREDIT') setFoundWallet(null);
                        }}
                      >
                         <option value="BANK">Bank Transfer</option>
                         <option value="CASH">Cash</option>
                         <option value="CARD">Card</option>
                         <option value="PAX_CREDIT">Use Pax Credit Note</option>
                      </select>
                  </div>

                  {/* WALLET SEARCH */}
                  {payData.method === 'PAX_CREDIT' && (
                     <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                        <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-2">Search Cancelled Folder</label>
                        <div className="flex gap-2">
                           <input 
                              type="text" 
                              placeholder="e.g. 1.c" 
                              className="w-full border border-blue-200 p-2 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-400 outline-none" 
                              value={searchFolder} 
                              onChange={e => setSearchFolder(e.target.value)} 
                           />
                           <button 
                              type="button" 
                              onClick={searchPaxWallet} 
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap shadow-md hover:bg-blue-700 transition-colors"
                           >Search</button>
                        </div>
                        {searchError && <div className="text-[10px] text-rose-500 mt-2 font-bold bg-rose-50 p-1.5 rounded">{searchError}</div>}
                        {foundWallet && (
                           <div className="mt-3 bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center text-xs shadow-sm">
                             <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Available Credit:</span>
                             <span className="font-mono text-emerald-600 font-bold text-base">{formatMoney(foundWallet.remainingAmount)}</span>
                           </div>
                        )}
                     </div>
                  )}

                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Amount (£)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        max={foundWallet ? foundWallet.remainingAmount : undefined}
                        className="w-full border border-slate-200 p-3 rounded-xl font-mono font-bold text-right text-2xl text-blue-700 focus:ring-2 focus:ring-blue-500 outline-none" 
                        placeholder="0.00"
                        onChange={e => setPayData({...payData, amount: e.target.value})} 
                        required 
                      />
                  </div>
                  
                  <div>
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Date Received</label>
                      <input type="date" className="w-full border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" value={payData.date} onChange={e => setPayData({...payData, date: e.target.value})} />
                  </div>
              </div>
              
              <div className="flex gap-3 mt-8">
                 <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                 <button type="submit" className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Confirm Payment</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
}