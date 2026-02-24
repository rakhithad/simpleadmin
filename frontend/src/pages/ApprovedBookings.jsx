import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import PaymentTerminal from '../components/PaymentTerminal';

const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '-';
const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

const displayFolderNo = (fn) => {
  if (!fn) return '';
  return fn.replace(/^FN-0*/, ''); 
};

const getPaymentStatus = (booking) => {
  const revenue = booking.revenue || 0;
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  if (totalPaid >= revenue - 0.05) return { label: 'PAID FULL', color: 'bg-green-100 text-green-800 border-green-200' };
  if (totalPaid > 0) return { label: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { label: 'UNPAID', color: 'bg-red-100 text-red-800 border-red-200' };
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
    if (res.data.success) setWalletRef(res.data.data); // This updates the UI to £200

    onUpdate(); // Refreshes the parent page financials
  } catch (alert) { alert("Failed to refund."); }
};

  if (booking.isLocked) {
    return (
      <div className="bg-white p-6 rounded shadow-sm border border-red-200 mt-4">
        <h3 className="text-red-700 font-bold text-lg mb-4 border-b pb-2 flex justify-between items-center">
           <span>🔒 Final Cancellation Record</span>
           <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">Folder: {booking.folderNo}</span>
        </h3>
        <div className="grid grid-cols-3 gap-6 text-sm">
           <div className="bg-slate-50 p-4 rounded border">
              <span className="block text-slate-500 uppercase text-[10px] font-bold">Supplier Credit Note Received</span>
              <span className="text-xl font-mono text-slate-800">{formatMoney(booking.supplierRefund)}</span>
           </div>
           <div className="bg-green-50 p-4 rounded border border-green-200">
              <span className="block text-green-700 uppercase text-[10px] font-bold">Agency Profit (Fee)</span>
              <span className="text-xl font-mono font-bold text-green-700">{formatMoney(booking.consultantFee)}</span>
           </div>
           
           {/* LIVE PAX WALLET STATUS */}
           <div className="bg-blue-50 p-4 rounded border border-blue-200 relative">
              <span className="block text-blue-800 uppercase text-[10px] font-bold">Pax Wallet Balance</span>
              {walletRef ? (
                 <>
                   <span className="text-xl font-mono font-bold text-blue-700">{formatMoney(walletRef.remainingAmount)}</span>
                   <button onClick={() => setShowBankRefund(true)} className="absolute bottom-4 right-4 text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-bold hover:bg-blue-700 transition-colors">
                      💸 Refund to Bank
                   </button>
                 </>
              ) : (
                 <span className="text-sm font-bold text-slate-500 mt-1 block">£0.00 (Exhausted / Emptied)</span>
              )}
           </div>
        </div>

        {/* BANK REFUND MODAL */}
        {showBankRefund && walletRef && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
             <form onSubmit={handleBankRefund} className="bg-white p-6 rounded-xl w-80 shadow-2xl animate-fade-in border border-slate-100">
                <h3 className="font-bold mb-2 text-slate-800 text-lg">Cash Out Wallet</h3>
                <p className="text-xs text-slate-500 mb-4">Send funds from digital wallet back to the passenger's actual bank account.</p>
                <div>
                   <label className="text-xs font-bold text-slate-500 block mb-1">Amount to Send (£)</label>
                   <input type="number" step="0.01" max={walletRef.remainingAmount} className="w-full border border-slate-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none font-mono font-bold text-right text-lg text-blue-700" value={bankRefundAmount} onChange={e => setBankRefundAmount(e.target.value)} required />
                </div>
                <div className="flex gap-2 mt-6">
                   <button type="submit" className="flex-1 bg-blue-600 text-white rounded py-2 text-sm font-bold hover:bg-blue-700 transition-colors">Process Refund</button>
                   <button type="button" onClick={() => setShowBankRefund(false)} className="flex-1 bg-slate-200 text-slate-700 rounded py-2 text-sm font-bold hover:bg-slate-300 transition-colors">Cancel</button>
                </div>
             </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-red-50 p-6 rounded shadow-sm border border-red-200 mt-4 animate-fade-in">
      <h3 className="text-red-800 font-bold text-lg mb-2">Process Cancellation & Wallets</h3>
      <p className="text-xs text-red-600 mb-6">Careful: Saving this will permanently lock the cancellation math and generate the digital credit notes.</p>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-2 gap-8">
           
           {/* SUPPLIER SIDE */}
           <div className="bg-white p-4 rounded border shadow-sm flex flex-col justify-between">
             <div>
               <h4 className="font-bold text-slate-700 mb-4 border-b pb-2 text-sm">1. Supplier Money Recovery</h4>
               <label className="block text-xs font-bold text-slate-500">Total Refund Granted by Supplier (£)</label>
               <input type="number" step="0.01" className="w-full border p-2 rounded mt-1 mb-4 font-mono text-right font-bold text-lg text-blue-700" value={formData.supplierRefund} onChange={e => setFormData({...formData, supplierRefund: parseFloat(e.target.value) || 0})} required/>
               
               <div className="grid grid-cols-2 gap-2 mb-4">
                 <div>
                   <label className="block text-xs font-bold text-slate-500">Supplier Name</label>
                   <select className="w-full border p-2 rounded mt-1 text-sm bg-slate-50" value={formData.supplierName} onChange={e => setFormData({...formData, supplierName: e.target.value})}>
                      <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="OTHER">OTHER</option>
                   </select>
                 </div>
                 <div>
                   <label className="block text-xs font-bold text-slate-500">Supplier Reference / PNR</label>
                   <input type="text" placeholder="e.g. REF-12345" className="w-full border p-2 rounded mt-1 text-sm" value={formData.supplierReference} onChange={e => setFormData({...formData, supplierReference: e.target.value})} />
                 </div>
               </div>
             </div>
             <p className="text-[10px] text-slate-400 italic bg-slate-50 p-2 rounded border border-slate-100">Note: This exact refund amount will be securely stored as a Supplier Credit Note for future use.</p>
           </div>

           {/* PAX SIDE */}
           <div className="bg-white p-4 rounded border shadow-sm">
             <h4 className="font-bold text-slate-700 mb-4 border-b pb-2 text-sm">2. Pax Entitlement & Profit</h4>
             <label className="block text-xs font-bold text-green-600">Consultant Fee (Agency Profit) (£)</label>
             <input type="number" step="0.01" className="w-full border border-green-300 p-2 rounded mt-1 mb-6 font-mono text-right bg-green-50 font-bold" value={formData.consultantFee} onChange={e => setFormData({...formData, consultantFee: parseFloat(e.target.value) || 0})} required/>
             
             {/* Clean, Top-to-Bottom Breakdown */}
             <div className="bg-slate-50 p-4 rounded border border-slate-200 space-y-3 text-sm text-slate-600">
                <div className="flex justify-between font-medium"><span>Supplier Refund Amount:</span> <span className="font-mono">{formatMoney(formData.supplierRefund)}</span></div>
                <div className="flex justify-between text-red-500 border-b border-dashed pb-3"><span>Consultant Fee:</span> <span className="font-mono">-{formatMoney(formData.consultantFee)}</span></div>
                <div className="pt-1 flex justify-between font-bold text-blue-700 text-lg items-center">
                   <span>Final Pax Credit Wallet:</span> <span className="font-mono bg-blue-100 px-2 py-1 rounded">{formatMoney(finalPaxWallet)}</span>
                </div>
             </div>
           </div>
        </div>
        
        <button type="submit" className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded shadow-lg transition-colors text-lg uppercase tracking-wider">
          Lock Cancellation & Generate Credit Notes
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
      <form onSubmit={submitEdit} className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in flex flex-col max-h-[95vh]">
        
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold">Edit Financial Ledger & Trip Info</h2>
            <p className="text-xs text-slate-300">Folder #{booking.folderNo} • {booking.paxName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-300 hover:text-white font-bold text-xl">&times;</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div><label className="text-xs font-bold text-slate-500 uppercase">Travel Date</label><input type="date" className="w-full border p-2 rounded mt-1 text-sm font-bold" value={formData.travelDate} onChange={e => setFormData({...formData, travelDate: e.target.value})} required/></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Revenue (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.revenue} onChange={e => setFormData({...formData, revenue: e.target.value})} required/></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Trans Fee (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.transFee} onChange={e => setFormData({...formData, transFee: e.target.value})} required/></div>
            <div><label className="text-xs font-bold text-slate-500 uppercase">Surcharge (£)</label><input type="number" step="0.01" className="w-full border p-2 rounded text-right font-mono mt-1" value={formData.surcharge} onChange={e => setFormData({...formData, surcharge: e.target.value})} required/></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-white border border-green-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-green-100 pb-2 mb-3">
                    <h4 className="font-bold text-green-800 text-sm">Initial Payments (Deposits)</h4>
                    <button type="button" onClick={addInitialPaymentRow} className="text-xs bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded font-bold">+ Add Deposit</button>
                  </div>
                  <div className="space-y-2">
                    {formData.initialPayments.length === 0 && <p className="text-xs text-slate-400 italic">No deposits recorded yet.</p>}
                    {formData.initialPayments.map((ip, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="date" className="border p-2 rounded text-sm w-1/3" value={ip.paymentDate} onChange={e => updateInitialPaymentRow(idx, 'paymentDate', e.target.value)} required />
                        <select className="border p-2 rounded text-sm w-1/3" value={ip.transactionMethod} onChange={e => updateInitialPaymentRow(idx, 'transactionMethod', e.target.value)}>
                          <option value="BANK">BANK</option><option value="CASH">CASH</option><option value="CARD">CARD</option>
                        </select>
                        <input type="number" step="0.01" placeholder="Amount" className="border p-2 rounded text-sm w-1/3 text-right font-mono" value={ip.amount} onChange={e => updateInitialPaymentRow(idx, 'amount', e.target.value)} required />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-blue-200 rounded-lg p-4 shadow-sm">
                  <div className="flex justify-between items-center border-b border-blue-100 pb-2 mb-3">
                    <h4 className="font-bold text-blue-800 text-sm">Customer Payment Plan</h4>
                    <button type="button" onClick={addInstalmentRow} className="text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-1 rounded font-bold">+ Add Instalment</button>
                  </div>
                  <div className="space-y-2">
                    {formData.instalments.length === 0 && <p className="text-xs text-slate-400 italic">No future plan set. Client pays in full.</p>}
                    {formData.instalments.map((inst, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <input type="date" className="border p-2 rounded text-sm w-1/2" value={inst.dueDate} onChange={e => updateInstalmentRow(idx, 'dueDate', e.target.value)} required />
                        <input type="number" step="0.01" placeholder="Amount" className="border p-2 rounded text-sm w-1/2 text-right font-mono" value={inst.amount} onChange={e => updateInstalmentRow(idx, 'amount', e.target.value)} required />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-red-200 rounded-lg p-4 shadow-sm h-fit">
                <div className="flex justify-between items-center border-b border-red-100 pb-2 mb-3">
                  <h4 className="font-bold text-red-800 text-sm">Supplier Costs</h4>
                  <button type="button" onClick={addSupplierRow} className="text-xs bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded font-bold">+ Add Supplier</button>
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
                </div>
              </div>
          </div>

          <div className="bg-slate-800 text-white p-4 rounded-lg flex justify-between items-center shadow-inner">
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

// --- SUB-COMPONENT: The Tabbed Drawer ---
const ExpandedDetails = ({ booking: parentBooking, onUpdate }) => {
  const versions = [parentBooking, ...(parentBooking.amendments || [])];
  const [activeTabId, setActiveTabId] = useState(parentBooking.id);
  const currentViewBooking = versions.find(v => v.id === activeTabId) || parentBooking;

  const [isEditing, setIsEditing] = useState(false);
  
  // Supplier Pay Modal State
  const [showSuppModal, setShowSuppModal] = useState(false);
  const [suppPayData, setSuppPayData] = useState({ amount: '', method: 'BANK', date: new Date().toISOString().split('T')[0], supplierCostId: '', supplierName: '', supplierCreditNoteId: null });
  
  // Supplier Wallet Search State
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
       return alert("Invalid credit amount! Please ensure the credit covers the payment amount.");
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
    <div className="bg-slate-200 border-t border-b border-slate-300 p-2 shadow-inner text-sm relative">
      
      {/* THE TAB BAR */}
      <div className="flex gap-2 overflow-x-auto pb-2 px-2 pt-2">
         {versions.map((v, idx) => (
            <button 
              key={v.id} 
              onClick={() => setActiveTabId(v.id)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg transition-colors flex items-center gap-2 ${activeTabId === v.id ? 'bg-slate-50 text-blue-800 shadow-md border-t-2 border-blue-600' : 'bg-slate-300 text-slate-600 hover:bg-slate-50'}`}
            >
              {v.bookingType === 'CANCELLATION' ? '🚨 Cancellation' : (idx === 0 ? '📂 Original Booking' : '🔄 Date Change')} 
              <span className="bg-white/50 px-1.5 rounded text-[10px]">{displayFolderNo(v.folderNo)}</span>
            </button>
         ))}
         
         {/* Action buttons (only show if no cancellation exists yet) */}
         <div className="ml-auto flex gap-2">
            {!versions.some(v => v.bookingType === 'CANCELLATION') && (
              <>
                 <button onClick={handleCreateDateChange} className="px-3 py-1.5 text-xs font-bold text-slate-600 border border-slate-400 border-dashed rounded hover:bg-white hover:text-blue-600 transition-colors">
                    ➕ Add Date Change
                 </button>
                 <button onClick={handleCancelBooking} className="px-3 py-1.5 text-xs font-bold text-red-600 border border-red-300 bg-red-50 rounded hover:bg-red-100 shadow-sm transition-colors">
                    🚨 Cancel Booking
                 </button>
              </>
            )}
         </div>
      </div>

      {/* THE MAIN CONTENT AREA */}
      <div className="bg-slate-50 p-6 rounded-b-lg rounded-tr-lg shadow-md relative animate-fade-in">
        
        {currentViewBooking.bookingType === 'CANCELLATION' ? (
           <CancellationDashboard booking={currentViewBooking} familyVersions={versions} onUpdate={onUpdate} />
        ) : (
           <>
              {!currentViewBooking.isSettled && !currentViewBooking.isLocked && (
                <button onClick={() => setIsEditing(true)} className="absolute top-4 right-6 text-xs font-bold text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded hover:bg-blue-100 transition shadow-sm z-10">
                  ✏️ Edit Financials & Date
                </button>
              )}

              {isEditing && !currentViewBooking.isLocked && <EditLedgerModal booking={currentViewBooking} onClose={() => setIsEditing(false)} onUpdate={onUpdate} />}

              {currentViewBooking.isLocked && (
                 <div className="bg-red-50 text-red-700 p-3 rounded border border-red-200 mb-6 font-bold flex items-center gap-2">
                   🔒 THIS LEDGER IS LOCKED DUE TO CANCELLATION
                 </div>
              )}

              <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 ${currentViewBooking.isLocked ? 'opacity-70 pointer-events-none' : 'mt-4'}`}>
                
                {/* COLUMN 1: TRIP & PAX */}
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1 flex justify-between items-end">
                    Trip Details
                    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${currentViewBooking.bookingType === 'DATE_CHANGE' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                      {currentViewBooking.bookingType}
                    </span>
                  </h4>
                  <div className="grid grid-cols-2 gap-y-2 text-slate-600">
                    <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Agent</span>{currentViewBooking.agentName} ({currentViewBooking.teamName})</div>
                    <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Route</span>{currentViewBooking.fromTo}</div>
                    <div className="col-span-2 bg-yellow-50 border border-yellow-200 p-2 rounded">
                       <span className="block text-[10px] text-yellow-800 uppercase font-bold">Travel Date</span>
                       <span className="font-bold text-lg text-yellow-900">{formatDate(currentViewBooking.travelDate)}</span>
                    </div>
                  </div>
                  
                  <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1 mt-2">Passengers ({currentViewBooking.numPax})</h4>
                  <div className="space-y-1">
                    {currentViewBooking.passengers.map((p, i) => (
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
                  
                  {(!currentViewBooking.supplierCosts || currentViewBooking.supplierCosts.length === 0) ? (
                    <div className="bg-yellow-50 rounded border border-yellow-200 p-4 text-center mt-2">
                      <p className="text-xs text-yellow-700 italic">No suppliers listed for this version.</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded border border-slate-200 overflow-hidden mt-2 shadow-sm">
                      <div className="grid grid-cols-12 gap-2 bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[9px] font-bold text-slate-500 uppercase text-right">
                        <span className="col-span-3 text-left">Supplier</span><span className="col-span-3">Cost</span><span className="col-span-3 text-blue-600">Paid</span><span className="col-span-3 text-red-500">Owed</span>
                      </div>
                      {currentViewBooking.supplierCosts.map((c, i) => {
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
                               {owed > 0 && !currentViewBooking.isSettled && !currentViewBooking.isLocked && (
                                  <button onClick={() => { setSuppPayData({...suppPayData, supplierCostId: c.id, supplierName: c.supplier, amount: owed}); setShowSuppModal(true); }} className="text-[9px] bg-slate-800 text-white px-1.5 py-0.5 rounded mt-1 hover:bg-slate-700 transition-colors pointer-events-auto">PAY</button>
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
                  <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1">Version Profit & Loss</h4>
                  <div className="space-y-2 mt-2 bg-white p-3 rounded border border-slate-200 shadow-sm">
                    <div className="flex justify-between text-slate-500"><span>Client Revenue:</span> <span className="text-slate-800 font-bold">{formatMoney(currentViewBooking.revenue)}</span></div>
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
                
                {/* PAYMENT TERMINAL (Full Width) */}
                <div className="col-span-1 lg:col-span-3 mt-4 border-t-4 border-slate-200 pt-4">
                    <PaymentTerminal booking={currentViewBooking} onUpdate={onUpdate} />
                </div>
              </div>
           </>
        )}
      </div>

      {/* SUPPLIER PAY MODAL (WITH SUPPLIER CREDIT SEARCH) */}
      {showSuppModal && !currentViewBooking.isLocked && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] backdrop-blur-sm">
           <form onSubmit={handleSupplierPaySubmit} className="bg-white p-6 rounded-xl w-96 shadow-2xl animate-fade-in border border-slate-100">
              <h3 className="font-bold text-slate-800 text-lg mb-1">Pay Supplier</h3>
              <p className="text-xs text-slate-500 mb-4">Payment to <span className="font-bold text-blue-600">{suppPayData.supplierName}</span></p>
              
              <div className="space-y-3">
                  <div>
                      <label className="text-xs font-bold text-slate-500 block mb-1">Payment Method</label>
                      <select className="w-full border border-slate-300 p-2 rounded text-sm bg-slate-50 font-bold" value={suppPayData.method} onChange={e => {
                          setSuppPayData({...suppPayData, method: e.target.value});
                          if(e.target.value !== 'SUPPLIER_CREDIT') setFoundSuppWallet(null);
                      }}>
                         <option value="BANK">Bank Transfer</option><option value="CARD">Corporate Card</option>
                         <option value="SUPPLIER_CREDIT">Use Supplier Credit Note</option>
                      </select>
                  </div>

                  {suppPayData.method === 'SUPPLIER_CREDIT' && (
                     <div className="bg-red-50 p-3 rounded border border-red-200">
                        <label className="text-[10px] font-bold text-red-800 uppercase">Search Cancelled Folder No.</label>
                        <div className="flex gap-2 mt-1">
                           <input type="text" placeholder="e.g. FN-0001.c" className="w-full border border-slate-300 p-1.5 rounded text-sm font-mono" value={searchSuppFolder} onChange={e => setSearchSuppFolder(e.target.value)} />
                           <button type="button" onClick={searchSupplierWallet} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-red-700 transition-colors">Search</button>
                        </div>
                        {foundSuppWallet && (
                           <div className="mt-2 bg-white p-2 rounded border border-red-100 flex flex-col gap-1 text-xs shadow-sm">
                             <div className="flex justify-between items-center"><span className="font-bold text-slate-600">Available Credit:</span><span className="font-mono text-green-600 font-bold text-sm">{formatMoney(foundSuppWallet.remainingAmount)}</span></div>
                             <div className="flex justify-between text-[10px] text-slate-400"><span>Supplier Ref:</span> <span className="font-mono">{foundSuppWallet.reference || 'N/A'}</span></div>
                           </div>
                        )}
                     </div>
                  )}

                  <div>
                     <label className="text-xs font-bold text-slate-500 block mb-1">Amount Sent (£)</label>
                     <input type="number" step="0.01" max={foundSuppWallet ? foundSuppWallet.remainingAmount : undefined} className="w-full border border-slate-300 p-2 rounded font-mono font-bold text-right text-lg text-red-700 outline-none focus:ring-2 focus:ring-red-500" value={suppPayData.amount} onChange={e => setSuppPayData({...suppPayData, amount: e.target.value})} required />
                  </div>
              </div>
              <div className="flex gap-2 mt-6">
                 <button className="flex-1 bg-slate-800 text-white rounded py-2 text-sm font-bold hover:bg-slate-700 transition-colors" type="submit">Record Outgoing</button>
                 <button className="flex-1 bg-slate-200 text-slate-700 rounded py-2 text-sm font-bold hover:bg-slate-300 transition-colors" type="button" onClick={() => setShowSuppModal(false)}>Cancel</button>
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
          <input type="text" placeholder="Search Folder, Ref, or Pax..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-sm" />
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
                        <td className="px-6 py-4 font-bold text-blue-700">{displayFolderNo(b.folderNo)}</td>
                        <td className="px-6 py-4 text-slate-500">{formatDate(b.createdAt)}</td>
                        <td className="px-6 py-4 font-mono text-xs"><div className="font-bold text-slate-800">{b.refNo}</div><div className="text-slate-500">{b.pnr}</div></td>
                        <td className="px-6 py-4"><div className="font-medium text-slate-900">{b.paxName}</div><div className="text-xs text-slate-500">{b.numPax} Pax</div></td>
                        <td className="px-6 py-4"><div>{b.fromTo}</div><div className="text-xs text-slate-400">{b.airline}</div></td>
                        <td className="px-6 py-4 text-center">
                          {b.amendments?.some(a => a.bookingType === 'CANCELLATION') ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold border bg-red-100 text-red-800 border-red-200">CANCELLED</span>
                          ) : (
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>{status.label}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                           {/* If cancelled, show the fee profit, else original profit */}
                           {b.amendments?.some(a => a.bookingType === 'CANCELLATION') 
                              ? formatMoney(b.amendments.find(a => a.bookingType === 'CANCELLATION').consultantFee) 
                              : formatMoney(b.profit)}
                        </td>
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

