import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import PaymentTerminal from '../components/PaymentTerminal';

const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '-';
const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

const getPaymentStatus = (booking) => {
  const revenue = booking.revenue || 0;
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  if (totalPaid >= revenue - 0.05) return { label: 'PAID FULL', color: 'bg-green-100 text-green-800 border-green-200' };
  if (totalPaid > 0) return { label: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { label: 'UNPAID', color: 'bg-red-100 text-red-800 border-red-200' };
};

// --- SUB-COMPONENT: The Edit Live Ledger Modal ---
const EditLedgerModal = ({ booking, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    revenue: booking.revenue || 0,
    transFee: booking.transFee || 0,
    surcharge: booking.surcharge || 0,
    supplierCosts: [...(booking.supplierCosts || [])]
  });
  const [loading, setLoading] = useState(false);

  // Auto-calculate live changes
  const currentProdCost = formData.supplierCosts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  const currentProfit = parseFloat(formData.revenue || 0) - (currentProdCost + parseFloat(formData.transFee || 0) + parseFloat(formData.surcharge || 0));

  const addSupplierRow = () => {
    setFormData({
      ...formData,
      supplierCosts: [...formData.supplierCosts, { supplier: 'BTRES', category: 'FLIGHT', amount: 0 }]
    });
  };

  const updateSupplierRow = (index, field, value) => {
    const newCosts = [...formData.supplierCosts];
    newCosts[index][field] = value;
    setFormData({ ...formData, supplierCosts: newCosts });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:5000/api/bookings/approved/${booking.id}`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Ledger Updated Successfully!');
      onUpdate();
      onClose();
    } catch (err) {
      alert('Failed to update ledger');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
      <form onSubmit={submitEdit} className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Edit Financial Ledger</h2>
            <p className="text-xs text-slate-300">Folder #{booking.folderNo} • {booking.paxName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white font-bold text-xl">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          
          {/* Top Level Financials */}
          <div className="grid grid-cols-3 gap-4">
            <div><label className="text-xs font-bold text-slate-500 uppercase">Revenue (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.revenue} onChange={e => setFormData({...formData, revenue: e.target.value})} required/></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Trans Fee (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.transFee} onChange={e => setFormData({...formData, transFee: e.target.value})} required/></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Surcharge (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.surcharge} onChange={e => setFormData({...formData, surcharge: e.target.value})} required/></div>
          </div>

          {/* Supplier Editable List */}
          <div className="bg-white border rounded-lg p-4">
            <div className="flex justify-between items-center border-b pb-2 mb-3">
              <h4 className="font-bold text-slate-700 text-sm">Supplier Costs</h4>
              <button type="button" onClick={addSupplierRow} className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-3 py-1 rounded font-bold">+ Add Supplier</button>
            </div>
            
            <div className="space-y-2">
              {formData.supplierCosts.map((c, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select className="border p-2 rounded text-sm w-1/3" value={c.supplier} onChange={e => updateSupplierRow(idx, 'supplier', e.target.value)}>
                    <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="TRIVAGO">TRIVAGO</option><option value="OTHER">OTHER</option>
                  </select>
                  <select className="border p-2 rounded text-sm w-1/3" value={c.category} onChange={e => updateSupplierRow(idx, 'category', e.target.value)}>
                    <option value="FLIGHT">FLIGHT</option><option value="HOTEL">HOTEL</option><option value="CRUISE">CRUISE</option><option value="OTHER">OTHER</option>
                  </select>
                  <input type="number" step="0.01" className="border p-2 rounded text-sm w-1/3 text-right font-mono" value={c.amount} onChange={e => updateSupplierRow(idx, 'amount', e.target.value)} required />
                </div>
              ))}
              <p className="text-[10px] text-slate-400 italic mt-2">Note: To "remove" an existing supplier, change their amount to 0. This preserves payment history.</p>
            </div>
          </div>

          {/* Live Preview Bar */}
          <div className="bg-slate-800 text-white p-4 rounded-lg flex justify-between items-center">
            <div><span className="text-[10px] uppercase text-slate-400 block">Calculated Product Cost</span><span className="font-mono text-lg">{formatMoney(currentProdCost)}</span></div>
            <div className="text-right"><span className="text-[10px] uppercase text-slate-400 block">New Estimated Profit</span><span className="font-mono text-xl font-bold text-green-400">{formatMoney(currentProfit)}</span></div>
          </div>

        </div>

        <div className="border-t p-4 flex gap-3 bg-white justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2 rounded font-bold bg-slate-100 hover:bg-slate-200 text-slate-700">Cancel</button>
          <button type="submit" disabled={loading} className="px-6 py-2 rounded font-bold bg-blue-600 hover:bg-blue-700 text-white">{loading ? 'Saving...' : 'Save Live Ledger'}</button>
        </div>
      </form>
    </div>
  );
};

// --- SUB-COMPONENT: The "Drawer" that opens up ---
const ExpandedDetails = ({ booking, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false); // Edit Modal State
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppPayData, setSuppPayData] = useState({ amount: '', method: 'BANK', date: new Date().toISOString().split('T')[0], supplierCostId: '', supplierName: '' });

  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  const breakdownTotalCost = booking.supplierCosts?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const breakdownTotalPaid = booking.supplierCosts?.reduce((sum, c) => sum + (c.paidAmount || 0), 0) || 0;
  const totalSupplierOwed = breakdownTotalCost - breakdownTotalPaid;

  const handleSupplierPaySubmit = async (e) => {
    e.preventDefault();
    if(!suppPayData.amount) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/bookings/${booking.id}/supplier-payment`, suppPayData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Supplier Payment Recorded!");
      setShowSuppModal(false);
      onUpdate(); 
    } catch (alert) { alert("Failed to record payment"); }
  };

  return (
    <div className="bg-slate-50 border-t border-b border-slate-200 p-6 shadow-inner animate-fade-in text-sm relative">
      
      {/* EDIT BUTTON (Only if not settled) */}
      {!booking.isSettled && (
        <button onClick={() => setIsEditing(true)} className="absolute top-4 right-6 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition shadow-sm">
          ✏️ Edit Financials & Suppliers
        </button>
      )}

      {/* EDIT MODAL */}
      {isEditing && <EditLedgerModal booking={booking} onClose={() => setIsEditing(false)} onUpdate={onUpdate} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-6">
        {/* COLUMN 1: TRIP & PAX */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1">Trip Details</h4>
          <div className="grid grid-cols-2 gap-y-2 text-slate-600">
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Agent</span>{booking.agentName} ({booking.teamName})</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Type</span>{booking.bookingType}</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Travel Date</span>{formatDate(booking.travelDate)}</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">PC Date</span>{formatDate(booking.pcDate)}</div>
          </div>
          
          <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1 mt-2">Passengers ({booking.numPax})</h4>
          <div className="space-y-1">
            {booking.passengers.map((p, i) => (
              <div key={i} className="flex justify-between items-center text-slate-600 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">
                <span className="font-medium">{p.title} {p.firstName} {p.lastName}</span>
                <span className="text-[10px] text-slate-500 bg-slate-100 px-1 rounded">{p.category}</span>
              </div>
            ))}
          </div>
        </div>

        {/* COLUMN 2: ACCOUNTS PAYABLE */}
        <div className="col-span-1 lg:col-span-1">
          <div className="flex justify-between items-end border-b border-slate-300 pb-1">
            <h4 className="font-bold text-slate-700 uppercase text-xs">Accounts Payable</h4>
            <span className={`text-[10px] font-bold ${totalSupplierOwed > 0 ? 'text-red-500' : 'text-green-600'}`}>Total Owed: {formatMoney(totalSupplierOwed)}</span>
          </div>
          
          {(!booking.supplierCosts || booking.supplierCosts.length === 0) ? (
            <div className="bg-yellow-50 rounded border border-yellow-200 p-4 text-center mt-2">
              <p className="text-xs text-yellow-700 italic">No breakdown items found.</p>
            </div>
          ) : (
            <div className="bg-white rounded border border-slate-200 overflow-hidden mt-2 shadow-sm">
              <div className="grid grid-cols-12 gap-2 bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase text-right">
                <span className="col-span-3 text-left">Supplier</span><span className="col-span-3">Cost</span><span className="col-span-3 text-blue-600">Paid</span><span className="col-span-3 text-red-500">Owed</span>
              </div>
              {booking.supplierCosts.map((c, i) => {
                 const owed = c.amount - (c.paidAmount || 0);
                 return (
                  <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 border-b border-slate-100 last:border-0 text-slate-600 items-center text-right text-xs font-mono">
                    <div className="col-span-3 text-left">
                      <div className="font-bold text-[10px] text-blue-700 bg-blue-50 inline-block px-1 rounded truncate max-w-full">{c.supplier}</div>
                      <div className="text-[9px] text-slate-400 leading-tight">{c.category}</div>
                    </div>
                    <div className="col-span-3">{formatMoney(c.amount)}</div>
                    <div className="col-span-3 text-blue-600 font-bold">{formatMoney(c.paidAmount)}</div>
                    <div className="col-span-3 flex flex-col items-end justify-center">
                       <span className={owed > 0 ? 'text-red-500 font-bold' : 'text-green-500'}>{formatMoney(owed)}</span>
                       {owed > 0 && !booking.isSettled && (
                          <button onClick={() => { setSuppPayData({...suppPayData, supplierCostId: c.id, supplierName: c.supplier, amount: owed}); setShowSuppModal(true); }} className="text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded mt-1 hover:bg-slate-700 transition-colors">PAY</button>
                       )}
                    </div>
                  </div>
                 );
              })}
            </div>
          )}
        </div>

        {/* COLUMN 3: PROFIT & LOSS */}
        <div>
          <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1">Profit & Loss</h4>
          <div className="space-y-2 mt-2 bg-white p-3 rounded border border-slate-200 shadow-sm">
            <div className="flex justify-between text-slate-500"><span>Client Revenue:</span> <span className="text-slate-800 font-bold">{formatMoney(booking.revenue)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Client Paid:</span> <span className="text-blue-600 font-bold">{formatMoney(totalPaid)}</span></div>
            <div className="border-t border-slate-100 my-1"></div>
            <div className="flex justify-between text-slate-500"><span>Supplier Costs:</span> <span className="text-red-400 font-medium">-{formatMoney(breakdownTotalCost)}</span></div>
            <div className="flex justify-between text-slate-500 text-[10px] pl-2"><span>Actually Paid Out:</span> <span className="text-slate-400">-{formatMoney(breakdownTotalPaid)}</span></div>
            <div className="border-t border-dashed my-2"></div>
            <div className="bg-slate-50 p-2 rounded border border-slate-200">
               <div className="flex justify-between text-xs font-bold text-slate-600">
                  <span>Current Cash Position:</span><span className={totalPaid - breakdownTotalPaid >= 0 ? 'text-green-600' : 'text-orange-600'}>{formatMoney(totalPaid - breakdownTotalPaid)}</span>
               </div>
               <div className="text-[9px] text-slate-400 mt-0.5">(Cash In - Cash Out)</div>
            </div>
          </div>
        </div>
        
        {/* PAYMENT TERMINAL */}
        <div className="col-span-1 lg:col-span-3 mt-4">
            <PaymentTerminal booking={booking} onUpdate={onUpdate} />
        </div>
      </div>

      {/* SUPPLIER PAY MODAL */}
      {showSuppModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
           <form onSubmit={handleSupplierPaySubmit} className="bg-white p-6 rounded-xl w-80 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg mb-1">Pay Supplier</h3>
              <p className="text-xs text-slate-500 mb-4">Recording payment to <span className="font-bold text-blue-600">{suppPayData.supplierName}</span></p>
              <div className="space-y-3">
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Amount Sent (£)</label><input type="number" step="0.01" className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-right" value={suppPayData.amount} onChange={e => setSuppPayData({...suppPayData, amount: e.target.value})} autoFocus required /></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Payment Method</label><select className="w-full border border-slate-300 p-2 rounded text-sm bg-white" value={suppPayData.method} onChange={e => setSuppPayData({...suppPayData, method: e.target.value})}><option value="BANK">Bank Transfer</option><option value="CARD">Corporate Card</option><option value="CASH">Cash</option></select></div>
                  <div><label className="text-xs font-bold text-slate-500 block mb-1">Date Sent</label><input type="date" className="w-full border border-slate-300 p-2 rounded text-sm" value={suppPayData.date} onChange={e => setSuppPayData({...suppPayData, date: e.target.value})} /></div>
              </div>
              <div className="flex gap-2 mt-6">
                 <button className="flex-1 bg-slate-800 text-white rounded py-2 text-sm font-bold hover:bg-slate-700" type="submit">Record Outgoing</button>
                 <button className="flex-1 bg-slate-200 text-slate-700 rounded py-2 text-sm font-bold hover:bg-slate-300" type="button" onClick={() => setShowSuppModal(false)}>Cancel</button>
              </div>
           </form>
        </div>
      )}
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function ApprovedBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  useEffect(() => { fetchApprovedBookings(); }, []);

  const fetchApprovedBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/bookings/approved', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setBookings(res.data.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const filteredBookings = bookings.filter(b => 
    b.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.folderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.paxName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div><h1 className="text-2xl font-bold text-slate-800">Master Booking Records</h1><p className="text-sm text-slate-500">Click any row to expand details.</p></div>
          <input type="text" placeholder="Search Folder, Ref, or Pax..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700">
              <tr>
                <th className="px-4 py-4 w-8"></th>
                <th className="px-6 py-4">Folder No</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Ref / PNR</th>
                <th className="px-6 py-4">Lead Passenger</th>
                <th className="px-6 py-4">Route</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (<tr><td colSpan="8" className="p-8 text-center text-slate-400">Loading records...</td></tr>) : filteredBookings.length === 0 ? (<tr><td colSpan="8" className="p-8 text-center text-slate-400">No records found.</td></tr>) : (
                filteredBookings.map((b) => {
                  const status = getPaymentStatus(b);
                  const isExpanded = expandedRows[b.id];

                  return (
                    <React.Fragment key={b.id}>
                      <tr onClick={() => toggleRow(b.id)} className={`cursor-pointer transition-all border-l-4 ${isExpanded ? 'bg-blue-50 border-l-blue-500' : 'hover:bg-slate-50 border-l-transparent'}`}>
                        <td className="px-4 py-4 text-center text-slate-400 text-xs">{isExpanded ? '▼' : '▶'}</td>
                        <td className="px-6 py-4 font-bold text-blue-700">{b.folderNo}</td>
                        <td className="px-6 py-4 text-slate-500">{formatDate(b.createdAt)}</td>
                        <td className="px-6 py-4 font-mono text-xs"><div className="font-bold text-slate-800">{b.refNo}</div><div className="text-slate-500">{b.pnr}</div></td>
                        <td className="px-6 py-4"><div className="font-medium text-slate-900">{b.paxName}</div><div className="text-xs text-slate-500">{b.numPax} Pax</div></td>
                        <td className="px-6 py-4"><div>{b.fromTo}</div><div className="text-xs text-slate-400">{b.airline}</div></td>
                        <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>{status.label}</span></td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-green-600">{formatMoney(b.profit)}</td>
                      </tr>
                      {isExpanded && (<tr><td colSpan="8" className="p-0"><ExpandedDetails booking={b} onUpdate={fetchApprovedBookings} /></td></tr>)}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`.animate-fade-in { animation: fadeIn 0.2s ease-out; } @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}