import React, { useState } from 'react';
import axios from 'axios';
import Button from './Button'; 

const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

export default function PaymentTerminal({ booking, onUpdate }) {
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Removed instalmentId from state
  const [payData, setPayData] = useState({ 
    amount: '', 
    method: 'BANK', 
    date: new Date().toISOString().split('T')[0]
  });

  // --- CALCULATIONS ---
  const depositTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const transactionTotal = booking.transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const totalCollected = depositTotal + transactionTotal;

  const expectedRevenue = booking.revenue || 0;
  const expectedProfit = booking.profit || 0;
  
  const realizedProfit = totalCollected - (booking.prodCost || 0);
  const difference = totalCollected - expectedRevenue;

  // OVERPAYMENT CALCULATION
  const totalInstalmentExpected = booking.instalments?.reduce((sum, i) => sum + i.amount, 0) || 0;
  // If transactions exceed what was asked in instalments, it's an overpayment
  const overpaidAmount = Math.max(0, transactionTotal - totalInstalmentExpected);

  const handleTransactionSubmit = async (e) => {
    e.preventDefault();
    if(!payData.amount) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/bookings/${booking.id}/transaction`, payData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Payment Allocated Successfully!");
      setShowAddModal(false);
      setPayData({ ...payData, amount: '' }); 
      onUpdate(); 
    } catch (err) { alert("Failed to record payment"); }
  };

  const handleSettle = async () => {
    const msg = difference < 0 
      ? `WARNING: Deficit of ${formatMoney(Math.abs(difference))}.\n\nThis will write off the remaining balance. Proceed?`
      : `Surplus of ${formatMoney(difference)}. Mark as Completed?`;
      
    if(!window.confirm(msg)) return;
    
    try {
        const token = localStorage.getItem('token');
        await axios.post(`http://localhost:5000/api/bookings/${booking.id}/settle`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        onUpdate();
    } catch (err) { alert("Failed to settle"); }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg p-4 mt-6 shadow-sm">
      <div className="flex justify-between items-center border-b border-slate-200 pb-3 mb-4">
        <h3 className="font-bold text-slate-700 flex items-center gap-2">
          <span>Payment & Settlement Terminal</span>
          {booking.isSettled && <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded uppercase tracking-wider">Settled & Closed</span>}
        </h3>
        {!booking.isSettled && (
           <button onClick={() => setShowAddModal(true)} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded font-bold hover:bg-blue-700 shadow-sm transition-colors">
             + Record Payment
           </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* LEFT: THE PLAN (Instalments) */}
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
                            <div className={`h-full transition-all duration-500 ${isFullyPaid ? 'bg-green-500' : 'bg-blue-500'}`} 
                                style={{ width: `${percentage}%` }}>
                            </div>
                        </div>
                        {inst.paidAmount > 0 && !isFullyPaid && (
                           <div className="text-[9px] text-blue-600 mt-0.5 font-bold">Paid: {formatMoney(inst.paidAmount)}</div>
                        )}
                      </div>
                    </div>
                  );
                })
             )}
             
             {/* Contract & Overpaid Section */}
             <div className="border-t border-slate-200 pt-2 flex flex-col gap-1">
               <div className="flex justify-between font-bold text-slate-700 text-xs">
                 <span>Contract Revenue</span>
                 <span>{formatMoney(expectedRevenue)}</span>
               </div>
               
               {/* Show Overpaid logic dynamically */}
               {overpaidAmount > 0 && (
                 <div className="flex justify-between font-bold text-xs bg-purple-100 text-purple-800 p-1.5 rounded border border-purple-200 mt-1">
                   <span>Overpaid by Client</span>
                   <span>+{formatMoney(overpaidAmount)}</span>
                 </div>
               )}
             </div>
          </div>
        </div>

        {/* RIGHT: THE REALITY (Transaction Log) */}
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

      {/* BOTTOM: COMPARISON BAR */}
      <div className="mt-6 border-t border-slate-200 pt-4">
        <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-2 opacity-60">
                <div className="text-[10px] uppercase font-bold text-slate-400">Target Profit</div>
                <div className="text-lg font-bold text-slate-700">{formatMoney(expectedProfit)}</div>
            </div>
            <div className={`p-2 rounded border ${realizedProfit < 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                <div className={`text-[10px] uppercase font-bold ${realizedProfit < 0 ? 'text-orange-500' : 'text-green-600'}`}>Realized Profit (Cash)</div>
                <div className={`text-xl font-bold ${realizedProfit < 0 ? 'text-orange-700' : 'text-green-700'}`}>{formatMoney(realizedProfit)}</div>
                <div className="text-[9px] text-slate-400 mt-1">(Collected - £{parseFloat(booking.prodCost || 0).toFixed(0)} Cost)</div>
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

      {/* MODAL: Add Transaction (DROPDOWN REMOVED) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
           <form onSubmit={handleTransactionSubmit} className="bg-white p-6 rounded-xl w-80 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold mb-4 text-slate-800 text-lg">Record Payment</h3>
              
              <div className="space-y-4">
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Amount Received (£)</label>
                      <input type="number" step="0.01" placeholder="0.00" className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-right" 
                         onChange={e => setPayData({...payData, amount: e.target.value})} autoFocus required />
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Method</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm bg-white" onChange={e => setPayData({...payData, method: e.target.value})}>
                         <option value="BANK">Bank Transfer</option><option value="CASH">Cash</option><option value="CARD">Card</option>
                      </select>
                  </div>
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Date Received</label>
                      <input type="date" className="w-full border border-slate-300 p-2 rounded text-sm" value={payData.date} onChange={e => setPayData({...payData, date: e.target.value})} />
                  </div>
              </div>

              {/* Informative helper text for the user */}
              <div className="bg-blue-50 text-blue-700 p-2 rounded text-[10px] mt-4 border border-blue-100 font-medium">
                ℹ️ Money will automatically fill the oldest unpaid instalment first.
              </div>

              <div className="flex gap-2 mt-4">
                 <button type="submit" className="flex-1 bg-slate-800 text-white rounded py-2 text-sm font-bold hover:bg-slate-700 transition-colors">Save</button>
                 <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-200 text-slate-700 rounded py-2 text-sm font-bold hover:bg-slate-300 transition-colors">Cancel</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
}