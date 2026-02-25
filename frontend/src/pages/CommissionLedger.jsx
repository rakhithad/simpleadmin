import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';

// --- UTILS ---
const formatMoney = (amount) => {
  const val = parseFloat(amount || 0);
  // Handle negative cleanly (e.g. -£100.00)
  return val < 0 ? `-£${Math.abs(val).toFixed(2)}` : `£${val.toFixed(2)}`;
};

// --- HELPER: Payment Method Badge ---
const getMethodBadge = (method) => {
  // Normalize string just in case
  const m = (method || 'FULL').toUpperCase();
  
  if (m === 'INTERNAL') {
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200 shadow-sm uppercase">
        Internal
      </span>
    );
  }
  return (
    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 shadow-sm uppercase">
      Full
    </span>
  );
};

// --- SUB-COMPONENT: Table Row ---
const LedgerRow = ({ item, onToggle }) => {
  // Determine text colors based on value
  const profitColor = item.snapshotProfit < 0 ? 'text-red-600' : 'text-slate-700';
  const commColor = item.amount < 0 ? 'text-red-600' : 'text-green-600';

  return (
    <tr className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors group">
      {/* 1. Folder & Context */}
      <td className="px-4 py-3">
        <div className="flex flex-col items-start gap-0.5">
           <span className="font-mono text-xs font-bold text-slate-500 group-hover:text-blue-600 transition-colors">
             {item.folderNo}
           </span>
           {/* We keep Booking Type small here just for context (e.g. knowing it's a Date Change is useful) */}
           <span className="text-[9px] text-slate-400 uppercase tracking-tight">
             {item.bookingType?.replace(/_/g, ' ')}
           </span>
        </div>
      </td>

      {/* 2. Reference & Agent */}
      <td className="px-4 py-3">
        <div className="text-sm font-bold text-slate-700">{item.agentName}</div>
        <div className="text-xs text-slate-400 font-mono">{item.reference || '-'}</div>
      </td>

      {/* 3. NEW COLUMN: Payment Method */}
      <td className="px-4 py-3 text-center">
        {getMethodBadge(item.paymentMethod)}
      </td>

      {/* 4. Revenue */}
      <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">
        {formatMoney(item.revenue)}
      </td>

      {/* 5. Cost */}
      <td className="px-4 py-3 text-right text-xs font-mono text-slate-400">
        {formatMoney(item.prodCost)}
      </td>

      {/* 6. Net Profit */}
      <td className={`px-4 py-3 text-right text-sm font-mono font-bold ${profitColor}`}>
        {formatMoney(item.snapshotProfit)}
      </td>

      {/* 7. COMMISSION (Highlight) */}
      <td className="px-4 py-3 text-right bg-slate-50/50">
        <span className={`text-sm font-mono font-bold block ${commColor}`}>
          {formatMoney(item.amount)}
        </span>
        <span className="text-[10px] text-slate-400 uppercase tracking-tighter">
          {item.type.replace(/_/g, ' ')}
        </span>
      </td>

      {/* 8. Action */}
      <td className="px-4 py-3 text-center">
        <button 
          onClick={() => onToggle(item.id)}
          className={`w-8 h-8 rounded-full border shadow-sm flex items-center justify-center mx-auto transition-all transform active:scale-95 ${
            item.isPaid 
              ? 'bg-green-500 border-green-600 text-white shadow-green-200' 
              : 'bg-white border-slate-200 text-slate-300 hover:border-blue-400 hover:text-blue-400'
          }`}
          title={item.isPaid ? "Mark Unpaid" : "Mark Paid"}
        >
          {item.isPaid ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
          ) : (
            <span className="text-xs font-bold">Pay</span>
          )}
        </button>
      </td>
    </tr>
  );
};

// --- SUB-COMPONENT: Table Section ---
const LedgerSection = ({ title, data, total }) => {
  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
      <div className="bg-slate-50/80 px-6 py-3 border-b border-slate-200 flex justify-between items-center backdrop-blur-sm">
        <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
          {title} 
          <span className="bg-slate-200 text-slate-600 py-0.5 px-2 rounded-full text-[10px] font-bold">{data.length}</span>
        </h3>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 uppercase block font-bold">Section Total</span>
          <span className={`font-mono font-bold text-lg ${total < 0 ? 'text-red-600' : 'text-slate-800'}`}>
            {formatMoney(total)}
          </span>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-100 bg-white">
              <th className="px-4 py-2 font-bold w-24">Folder</th>
              <th className="px-4 py-2 font-bold">Agent / Ref</th>
              {/* NEW HEADER */}
              <th className="px-4 py-2 font-bold text-center">Method</th>
              <th className="px-4 py-2 font-bold text-right">Revenue</th>
              <th className="px-4 py-2 font-bold text-right">Cost</th>
              <th className="px-4 py-2 font-bold text-right">Net Profit</th>
              <th className="px-4 py-2 font-bold text-right bg-slate-50/50">Commission</th>
              <th className="px-4 py-2 font-bold text-center w-16">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <LedgerRow key={item.id} item={item} onToggle={item.onToggle} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function CommissionLedger() {
  const [entries, setEntries] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/bookings/commissions?month=${month}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data.success) setEntries(res.data.data);
      } catch (err) { console.error(err); }
      if (isMounted) setLoading(false);
    };
    fetchData();
    return () => { isMounted = false; };
  }, [month, refreshKey]);

  const handleTogglePaid = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/bookings/commissions/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRefreshKey(old => old + 1);
    } catch (alert) { alert("Failed to toggle status"); }
  };

  // Inject handleToggle into items for cleaner passing
  const dataWithHandlers = entries.map(e => ({ ...e, onToggle: () => handleTogglePaid(e.id) }));

  // --- BUCKETS ---
  const newBusiness = dataWithHandlers.filter(e => ['INITIAL_50', 'FULL_100'].includes(e.type));
  const completions = dataWithHandlers.filter(e => e.type === 'FINAL_BALANCING');
  const cancellations = dataWithHandlers.filter(e => ['CLAWBACK', 'CANCELLATION_ADJUSTMENT'].includes(e.type));

  const totalNew = newBusiness.reduce((s, e) => s + e.amount, 0);
  const totalFinal = completions.reduce((s, e) => s + e.amount, 0);
  const totalCancel = cancellations.reduce((s, e) => s + e.amount, 0);
  const grandTotal = totalNew + totalFinal + totalCancel;

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <Navbar />
      
      {/* STICKY TOP BAR */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="bg-slate-100 p-1 rounded-lg flex items-center border border-slate-200">
               <span className="text-xs font-bold text-slate-500 px-3 uppercase">Ledger Period</span>
               <input 
                 type="month" 
                 className="bg-white border-none rounded text-sm font-bold text-slate-800 focus:ring-0 py-1" 
                 value={month} 
                 onChange={e => setMonth(e.target.value)} 
               />
             </div>
             {loading && <span className="text-xs text-blue-600 animate-pulse font-bold">Syncing...</span>}
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
               <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Payable</span>
               <span className={`text-2xl font-mono font-bold leading-none ${grandTotal < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                 {formatMoney(grandTotal)}
               </span>
            </div>
            <button 
               onClick={() => window.print()} 
               className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Print Report
            </button>
          </div>
        </div>
      </div>

      {/* CONTENT */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-8 animate-fade-in">
        
        {!loading && entries.length === 0 && (
          <div className="text-center py-24 bg-white rounded-xl border border-slate-200 border-dashed">
            <div className="text-slate-300 text-5xl mb-4">📂</div>
            <h3 className="text-slate-500 font-bold">No Records Found</h3>
            <p className="text-slate-400 text-sm">There are no commission entries for {month}</p>
          </div>
        )}

        <LedgerSection title="1. Fresh Bookings" data={newBusiness} total={totalNew} />
        <LedgerSection title="2. Completed & Settled" data={completions} total={totalFinal} />
        <LedgerSection title="3. Cancellations & Adjustments" data={cancellations} total={totalCancel} />
        
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media print {
          button, input { display: none !important; }
          .bg-slate-100 { background: white !important; }
          .shadow-sm, .shadow-lg { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}