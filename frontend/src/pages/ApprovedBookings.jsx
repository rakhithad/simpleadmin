import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import PaymentTerminal from '../components/PaymentTerminal';

const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '-';
const formatMoney = (m) => {
  const val = parseFloat(m || 0);
  return val < 0 ? `-£${Math.abs(val).toFixed(2)}` : `£${val.toFixed(2)}`;
};

const displayFolderNo = (fn) => {
  if (!fn) return '';
  return fn.replace(/^FN-0*/, ''); 
};

const getPaymentStatus = (booking) => {
  const revenue = booking.revenue || 0;
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  if (totalPaid >= revenue - 0.05) return { label: 'PAID FULL', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  if (totalPaid > 0) return { label: 'PARTIAL', color: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'UNPAID', color: 'bg-rose-100 text-rose-700 border-rose-200' };
};

// --- SUB-COMPONENT: The Cancellation Dashboard (1.c) ---
const CancellationDashboard = ({ booking, onUpdate }) => {
  const [formData, setFormData] = useState({
    supplierRefund: 0, consultantFee: 0, supplierName: 'BTRES', supplierReference: ''
  });
  const [walletRef, setWalletRef] = useState(null);
  const [showBankRefund, setShowBankRefund] = useState(false);
  const [bankRefundAmount, setBankRefundAmount] = useState('');

  // Fetch the wallet to see if there is money remaining when locked
  useEffect(() => {
    if (booking.isLocked) {
       const token = localStorage.getItem('token');
       axios.get(`http://localhost:5000/api/bookings/credits/pax/search?folder=${booking.folderNo}`, { headers: { Authorization: `Bearer ${token}` } })
            .then(res => { if (res.data.success) setWalletRef(res.data.data); });
    }
  }, [booking.isLocked, booking.folderNo]);

  const finalPaxWallet = Math.max(0, formData.supplierRefund - formData.consultantFee);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(!window.confirm(`Finalize Cancellation?\n\nSupplier Refund: ${formatMoney(formData.supplierRefund)}\nPax Wallet: ${formatMoney(finalPaxWallet)}\nProfit: ${formatMoney(formData.consultantFee)}`)) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/bookings/approved/${booking.id}/process-cancellation`, formData, { headers: { Authorization: `Bearer ${token}` } });
      alert("Cancellation Finalized and Wallets Created!");
      onUpdate();
    } catch (alert) { alert("Failed to process cancellation"); }
  };

  const handleBankRefund = async (e) => {
    e.preventDefault();
    if(!window.confirm(`Send ${formatMoney(bankRefundAmount)} to Passenger's Bank?`)) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:5000/api/bookings/credits/pax/${walletRef.id}/refund`, 
        { amount: bankRefundAmount }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert("Cash Refund Processed!");
      setShowBankRefund(false);
      setBankRefundAmount(''); // Clear the input

      // --- CRITICAL FIX: RE-FETCH WALLET BALANCE ---
      const res = await axios.get(`http://localhost:5000/api/bookings/credits/pax/search?folder=${booking.folderNo}`, { 
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.data.success) setWalletRef(res.data.data); 

      onUpdate(); // Refreshes the parent page financials
    } catch (alert) { alert("Failed to refund."); }
  };

  if (booking.isLocked) {
    return (
      <div className="bg-white/80 p-6 rounded-xl border border-rose-200 mt-4 shadow-sm backdrop-blur-sm">
        <h3 className="text-rose-700 font-bold text-lg mb-4 border-b border-rose-100 pb-2 flex justify-between items-center">
           <span>🔒 Final Cancellation Record</span>
           <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Folder: {booking.folderNo}</span>
        </h3>
        <div className="grid grid-cols-3 gap-6 text-sm">
           <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
             <span className="block text-slate-500 uppercase text-[10px] font-bold tracking-wider">Supplier Credit Note</span>
             <span className="text-xl font-mono text-slate-800 font-bold">{formatMoney(booking.supplierRefund)}</span>
           </div>
           <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-100">
             <span className="block text-emerald-700 uppercase text-[10px] font-bold tracking-wider">Agency Profit (Fee)</span>
             <span className="text-xl font-mono font-bold text-emerald-700">{formatMoney(booking.consultantFee)}</span>
           </div>
           
           {/* LIVE PAX WALLET STATUS */}
           <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 relative group">
             <span className="block text-blue-800 uppercase text-[10px] font-bold tracking-wider">Pax Wallet Balance</span>
             {walletRef ? (
                <>
                  <span className="text-xl font-mono font-bold text-blue-700">{formatMoney(walletRef.remainingAmount)}</span>
                  <button onClick={() => setShowBankRefund(true)} className="absolute bottom-4 right-4 text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
                    💸 Refund to Bank
                  </button>
                </>
              ) : (
                <span className="text-sm font-bold text-slate-400 mt-1 block italic">Wallet Empty / Closed</span>
              )}
           </div>
        </div>

        {/* BANK REFUND MODAL */}
        {showBankRefund && walletRef && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
             <form onSubmit={handleBankRefund} className="bg-white p-8 rounded-2xl w-96 shadow-2xl animate-fade-in border border-slate-100">
                <h3 className="font-bold mb-2 text-slate-800 text-xl">Cash Out Wallet</h3>
                <p className="text-xs text-slate-500 mb-6">Send funds from digital wallet back to the passenger's actual bank account.</p>
                <div>
                   <label className="text-xs font-bold text-slate-500 block mb-2 uppercase">Amount to Send (£)</label>
                   <input type="number" step="0.01" max={walletRef.remainingAmount} className="w-full border border-slate-200 bg-slate-50 p-3 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-right text-2xl text-blue-700" value={bankRefundAmount} onChange={e => setBankRefundAmount(e.target.value)} required placeholder="0.00"/>
                </div>
                <div className="flex gap-3 mt-8">
                   <button type="button" onClick={() => setShowBankRefund(false)} className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold hover:bg-slate-200 transition-colors">Cancel</button>
                   <button type="submit" className="flex-1 bg-blue-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200">Process Refund</button>
                </div>
             </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-rose-50/80 p-6 rounded-xl border border-rose-200 mt-4 animate-fade-in shadow-sm">
      <h3 className="text-rose-800 font-bold text-lg mb-1">Process Cancellation & Wallets</h3>
      <p className="text-xs text-rose-600/70 mb-6 font-medium">Careful: Saving this will permanently lock the cancellation math.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* SUPPLIER SIDE */}
           <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between">
             <div>
               <h4 className="font-bold text-slate-700 mb-4 border-b pb-2 text-sm uppercase tracking-wide">1. Supplier Recovery</h4>
               <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Refund Amount (£)</label>
               <input type="number" step="0.01" className="w-full border border-slate-200 p-2 rounded-lg mb-4 font-mono text-right font-bold text-lg text-slate-700 bg-slate-50" value={formData.supplierRefund} onChange={e => setFormData({...formData, supplierRefund: parseFloat(e.target.value) || 0})} required/>
               
               <div className="grid grid-cols-2 gap-3 mb-2">
                 <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Supplier</label>
                   <select className="w-full border border-slate-200 p-2 rounded-lg text-sm bg-white" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})}>
                      <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="OTHER">OTHER</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Ref / PNR</label>
                   <input type="text" placeholder="e.g. REF-123" className="w-full border border-slate-200 p-2 rounded-lg text-sm" value={formData.supplierReference} onChange={e => setFormData({...formData, supplierReference: e.target.value})} />
                 </div>
               </div>
             </div>
           </div>

           {/* PAX SIDE */}
           <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
             <h4 className="font-bold text-slate-700 mb-4 border-b pb-2 text-sm uppercase tracking-wide">2. Pax Entitlement</h4>
             <label className="block text-[10px] font-bold text-emerald-600 uppercase mb-1">Consultant Fee (Profit)</label>
             <input type="number" step="0.01" className="w-full border border-emerald-100 bg-emerald-50/50 p-2 rounded-lg mb-6 font-mono text-right text-emerald-700 font-bold text-lg" value={formData.consultantFee} onChange={e => setFormData({...formData, consultantFee: parseFloat(e.target.value) || 0})} required/>
             
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2 text-sm text-slate-600">
                <div className="flex justify-between font-medium"><span>Supplier Refund:</span> <span className="font-mono">{formatMoney(formData.supplierRefund)}</span></div>
                <div className="flex justify-between text-rose-500 border-b border-dashed border-slate-300 pb-2"><span>Less Fee:</span> <span className="font-mono">-{formatMoney(formData.consultantFee)}</span></div>
                <div className="pt-1 flex justify-between font-bold text-blue-700 items-center">
                   <span className="text-xs uppercase">Wallet Credit</span> <span className="font-mono bg-blue-100 px-2 py-0.5 rounded text-sm">{formatMoney(finalPaxWallet)}</span>
                </div>
             </div>
           </div>
        </div>
        
        <button type="submit" className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-rose-200 transition-colors text-sm uppercase tracking-widest">
          Lock Cancellation & Generate Credits
        </button>
      </form>
    </div>
  );
};

// --- SUB-COMPONENT: The Edit Live Ledger Modal ---
const EditLedgerModal = ({ booking, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    revenue: booking.revenue || 0,
    transFee: booking.transFee || 0,
    surcharge: booking.surcharge || 0,
    travelDate: booking.travelDate ? booking.travelDate.split('T')[0] : '', 
    supplierCosts: [...(booking.supplierCosts || [])],
    instalments: booking.instalments ? booking.instalments.map(i => ({ ...i, dueDate: i.dueDate.split('T')[0] })) : [],
    initialPayments: booking.initialPayments ? booking.initialPayments.map(ip => ({ ...ip, paymentDate: ip.paymentDate.split('T')[0] })) : []
  });
  const [loading, setLoading] = useState(false);

  const currentProdCost = formData.supplierCosts.reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);
  const currentProfit = parseFloat(formData.revenue || 0) - (currentProdCost + parseFloat(formData.transFee || 0) + parseFloat(formData.surcharge || 0));

  const addSupplierRow = () => setFormData({ ...formData, supplierCosts: [...formData.supplierCosts, { supplier: 'BTRES', category: 'FLIGHT', amount: 0 }] });
  const updateSupplierRow = (index, field, value) => {
    const newCosts = [...formData.supplierCosts];
    newCosts[index][field] = value;
    setFormData({ ...formData, supplierCosts: newCosts });
  };

  const addInstalmentRow = () => setFormData({ ...formData, instalments: [...formData.instalments, { dueDate: new Date().toISOString().split('T')[0], amount: 0 }] });
  const updateInstalmentRow = (index, field, value) => {
    const newInsts = [...formData.instalments];
    newInsts[index][field] = value;
    setFormData({ ...formData, instalments: newInsts });
  };

  const addInitialPaymentRow = () => setFormData({ ...formData, initialPayments: [...formData.initialPayments, { paymentDate: new Date().toISOString().split('T')[0], transactionMethod: 'BANK', amount: 0 }] });
  const updateInitialPaymentRow = (index, field, value) => {
    const newIPs = [...formData.initialPayments];
    newIPs[index][field] = value;
    setFormData({ ...formData, initialPayments: newIPs });
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
      <form onSubmit={submitEdit} className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        
        <div className="bg-slate-900 text-white px-8 py-5 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Edit Ledger</h2>
            <p className="text-xs text-slate-400 font-mono mt-1">Folder #{booking.folderNo} • {booking.paxName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white font-bold text-2xl transition-colors">&times;</button>
        </div>

        <div className="p-8 overflow-y-auto flex-1 bg-slate-50 space-y-8 custom-scrollbar">
          <div className="grid grid-cols-4 gap-6">
            <div><label className="label">Travel Date</label><input type="date" className="input-field" value={formData.travelDate} onChange={e => setFormData({...formData, travelDate: e.target.value})} required/></div>
            <div><label className="label">Revenue (£)</label><input type="number" step="0.01" className="input-field text-right font-mono font-bold" value={formData.revenue} onChange={e => setFormData({...formData, revenue: e.target.value})} required/></div>
            <div><label className="label">Trans Fee (£)</label><input type="number" step="0.01" className="input-field text-right font-mono" value={formData.transFee} onChange={e => setFormData({...formData, transFee: e.target.value})} required/></div>
            <div><label className="label">Surcharge (£)</label><input type="number" step="0.01" className="input-field text-right font-mono" value={formData.surcharge} onChange={e => setFormData({...formData, surcharge: e.target.value})} required/></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                {/* DEPOSITS */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-bold text-slate-700 text-sm uppercase">Initial Deposits</h4>
                    <button type="button" onClick={addInitialPaymentRow} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg font-bold transition-colors">+ Add Row</button>
                  </div>
                  <div className="space-y-3">
                    {formData.initialPayments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">No deposits recorded yet.</p>}
                    {formData.initialPayments.map((ip, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="date" className="input-field text-xs py-1.5" value={ip.paymentDate} onChange={e => updateInitialPaymentRow(idx, 'paymentDate', e.target.value)} required />
                        <select className="input-field text-xs py-1.5" value={ip.transactionMethod} onChange={e => updateInitialPaymentRow(idx, 'transactionMethod', e.target.value)}>
                          <option value="BANK">BANK</option><option value="CASH">CASH</option><option value="CARD">CARD</option>
                        </select>
                        <input type="number" step="0.01" placeholder="Amount" className="input-field text-xs py-1.5 text-right font-mono" value={ip.amount} onChange={e => updateInitialPaymentRow(idx, 'amount', e.target.value)} required />
                      </div>
                    ))}
                  </div>
                </div>

                {/* INSTALMENTS */}
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                    <h4 className="font-bold text-slate-700 text-sm uppercase">Payment Plan</h4>
                    <button type="button" onClick={addInstalmentRow} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg font-bold transition-colors">+ Add Row</button>
                  </div>
                  <div className="space-y-3">
                    {formData.instalments.length === 0 && <p className="text-xs text-slate-400 italic text-center py-2">Full Payment Booking.</p>}
                    {formData.instalments.map((inst, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="date" className="input-field text-xs py-1.5" value={inst.dueDate} onChange={e => updateInstalmentRow(idx, 'dueDate', e.target.value)} required />
                        <input type="number" step="0.01" placeholder="Amount" className="input-field text-xs py-1.5 text-right font-mono" value={inst.amount} onChange={e => updateInstalmentRow(idx, 'amount', e.target.value)} required />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* SUPPLIER COSTS */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm h-fit">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
                  <h4 className="font-bold text-slate-700 text-sm uppercase">Supplier Costs</h4>
                  <button type="button" onClick={addSupplierRow} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-lg font-bold transition-colors">+ Add Row</button>
                </div>
                <div className="space-y-3">
                  {formData.supplierCosts.map((c, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <select className="input-field text-xs py-1.5" value={c.supplier} onChange={e => updateSupplierRow(idx, 'supplier', e.target.value)}>
                        <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="TRIVAGO">TRIVAGO</option><option value="OTHER">OTHER</option>
                      </select>
                      <select className="input-field text-xs py-1.5" value={c.category} onChange={e => updateSupplierRow(idx, 'category', e.target.value)}>
                        <option value="FLIGHT">FLIGHT</option><option value="HOTEL">HOTEL</option><option value="CRUISE">CRUISE</option><option value="OTHER">OTHER</option>
                      </select>
                      <input type="number" step="0.01" className="input-field text-xs py-1.5 text-right font-mono" value={c.amount} onChange={e => updateSupplierRow(idx, 'amount', e.target.value)} required />
                    </div>
                  ))}
                </div>
              </div>
          </div>

          <div className="bg-slate-800 text-white p-5 rounded-xl shadow-lg flex justify-between items-center">
            <div><span className="text-[10px] uppercase text-slate-400 block tracking-widest font-bold">Total Cost</span><span className="font-mono text-xl">{formatMoney(currentProdCost)}</span></div>
            <div className="text-right"><span className="text-[10px] uppercase text-slate-400 block tracking-widest font-bold">New Profit</span><span className="font-mono text-2xl font-bold text-emerald-400">{formatMoney(currentProfit)}</span></div>
          </div>
        </div>

        <div className="border-t border-slate-100 p-5 flex gap-3 bg-white justify-end">
          <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">Cancel</button>
          <button type="submit" disabled={loading} className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-lg shadow-blue-200">{loading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  );
};

// --- SUB-COMPONENT: The Tabbed Drawer ---
const ExpandedDetails = ({ booking: parentBooking, onUpdate }) => {
  const versions = [parentBooking, ...(parentBooking.amendments || [])];
  const [activeTabId, setActiveTabId] = useState(parentBooking.id);
  const currentViewBooking = versions.find(v => v.id === activeTabId) || parentBooking;

  const [isEditing, setIsEditing] = useState(false);
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppPayData, setSuppPayData] = useState({ amount: '', method: 'BANK', date: new Date().toISOString().split('T')[0], supplierCostId: '', supplierName: '', supplierCreditNoteId: null });
  const [searchSuppFolder, setSearchSuppFolder] = useState('');
  const [foundSuppWallet, setFoundSuppWallet] = useState(null);

  const initialTotal = currentViewBooking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = currentViewBooking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  const breakdownTotalCost = currentViewBooking.supplierCosts?.reduce((sum, c) => sum + c.amount, 0) || 0;
  const breakdownTotalPaid = currentViewBooking.supplierCosts?.reduce((sum, c) => sum + (c.paidAmount || 0), 0) || 0;
  const totalSupplierOwed = breakdownTotalCost - breakdownTotalPaid;

  const searchSupplierWallet = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:5000/api/bookings/credits/supplier/search?folder=${searchSuppFolder}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
         setFoundSuppWallet(res.data.data);
      } else { 
         setFoundSuppWallet(null); 
         alert(res.data.message); 
      }
    } catch (alert) { alert("Search failed."); }
  };

  const handleSupplierPaySubmit = async (e) => {
    e.preventDefault();
    if(suppPayData.method === 'SUPPLIER_CREDIT' && (!foundSuppWallet || suppPayData.amount > foundSuppWallet.remainingAmount)) {
       return alert("Invalid credit amount!");
    }
    try {
      const token = localStorage.getItem('token');
      const payload = { ...suppPayData, supplierCreditNoteId: foundSuppWallet?.id };
      await axios.post(`http://localhost:5000/api/bookings/${currentViewBooking.id}/supplier-payment`, payload, { headers: { Authorization: `Bearer ${token}` } });
      alert("Supplier Payment Recorded!");
      setShowSuppModal(false);
      setFoundSuppWallet(null);
      setSearchSuppFolder('');
      onUpdate(); 
    } catch (alert) { alert("Failed to record payment"); }
  };

  const handleCreateDateChange = async () => {
    if(!window.confirm("Create a new Date Change booking for this passenger?")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/bookings/approved/${parentBooking.id}/date-change`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if(res.data.success) {
         alert("Date Change Created! Please edit the financials and set the new date.");
         onUpdate();
         setActiveTabId(res.data.data.id); 
      }
    } catch (alert) { alert("Error creating Date Change"); }
  };

  const handleCancelBooking = async () => {
    if(!window.confirm("WARNING: This will lock all existing ledgers for this passenger and create a 1.c Cancellation folder. Proceed?")) return;
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:5000/api/bookings/approved/${parentBooking.id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } });
      if(res.data.success) {
         alert("Cancellation Folder Generated!");
         onUpdate();
         const newCancelTab = res.data.data?.id; 
         if (newCancelTab) setActiveTabId(newCancelTab);
      }
    } catch (alert) { alert("Error cancelling booking"); }
  };

  return (
    <div className="bg-slate-100/50 border-t border-b border-slate-200 p-4 shadow-inner text-sm relative">
      
      {/* THE TAB BAR */}
      <div className="flex gap-2 overflow-x-auto pb-0 px-2 pt-2 scrollbar-hide">
         {versions.map((v, idx) => (
            <button 
              key={v.id} 
              onClick={() => setActiveTabId(v.id)}
              className={`px-5 py-2.5 text-xs font-bold rounded-t-xl transition-all flex items-center gap-2 border-t border-l border-r ${activeTabId === v.id ? 'bg-white text-blue-700 shadow-sm border-slate-200 border-b-white translate-y-[1px] z-10' : 'bg-slate-200/50 text-slate-500 hover:bg-slate-200 border-transparent'}`}
            >
              {v.bookingType === 'CANCELLATION' ? '🚨 Cancellation' : (idx === 0 ? '📂 Original' : '🔄 Date Change')} 
              <span className="bg-slate-100 border border-slate-200 px-1.5 rounded text-[10px] text-slate-500 font-mono">{displayFolderNo(v.folderNo)}</span>
            </button>
         ))}
         
         <div className="ml-auto flex gap-2 pb-2">
            {!versions.some(v => v.bookingType === 'CANCELLATION') && (
              <>
                 <button onClick={handleCreateDateChange} className="px-3 py-1.5 text-[10px] font-bold text-slate-500 bg-white border border-slate-200 rounded-lg hover:border-blue-300 hover:text-blue-600 transition-colors shadow-sm">
                   + Date Change
                 </button>
                 <button onClick={handleCancelBooking} className="px-3 py-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 hover:border-rose-200 transition-colors shadow-sm">
                   Cancel Booking
                 </button>
              </>
            )}
         </div>
      </div>

      {/* THE MAIN CONTENT AREA */}
      <div className="bg-white p-8 rounded-b-xl rounded-tr-xl border border-slate-200 shadow-sm relative animate-fade-in min-h-[400px]">
        
        {currentViewBooking.bookingType === 'CANCELLATION' ? (
           <CancellationDashboard booking={currentViewBooking} familyVersions={versions} onUpdate={onUpdate} />
        ) : (
           <>
              {!currentViewBooking.isSettled && !currentViewBooking.isLocked && (
                <button onClick={() => setIsEditing(true)} className="absolute top-6 right-6 text-xs font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition shadow-sm z-10 border border-blue-100 flex items-center gap-2">
                  <span>✏️</span> Edit Ledger
                </button>
              )}

              {isEditing && !currentViewBooking.isLocked && <EditLedgerModal booking={currentViewBooking} onClose={() => setIsEditing(false)} onUpdate={onUpdate} />}

              {currentViewBooking.isLocked && (
                 <div className="bg-rose-50 text-rose-700 px-4 py-3 rounded-xl border border-rose-100 mb-8 font-bold flex items-center gap-2 text-sm w-fit">
                   🔒 LOCKED (Cancellation Processed)
                 </div>
              )}

              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${currentViewBooking.isLocked ? 'opacity-60 pointer-events-none grayscale-[0.5]' : ''}`}>
                
                {/* COLUMN 1: TRIP & PAX */}
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Booking Details</h4>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Agent</span>
                            <span className="font-bold text-slate-700">{currentViewBooking.agentName} <span className="text-slate-400 font-normal">({currentViewBooking.teamName})</span></span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Route</span>
                            <span className="font-bold text-slate-700">{currentViewBooking.fromTo}</span>
                        </div>
                        <div className="pt-2 border-t border-slate-200 mt-2">
                            <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Travel Date</span>
                            <span className="text-lg font-bold text-slate-800">{formatDate(currentViewBooking.travelDate)}</span>
                        </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Passengers ({currentViewBooking.numPax})</h4>
                    <div className="space-y-2">
                      {currentViewBooking.passengers.map((p, i) => (
                        <div key={i} className="flex justify-between items-center text-slate-600 bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm text-sm">
                          <span className="font-medium">{p.title} {p.firstName} {p.lastName}</span>
                          <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-100 px-1.5 rounded">{p.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: ACCOUNTS PAYABLE */}
                <div className="col-span-1 lg:col-span-1">
                  <div className="flex justify-between items-end mb-3">
                    <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest">Supplier Ledger</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${totalSupplierOwed > 0 ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>Owed: {formatMoney(totalSupplierOwed)}</span>
                  </div>
                  
                  {(!currentViewBooking.supplierCosts || currentViewBooking.supplierCosts.length === 0) ? (
                    <div className="bg-slate-50 rounded-xl border border-slate-200 border-dashed p-8 text-center">
                      <p className="text-xs text-slate-400 italic">No suppliers linked.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                      <div className="grid grid-cols-12 gap-2 bg-slate-50 px-4 py-2 border-b border-slate-200 text-[9px] font-bold text-slate-400 uppercase text-right">
                        <span className="col-span-4 text-left">Supplier</span><span className="col-span-3">Cost</span><span className="col-span-3">Paid</span><span className="col-span-2">Action</span>
                      </div>
                      <div className="divide-y divide-slate-100">
                      {currentViewBooking.supplierCosts.map((c, i) => {
                          const owed = c.amount - (c.paidAmount || 0);
                          return (
                           <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 text-slate-600 items-center text-right text-xs">
                             <div className="col-span-4 text-left">
                               <div className="font-bold text-blue-900">{c.supplier}</div>
                               <div className="text-[10px] text-slate-400">{c.category}</div>
                             </div>
                             <div className="col-span-3 font-mono">{formatMoney(c.amount)}</div>
                             <div className="col-span-3 font-mono text-blue-600">{formatMoney(c.paidAmount)}</div>
                             <div className="col-span-2 flex justify-end">
                                {owed > 0 && !currentViewBooking.isSettled && !currentViewBooking.isLocked ? (
                                   <button onClick={() => { setSuppPayData({...suppPayData, supplierCostId: c.id, supplierName: c.supplier, amount: owed}); setShowSuppModal(true); }} className="text-[10px] bg-slate-900 hover:bg-black text-white px-2 py-1 rounded transition-colors shadow-sm">PAY</button>
                                ) : (
                                   <span className="text-[10px] text-emerald-500 font-bold">✔</span>
                                )}
                             </div>
                           </div>
                          );
                      })}
                      </div>
                    </div>
                  )}
                </div>

                {/* COLUMN 3: PROFIT SUMMARY */}
                <div>
                  <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-3">Profit Snapshot</h4>
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Revenue</span>
                        <span className="text-slate-800 font-bold font-mono">{formatMoney(currentViewBooking.revenue)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-500">Total Costs</span>
                        <span className="text-rose-500 font-bold font-mono">-{formatMoney(breakdownTotalCost)}</span>
                    </div>
                    <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <span className="text-xs uppercase font-bold text-emerald-700 tracking-wider">Net Profit</span>
                        <span className="text-xl font-bold text-emerald-600 font-mono">{formatMoney(currentViewBooking.revenue - breakdownTotalCost)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                     <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Cash Position</span>
                        <span className={`font-mono font-bold ${totalPaid - breakdownTotalPaid >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(totalPaid - breakdownTotalPaid)}</span>
                     </div>
                     <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(100, (totalPaid / (currentViewBooking.revenue || 1)) * 100)}%` }}></div>
                     </div>
                     <div className="flex justify-between mt-1 text-[9px] text-slate-500">
                        <span>Paid In: {formatMoney(totalPaid)}</span>
                        <span>Paid Out: {formatMoney(breakdownTotalPaid)}</span>
                     </div>
                  </div>
                </div>
                
                {/* PAYMENT TERMINAL (Full Width) */}
                <div className="col-span-1 lg:col-span-3 mt-4 border-t border-slate-100 pt-8">
                    <h4 className="font-bold text-slate-800 text-sm mb-4 flex items-center gap-2">
                        <span className="bg-blue-100 text-blue-700 p-1 rounded">💳</span> Client Payment Terminal
                    </h4>
                    <PaymentTerminal booking={currentViewBooking} onUpdate={onUpdate} />
                </div>
              </div>
           </>
        )}
      </div>

      {/* SUPPLIER PAY MODAL */}
      {showSuppModal && !currentViewBooking.isLocked && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
           <form onSubmit={handleSupplierPaySubmit} className="bg-white p-8 rounded-2xl w-96 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold text-slate-800 text-xl mb-1">Pay Supplier</h3>
              <p className="text-xs text-slate-500 mb-6">Payment to <span className="font-bold text-blue-600">{suppPayData.supplierName}</span></p>
              
              <div className="space-y-4">
                  <div>
                      <label className="label">Payment Method</label>
                      <select className="input-field" value={suppPayData.method} onChange={e => {
                          setSuppPayData({...suppPayData, method: e.target.value});
                          if(e.target.value !== 'SUPPLIER_CREDIT') setFoundSuppWallet(null);
                      }}>
                          <option value="BANK">Bank Transfer</option><option value="CARD">Corporate Card</option>
                          <option value="SUPPLIER_CREDIT">Use Supplier Credit Note</option>
                      </select>
                  </div>

                  {suppPayData.method === 'SUPPLIER_CREDIT' && (
                      <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
                         <label className="text-[10px] font-bold text-rose-800 uppercase block mb-2">Search Cancelled Folder No.</label>
                         <div className="flex gap-2">
                            <input type="text" placeholder="e.g. FN-0001.c" className="w-full border border-rose-200 rounded-lg text-sm px-2" value={searchSuppFolder} onChange={e => setSearchSuppFolder(e.target.value)} />
                            <button type="button" onClick={searchSupplierWallet} className="bg-rose-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-rose-700">Search</button>
                         </div>
                         {foundSuppWallet && (
                            <div className="mt-2 text-xs text-rose-700 font-bold flex justify-between bg-white p-2 rounded border border-rose-100">
                                <span>Credit Available:</span><span>{formatMoney(foundSuppWallet.remainingAmount)}</span>
                            </div>
                         )}
                      </div>
                  )}

                  <div>
                      <label className="label">Amount (£)</label>
                      <input type="number" step="0.01" max={foundSuppWallet ? foundSuppWallet.remainingAmount : undefined} className="input-field font-mono font-bold text-right text-lg text-slate-700" value={suppPayData.amount} onChange={e => setSuppPayData({...suppPayData, amount: e.target.value})} required />
                  </div>
              </div>
              <div className="flex gap-3 mt-8">
                  <button className="flex-1 bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold hover:bg-slate-200 transition-colors" type="button" onClick={() => setShowSuppModal(false)}>Cancel</button>
                  <button className="flex-1 bg-slate-900 text-white rounded-xl py-3 text-sm font-bold hover:bg-slate-800 transition-colors shadow-lg" type="submit">Confirm Pay</button>
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
    <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 pb-20 font-sans text-slate-600">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
             <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Approved Ledgers</h1>
             <p className="text-slate-400 text-sm mt-1 font-medium">Manage live bookings, payments, and cancellations.</p>
          </div>
          <div className="relative group">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-300 to-indigo-300 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-200"></div>
             <input 
               type="text" 
               placeholder="Search Folder, Ref, or Pax..." 
               value={searchTerm} 
               onChange={(e) => setSearchTerm(e.target.value)} 
               className="relative px-5 py-3 bg-white border border-slate-100 rounded-xl w-full md:w-80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 font-medium shadow-sm text-slate-600 placeholder-slate-400" 
             />
             <span className="absolute right-4 top-3.5 text-slate-300">🔍</span>
          </div>
        </div>

        {/* TABLE CARD */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
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
            <tbody className="divide-y divide-slate-50/50">
              {loading ? (<tr><td colSpan="8" className="p-12 text-center text-slate-400 italic">Loading records...</td></tr>) : filteredBookings.length === 0 ? (<tr><td colSpan="8" className="p-12 text-center text-slate-400 italic">No records found.</td></tr>) : (
                filteredBookings.map((b) => {
                  const status = getPaymentStatus(b);
                  const isExpanded = expandedRows[b.id];
                  const hasCancellation = b.amendments?.some(a => a.bookingType === 'CANCELLATION');

                  return (
                    <React.Fragment key={b.id}>
                      <tr 
                        onClick={() => toggleRow(b.id)} 
                        className={`cursor-pointer transition-all duration-200 group ${isExpanded ? 'bg-blue-50/30' : 'hover:bg-white/50'}`}
                      >
                        <td className="px-4 py-4 text-center text-slate-300 text-xs group-hover:text-blue-400 transition-colors">{isExpanded ? '▼' : '▶'}</td>
                        <td className="px-6 py-4 font-bold text-blue-700 font-mono tracking-tight">{displayFolderNo(b.folderNo)}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">{formatDate(b.createdAt)}</td>
                        <td className="px-6 py-4 font-mono text-xs">
                           <div className="font-bold text-slate-700">{b.refNo}</div>
                           <div className="text-slate-400">{b.pnr}</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-bold text-slate-700">{b.paxName}</div>
                           <div className="text-[10px] uppercase text-slate-400 font-bold bg-slate-100 w-fit px-1.5 rounded mt-0.5">{b.numPax} Pax</div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-medium">{b.fromTo}</div>
                           <div className="text-[10px] text-slate-400 font-bold">{b.airline}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasCancellation ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-rose-50 text-rose-600 border-rose-100 uppercase tracking-wide">CANCELLED</span>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wide ${status.color}`}>{status.label}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600/80 bg-emerald-50/30">
                           {hasCancellation 
                             ? formatMoney(b.amendments.find(a => a.bookingType === 'CANCELLATION').consultantFee) 
                             : formatMoney(b.profit)}
                        </td>
                      </tr>
                      {isExpanded && (<tr><td colSpan="8" className="p-0 border-b border-slate-100"><ExpandedDetails booking={b} onUpdate={fetchApprovedBookings} /></td></tr>)}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style>{`
        .label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-field { width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.6rem 0.8rem; font-size: 0.875rem; color: #334155; transition: all 0.2s; outline: none; }
        .input-field:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1); }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; opacity: 0; transform: translateY(5px); }
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
      `}</style>
    </div>
  );
}