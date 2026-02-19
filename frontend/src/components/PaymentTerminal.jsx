import React, { useState } from 'react';
import axios from 'axios';
import Button from './Button'; 

const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

export default function PaymentTerminal({ booking, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [payData, setPayData] = useState({ 
    amount: '', 
    method: 'BANK', 
    date: new Date().toISOString().split('T')[0],
    creditNoteId: null // Added to track which wallet we are using
  });

  // --- WALLET SEARCH STATE ---
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

  // --- HANDLERS ---
  const searchPaxWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      // FIXED URL: Added /bookings/ to the path
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
    } catch (setSearchError) { 
      setSearchError("Wallet not found. Try folder number like 1.c"); 
    }
  };

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if(!payData.amount) return;

    // Safety check for Credit Notes
    if(payData.method === 'PAX_CREDIT' && (!foundWallet || parseFloat(payData.amount) > foundWallet.remainingAmount)) {
        return alert("Invalid credit amount or wallet not found.");
    }

    try {
      const token = localStorage.getItem('token');
      const payload = { ...payData, creditNoteId: foundWallet?.id };
      
      await axios.post(`http://localhost:5000/api/bookings/${booking.id}/transaction`, payload, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      
      alert("Payment Allocated Successfully!");
      setShowAddModal(false);
      setPayData({ amount: '', method: 'BANK', date: new Date().toISOString().split('T')[0], creditNoteId: null });
      setFoundWallet(null);
      setSearchFolder('');
      onUpdate(); 
    } catch (alert) { 
      alert("Failed to record payment"); 
    }
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
    <div className="bg-white border border-slate-300 rounded-lg p-4 mt-6 shadow-sm">
      {/* ... (Existing Header and Plan/Reality Grid stays exactly the same) ... */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <span>Payment & Settlement Terminal</span>
          {booking.isSettled && <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Settled & Closed</span>}
        </h3>
        {!booking.isSettled && !booking.isLocked && (
           <button onClick={() => setShowAddModal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 shadow-sm transition-colors">
             + Record Payment
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* LEFT: THE PLAN */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">The Plan (Expectation)</h4>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 space-y-3">
             {booking.instalments?.length === 0 ? (
                <div className="text-xs text-slate-400 italic">No instalments configured.</div>
             ) : (
                booking.instalments?.map(inst => {
                  const percentage = Math.min(((inst.paidAmount || 0) / (inst.amount || 1)) * 100, 100);
                  const isFullyPaid = inst.status === 'PAID' || (inst.paidAmount >= inst.amount - 0.05);

                  return (
                    <div key={inst.id} className="flex justify-between items-center text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-600">Due: {inst.dueDate.split('T')[0]}</span>
                        <span className={`text-[10px] font-bold ${isFullyPaid ? 'text-green-600' : (inst.paidAmount > 0 ? 'text-blue-500' : 'text-slate-400')}`}>
                          {isFullyPaid ? 'PAID' : (inst.paidAmount > 0 ? 'PARTIAL' : 'PENDING')}
                        </span>
                      </div>
                      <div className="text-right w-32">
                        <span className="block font-medium text-slate-700">{formatMoney(inst.amount)}</span>
                        <div className="w-full h-2 bg-slate-200 rounded-full mt-1.5 overflow-hidden border border-slate-300">
                            <div className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${percentage}%` }}></div>
                        </div>
                      </div>
                    </div>
                  );
                })
             )}
             
             <div className="border-t border-slate-200 pt-2 flex flex-col gap-1">
               <div className="flex justify-between font-bold text-slate-700 text-xs">
                 <span>Contract Revenue</span><span>{formatMoney(expectedRevenue)}</span>
               </div>
               {overpaidAmount > 0 && (
                 <div className="flex justify-between font-bold text-xs bg-purple-100 text-purple-800 p-1.5 rounded border border-purple-200 mt-1">
                   <span>Overpaid by Client</span><span>+{formatMoney(overpaidAmount)}</span>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* RIGHT: THE REALITY */}
        <div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wide">The Reality (Cash Flow)</h4>
          <div className="bg-slate-50 p-3 rounded border border-slate-200 h-40 overflow-y-auto space-y-2 custom-scrollbar">
             {booking.initialPayments?.map(p => (
               <div key={`init-${p.id}`} className="flex justify-between text-xs text-slate-600 border-b border-dashed border-slate-200 pb-1">
                 <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>{p.paymentDate.split('T')[0]} <span className="text-[10px] text-slate-400">(Deposit)</span></span>
                 <span className="font-mono font-bold text-slate-700">{formatMoney(p.amount)}</span>
               </div>
             ))}
             {booking.transactions?.map(t => (
               <div key={`trans-${t.id}`} className="flex justify-between text-xs text-slate-600 border-b border-dashed border-slate-200 pb-1">
                 <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>{t.date.split('T')[0]} <span className="text-[10px] text-slate-400">({t.method})</span></span>
                 <span className="font-mono font-bold text-slate-700">{formatMoney(t.amount)}</span>
               </div>
             ))}
             {(!booking.transactions?.length && !booking.initialPayments?.length) && (
                <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">No payments recorded yet</div>
             )}
          </div>
        </div>
      </div>

      {/* --- MILESTONE TRACKER --- */}
      <div className="mt-8 px-4 bg-slate-50 border border-slate-200 rounded-lg pb-8 pt-4 shadow-sm">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-6 tracking-wide flex justify-between">
          <span>Financial Milestone Tracker</span>
          <span className="text-slate-600">Total Cash Collected: <strong className="text-slate-800">{formatMoney(totalCollected)}</strong></span>
        </h4>
        
        <div className="relative w-full">
           {/* Markers logic... */}
           {productCost > 0 && (
             <div className="absolute bottom-full mb-1 w-0 flex flex-col items-center z-10" style={{ left: `${costPercent}%` }}>
                <span className="text-[9px] font-bold text-red-600 bg-white px-1 rounded border border-red-200 whitespace-nowrap shadow-sm">COST {formatMoney(productCost)}</span>
                <div className="h-2 w-[1px] bg-red-400 mt-0.5"></div>
             </div>
           )}
           {expectedRevenue > 0 && (
             <div className="absolute bottom-full mb-1 w-0 flex flex-col items-center z-10" style={{ left: `${revPercent}%` }}>
                <span className="text-[9px] font-bold text-blue-600 bg-white px-1 rounded border border-blue-200 whitespace-nowrap shadow-sm">REV {formatMoney(expectedRevenue)}</span>
                <div className="h-2 w-[1px] bg-blue-400 mt-0.5"></div>
             </div>
           )}
           
           <div className="relative w-full h-4 bg-slate-200 rounded-full overflow-hidden shadow-inner border border-slate-300">
              <div className={`absolute top-0 left-0 h-full transition-all duration-700 ${isOverpaid ? 'bg-gradient-to-r from-yellow-400 to-amber-500' : 'bg-green-500'}`} style={{ width: `${collectedPercent}%` }}></div>
              <div className="absolute top-0 bottom-0 border-l border-red-600/50" style={{ left: `${costPercent}%` }}></div>
              <div className="absolute top-0 bottom-0 border-l border-blue-600/50" style={{ left: `${revPercent}%` }}></div>
              {depositTotal > 0 && <div className="absolute top-0 bottom-0 border-l border-slate-700/30" style={{ left: `${depositPercent}%` }}></div>}
              {instMilestones.map((m, i) => (
                  <div key={`line-${i}`} className="absolute top-0 bottom-0 border-l border-slate-700/30" style={{ left: `${m.percent}%` }}></div>
              ))}
           </div>

           {depositTotal > 0 && (
             <div className="absolute top-full mt-1 w-0 flex flex-col items-center z-10" style={{ left: `${depositPercent}%` }}>
                <div className="h-2 w-[1px] bg-slate-400 mb-0.5"></div>
                <span className="text-[8px] font-bold text-slate-600 whitespace-nowrap">DEP {formatMoney(depositTotal)}</span>
             </div>
           )}
           {instMilestones.map((m, i) => (
             <div key={`marker-${i}`} className="absolute top-full mt-1 w-0 flex flex-col items-center z-10" style={{ left: `${m.percent}%` }}>
                <div className="h-2 w-[1px] bg-slate-400 mb-0.5"></div>
                <span className="text-[8px] font-bold text-slate-600 whitespace-nowrap">{m.label} {formatMoney(m.amount)}</span>
             </div>
           ))}
        </div>
      </div>

      {/* --- COMPARISON BAR --- */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2 opacity-60">
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Profit</div>
                <div className="text-lg font-bold text-slate-700">{formatMoney(expectedProfit)}</div>
            </div>
            <div className={`p-2 rounded border ${realizedProfit < 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-[10px] uppercase font-bold ${realizedProfit < 0 ? 'text-orange-500' : 'text-green-600'}`}>Realized Profit (Cash)</div>
                <div className={`text-xl font-bold ${realizedProfit < 0 ? 'text-orange-700' : 'text-green-700'}`}>{formatMoney(realizedProfit)}</div>
                <div className="text-[9px] text-slate-400 mt-1">(Collected - £{parseFloat(productCost).toFixed(0)} Cost)</div>
            </div>
            <div className="flex flex-col justify-center">
                {!booking.isSettled ? (
                   <button onClick={handleSettle} className={`w-full py-2 rounded text-xs font-bold text-white shadow-md transition-all hover:shadow-lg ${difference < -1 ? 'bg-orange-500 hover:bg-orange-600' : 'bg-green-600 hover:bg-green-700'}`}>
                     {difference < -1 ? `Write Off & Close` : 'Settle & Close'}
                   </button>
                ) : (
                    <div className="text-xs font-bold text-slate-400 bg-slate-100 py-2 rounded border border-slate-200">Booking Closed</div>
                )}
            </div>
        </div>
      </div>

      {/* --- ADD TRANSACTION MODAL (WITH WALLET SEARCH) --- */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
           <form onSubmit={handleTransactionSubmit} className="bg-white p-6 rounded-xl w-96 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold mb-4 text-slate-800 text-lg">Record Payment</h3>
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Method</label>
                      <select 
                        className="w-full border border-slate-300 p-2 rounded text-sm bg-white font-bold" 
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

                  {/* WALLET SEARCH BOX */}
                  {payData.method === 'PAX_CREDIT' && (
                     <div className="bg-blue-50 p-3 rounded border border-blue-200 animate-fade-in">
                        <label className="text-[10px] font-bold text-blue-800 uppercase">Search Cancelled Folder No.</label>
                        <div className="flex gap-2 mt-1">
                           <input 
                              type="text" 
                              placeholder="e.g. 1.c" 
                              className="w-full border p-1.5 rounded text-sm font-mono uppercase" 
                              value={searchFolder} 
                              onChange={e => setSearchFolder(e.target.value)} 
                           />
                           <button 
                              type="button" 
                              onClick={searchPaxWallet} 
                              className="bg-blue-600 text-white px-3 py-1.5 rounded text-xs font-bold whitespace-nowrap"
                           >Search</button>
                        </div>
                        {searchError && <div className="text-[10px] text-red-500 mt-1 font-bold">{searchError}</div>}
                        {foundWallet && (
                           <div className="mt-2 bg-white p-2 rounded border border-blue-100 flex justify-between items-center text-xs">
                             <span className="font-bold text-slate-600">Available Wallet:</span>
                             <span className="font-mono text-green-600 font-bold text-sm">{formatMoney(foundWallet.remainingAmount)}</span>
                           </div>
                        )}
                     </div>
                  )}

                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Amount to Apply (£)</label>
                      <input 
                        type="number" 
                        step="0.01" 
                        max={foundWallet ? foundWallet.remainingAmount : undefined}
                        className="w-full border border-slate-300 p-2 rounded font-mono font-bold text-right text-lg text-blue-700" 
                        placeholder="0.00"
                        onChange={e => setPayData({...payData, amount: e.target.value})} 
                        required 
                      />
                  </div>
                  
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Date Received</label>
                      <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm" value={payData.date} onChange={e => setPayData({...payData, date: e.target.value})} />
                  </div>
              </div>
              
              <div className="flex gap-2 mt-6">
                 <button type="submit" className="flex-1 bg-slate-800 text-white rounded py-2 text-sm font-bold hover:bg-slate-700 transition-colors">Confirm Payment</button>
                 <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-200 text-slate-700 rounded py-2 text-sm font-bold hover:bg-slate-300 transition-colors">Cancel</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
}