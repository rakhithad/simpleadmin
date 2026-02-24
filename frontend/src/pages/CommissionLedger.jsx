import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';

const formatMoney = (amount) => {
  const val = parseFloat(amount || 0);
  return val < 0 ? `-£${Math.abs(val).toFixed(2)}` : `£${val.toFixed(2)}`;
};

// --- TABLE COMPONENT (Defined Outside to prevent Render Errors) ---
const LedgerTable = ({ title, data, colorClass, total, onToggle }) => (
  <div className={`bg-white rounded-lg shadow-sm border ${colorClass} mb-8`}>
    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
      <h3 className="font-bold text-slate-700">{title} <span className="text-xs font-normal text-slate-500">({data.length} records)</span></h3>
      <span className="font-mono font-bold text-lg text-slate-800">{formatMoney(total)}</span>
    </div>
    {data.length === 0 ? (
      <div className="p-8 text-center text-slate-400 italic text-sm">No entries for this month.</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3">Folder</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3 text-right">Booking Profit</th>
              <th className="px-4 py-3 text-right">Commission</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map(item => (
              <tr key={item.id} className="border-b hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-mono text-blue-600 font-bold">
                   {item.folderNo ? item.folderNo.replace(/^FN-0*/, '') : ''}
                </td>
                <td className="px-4 py-3 text-slate-600">{item.reference || '-'}</td>
                <td className="px-4 py-3 font-bold text-slate-700">{item.agentName}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-500">{formatMoney(item.snapshotProfit)}</td>
                <td className={`px-4 py-3 text-right font-mono font-bold ${item.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatMoney(item.amount)}
                </td>
                <td className="px-4 py-3 text-center">
                  <button 
                    onClick={() => onToggle(item.id)}
                    className={`w-6 h-6 rounded border flex items-center justify-center mx-auto transition-all ${
                      item.isPaid ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-slate-300 text-slate-300 hover:border-green-400'
                    }`}
                  >
                    {item.isPaid && "✓"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const CommissionLedger = () => {
  const [entries, setEntries] = useState([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); 
  const [loading, setLoading] = useState(false);
  
  // FIX: Add a refresh trigger to avoid dependency cycles
  const [refreshKey, setRefreshKey] = useState(0);

  // --- EFFECT: DATA FETCHING ---
  useEffect(() => {
    let isMounted = true; // Prevents state updates if component unmounts
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`http://localhost:5000/api/bookings/commissions?month=${month}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (isMounted && res.data.success) {
           setEntries(res.data.data);
        }
      } catch (err) { 
        console.error("Ledger Load Error", err); 
      }
      if (isMounted) setLoading(false);
    };

    fetchData();

    return () => { isMounted = false; };
  }, [month, refreshKey]); // Re-run when month changes OR when we manually refresh

  // --- HANDLER: TOGGLE PAID ---
  const handleTogglePaid = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/bookings/commissions/${id}/toggle`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // FIX: Trigger the useEffect to run again by updating the key
      setRefreshKey(old => old + 1);
    } catch (alert) { alert("Action failed"); }
  };

  // --- BUCKETS ---
  const newBusiness = entries.filter(e => ['INITIAL_50', 'FULL_100'].includes(e.type));
  const completions = entries.filter(e => e.type === 'FINAL_BALANCING');
  const cancellations = entries.filter(e => e.type === 'CLAWBACK');

  // --- TOTALS ---
  const totalNew = newBusiness.reduce((sum, e) => sum + e.amount, 0);
  const totalFinal = completions.reduce((sum, e) => sum + e.amount, 0);
  const totalCancel = cancellations.reduce((sum, e) => sum + e.amount, 0);
  const grandTotal = totalNew + totalFinal + totalCancel;

  return (
    <div className="min-h-screen bg-slate-100 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        
        {/* HEADER & FILTERS */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Commission Ledger</h1>
            <p className="text-slate-500 text-sm mt-1">Monthly performance and payout auditing.</p>
          </div>
          <div className="bg-white p-2 rounded shadow-sm border border-slate-200">
            <label className="text-xs font-bold text-slate-500 uppercase px-2">Select Month</label>
            <input 
              type="month" 
              className="block w-full border-none font-bold text-lg text-slate-700 focus:ring-0 cursor-pointer" 
              value={month} 
              onChange={e => setMonth(e.target.value)} 
            />
          </div>
        </div>

        {/* GRAND TOTAL CARD */}
        <div className="bg-slate-800 text-white p-6 rounded-lg shadow-lg mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold opacity-90">Total Payable Commission</h2>
            <p className="text-xs opacity-60 uppercase tracking-wide">For {month}</p>
          </div>
          <div className={`text-4xl font-mono font-bold ${grandTotal < 0 ? 'text-red-400' : 'text-green-400'}`}>
            {formatMoney(grandTotal)}
          </div>
        </div>

        {loading ? (
           <div className="text-center py-20 text-slate-500">Loading Ledger...</div>
        ) : (
           <>
             {/* TABLE 1: NEW BUSINESS */}
             <LedgerTable 
               title="1. New Business (Vesting)" 
               data={newBusiness} 
               colorClass="border-blue-200"
               total={totalNew} 
               onToggle={handleTogglePaid}
             />

             {/* TABLE 2: COMPLETIONS */}
             <LedgerTable 
               title="2. Completions & Balancing" 
               data={completions} 
               colorClass="border-green-200"
               total={totalFinal} 
               onToggle={handleTogglePaid}
             />

             {/* TABLE 3: CANCELLATIONS */}
             <LedgerTable 
               title="3. Cancellations & Adjustments" 
               data={cancellations} 
               colorClass="border-red-200"
               total={totalCancel} 
               onToggle={handleTogglePaid}
             />
           </>
        )}
      </div>
    </div>
  );
};

export default CommissionLedger;