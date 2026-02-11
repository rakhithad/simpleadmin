import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Button from '../components/Button';

// Utility to format date for Input fields (YYYY-MM-DD)
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
};

export default function BookingManager() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModeId, setEditModeId] = useState(null);

  // --- INITIAL STATE ---
  const initialFormState = {
    paymentMethod: 'FULL',
    
    // Flight & Booking Info
    refNo: '', agentName: '', teamName: 'PH', 
    pnr: '', airline: '', fromTo: '', bookingType: 'FRESH',
    pcDate: formatDate(new Date()), travelDate: '', description: '',
    
    // Financials
    revenue: 0, transFee: 0, surcharge: 0,
    // Note: prodCost is now derived from supplierCosts
    
    // NEW: Cost Breakdown List
    supplierCosts: [], 
    
    // Passenger Details
    numPax: 1,
    paxName: '', 
    passengers: [{ 
      title: 'MR', firstName: '', middleName: '', lastName: '', 
      gender: 'MALE', category: 'ADULT', birthday: '', 
      email: '', contactNo: '', nationality: '' 
    }],
    
    // Initial Payment (Deposit)
    initialPayments: [{ amount: 0, transactionMethod: 'CASH', paymentDate: formatDate(new Date()) }],
    
    // Instalments (Only for INTERNAL)
    instalments: []
  };

  const [formData, setFormData] = useState(initialFormState);

  // Local state for the "Add Cost" mini-form
  const [newCost, setNewCost] = useState({ supplier: 'BTRES', category: 'FLIGHT', amount: '' });

  // --- API CALLS ---
  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setBookings(res.data.data);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBookings(); }, []);

  // --- REAL-TIME CALCULATIONS (CRASH PROOF) ---
  const calculateFinancials = () => {
    const rev = parseFloat(formData.revenue || 0);
    const fee = parseFloat(formData.transFee || 0);
    const sur = parseFloat(formData.surcharge || 0);
    
    // NEW: Calculate Total Prod Cost automatically from the list
    // Safety: use (formData.supplierCosts || [])
    const totalProdCost = (formData.supplierCosts || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    
    // Profit Formula
    const profit = rev - (totalProdCost + sur + fee);
    
    // Total Paid
    const paid = (formData.initialPayments || []).reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    
    // Balance
    const balance = rev - paid;
    
    // Instalment Total
    const instTotal = (formData.instalments || []).reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);

    return { profit, balance, instTotal, totalProdCost };
  };

  const { profit, balance, instTotal, totalProdCost } = calculateFinancials();

  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePaxChange = (field, value) => {
    const updatedPax = [...(formData.passengers || initialFormState.passengers)];
    updatedPax[0][field] = value;
    
    setFormData({ 
      ...formData, 
      passengers: updatedPax,
      paxName: `${updatedPax[0].lastName}/${updatedPax[0].firstName}`
    });
  };

  const handlePaymentChange = (index, field, value) => {
    const newPayments = [...(formData.initialPayments || initialFormState.initialPayments)];
    newPayments[index][field] = value;
    setFormData({ ...formData, initialPayments: newPayments });
  };

  // --- NEW: COST BREAKDOWN HANDLERS ---
  const addCostItem = () => {
    if (!newCost.amount || parseFloat(newCost.amount) <= 0) return;
    
    setFormData({
      ...formData,
      supplierCosts: [...(formData.supplierCosts || []), { 
        ...newCost, 
        amount: parseFloat(newCost.amount) 
      }]
    });
    
    // Reset the mini-form inputs
    setNewCost({ supplier: 'BTRES', category: 'FLIGHT', amount: '' }); 
  };

  const removeCostItem = (index) => {
    const newCosts = (formData.supplierCosts || []).filter((_, i) => i !== index);
    setFormData({ ...formData, supplierCosts: newCosts });
  };

  // --- INSTALMENT HANDLERS ---
  const addInstalment = () => {
    setFormData({
      ...formData,
      instalments: [...(formData.instalments || []), { dueDate: '', amount: 0, status: 'PENDING' }]
    });
  };

  const removeInstalment = (index) => {
    const newInst = (formData.instalments || []).filter((_, i) => i !== index);
    setFormData({ ...formData, instalments: newInst });
  };

  const handleInstalmentChange = (index, field, value) => {
    const newInst = [...(formData.instalments || [])];
    newInst[index][field] = value;
    setFormData({ ...formData, instalments: newInst });
  };

  const distributeBalance = () => {
    if (!formData.instalments || formData.instalments.length === 0) return;
    const amountPerInst = (balance / formData.instalments.length).toFixed(2);
    
    const newInst = formData.instalments.map(i => ({ ...i, amount: amountPerInst }));
    setFormData({ ...formData, instalments: newInst });
  };

  // --- EDIT & SUBMIT ---
  const handleEdit = (booking) => {
    setEditModeId(booking.id);
    
    setFormData({
      ...booking,
      pcDate: formatDate(booking.pcDate),
      travelDate: formatDate(booking.travelDate),
      
      // NEW: Load existing supplier costs or empty array
      supplierCosts: booking.supplierCosts || [],

      // Ensure passenger array exists
      passengers: booking.passengers && booking.passengers.length > 0 ? [{
        ...booking.passengers[0],
        birthday: formatDate(booking.passengers[0].birthday)
      }] : initialFormState.passengers,
      
      // Ensure payments exist
      initialPayments: booking.pendingInitialPayments && booking.pendingInitialPayments.length > 0 
        ? booking.pendingInitialPayments.map(p => ({...p, paymentDate: formatDate(p.paymentDate)}))
        : initialFormState.initialPayments,
        
      // Ensure instalments exist
      instalments: booking.instalments ? booking.instalments.map(i => ({...i, dueDate: formatDate(i.dueDate)})) : []
    });
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditModeId(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Strict Validation
    if (formData.paymentMethod === 'INTERNAL') {
      if (Math.abs(balance - instTotal) > 0.05) { 
        alert(`STRICT MATH ERROR:\n\nBalance Remaining: £${balance.toFixed(2)}\nInstalments Total: £${instTotal.toFixed(2)}\n\nPlease ensure instalments match the balance exactly.`);
        setLoading(false);
        return;
      }
    }

    const token = localStorage.getItem('token');
    const paxName = formData.paxName || `${formData.passengers?.[0]?.lastName}/${formData.passengers?.[0]?.firstName}`;
    
    // IMPORTANT: We send the calculated 'totalProdCost' as 'prodCost' to the backend
    const payload = { 
      ...formData, 
      paxName,
      prodCost: totalProdCost // Overwrite any stale value
    };

    try {
      if (editModeId) {
        await axios.put(`http://localhost:5000/api/bookings/${editModeId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Booking Updated Successfully');
      } else {
        await axios.post('http://localhost:5000/api/bookings', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Booking Created Successfully');
      }
      
      handleCancelEdit(); 
      fetchBookings(); 
    } catch (err) {
      alert(err.response?.data?.message || 'Operation failed. Check console.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* --- FORM HEADER --- */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">
            {editModeId ? `Editing Booking #${editModeId}` : 'New Booking Entry'}
          </h1>
          {editModeId && (
            <button onClick={handleCancelEdit} className="text-red-600 hover:underline">
              Cancel Editing
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* 1. PAYMENT METHOD TOGGLE */}
          <div className="flex justify-center bg-white p-2 rounded-xl shadow-sm border border-slate-200 w-full max-w-md mx-auto">
            <button
              type="button"
              onClick={() => setFormData({...formData, paymentMethod: 'FULL', instalments: []})}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.paymentMethod === 'FULL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              FULL PAYMENT
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, paymentMethod: 'INTERNAL'})}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.paymentMethod === 'INTERNAL' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              INTERNAL (Instalments)
            </button>
          </div>

          {/* 2. CORE INFO CARD */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Flight & Booking Details</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div><label className="label">Ref No</label><input name="refNo" value={formData.refNo} onChange={handleChange} className="input-field" required placeholder="BKG-001"/></div>
              <div><label className="label">PNR</label><input name="pnr" value={formData.pnr} onChange={handleChange} className="input-field font-mono uppercase" required /></div>
              <div><label className="label">Airline</label><input name="airline" value={formData.airline} onChange={handleChange} className="input-field" required /></div>
              <div><label className="label">Route</label><input name="fromTo" value={formData.fromTo} onChange={handleChange} className="input-field" placeholder="CMB-DXB" required /></div>
              <div><label className="label">Agent Name</label><input name="agentName" value={formData.agentName} onChange={handleChange} className="input-field" /></div>
              <div><label className="label">PC Date</label><input type="date" name="pcDate" value={formData.pcDate} onChange={handleChange} className="input-field" required /></div>
              <div><label className="label">Travel Date</label><input type="date" name="travelDate" value={formData.travelDate} onChange={handleChange} className="input-field" required /></div>
              <div>
                <label className="label">Booking Type</label>
                <select name="bookingType" value={formData.bookingType} onChange={handleChange} className="input-field">
                  <option value="FRESH">Fresh</option><option value="DATE_CHANGE">Date Change</option><option value="CANCELLATION">Cancellation</option>
                </select>
              </div>
            </div>
          </div>

          {/* 3. PASSENGER DETAILS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex justify-between">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Lead Passenger Info</h3>
              <div className="flex gap-2 items-center">
                <label className="text-xs font-semibold text-slate-600">Total Pax:</label>
                <input type="number" name="numPax" value={formData.numPax} onChange={handleChange} className="w-16 text-center text-sm border rounded" min="1" max="50" />
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="label">Title</label>
                <select value={formData.passengers?.[0]?.title} onChange={(e) => handlePaxChange('title', e.target.value)} className="input-field">
                  <option value="MR">Mr</option><option value="MRS">Mrs</option><option value="MS">Ms</option><option value="MASTER">Master</option>
                </select>
              </div>
              <div><label className="label">First Name</label><input value={formData.passengers?.[0]?.firstName} onChange={(e) => handlePaxChange('firstName', e.target.value)} className="input-field" required /></div>
              <div><label className="label">Last Name</label><input value={formData.passengers?.[0]?.lastName} onChange={(e) => handlePaxChange('lastName', e.target.value)} className="input-field" required /></div>
              <div>
                <label className="label">Gender</label>
                <select value={formData.passengers?.[0]?.gender} onChange={(e) => handlePaxChange('gender', e.target.value)} className="input-field">
                  <option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
              </div>
              <div><label className="label">DOB</label><input type="date" value={formData.passengers?.[0]?.birthday} onChange={(e) => handlePaxChange('birthday', e.target.value)} className="input-field" /></div>
              <div><label className="label">Email</label><input type="email" value={formData.passengers?.[0]?.email} onChange={(e) => handlePaxChange('email', e.target.value)} className="input-field" /></div>
              <div><label className="label">Contact No</label><input value={formData.passengers?.[0]?.contactNo} onChange={(e) => handlePaxChange('contactNo', e.target.value)} className="input-field" /></div>
            </div>
          </div>

          {/* 4. FINANCIALS & COST BREAKDOWN */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Financials</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* LEFT COLUMN: REVENUE & PROFIT */}
              <div className="space-y-4">
                <div><label className="label">Revenue (£)</label><input type="number" name="revenue" value={formData.revenue} onChange={handleChange} className="input-field text-right font-mono" step="0.01" /></div>
                <div><label className="label">Trans Fee (£)</label><input type="number" name="transFee" value={formData.transFee} onChange={handleChange} className="input-field text-right font-mono" step="0.01" /></div>
                <div><label className="label">Surcharge (£)</label><input type="number" name="surcharge" value={formData.surcharge} onChange={handleChange} className="input-field text-right font-mono" step="0.01" /></div>
                
                {/* READ ONLY TOTAL PROD COST */}
                <div className="bg-slate-50 p-3 rounded border border-slate-200">
                  <label className="label">Total Product Cost</label>
                  <div className="text-xl font-mono text-slate-700">£{totalProdCost.toFixed(2)}</div>
                  <div className="text-xs text-slate-400 mt-1">Calculated from supplier list →</div>
                </div>

                {/* PROFIT DISPLAY */}
                <div className="bg-green-50 p-3 rounded border border-green-200 text-right">
                   <label className="label text-green-700">Net Profit</label>
                   <div className="text-2xl font-bold text-green-700 font-mono">£{profit.toFixed(2)}</div>
                </div>
              </div>

              {/* RIGHT COLUMN: SUPPLIER COST BREAKDOWN */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Supplier Breakdown</h4>
                
                {/* Add New Item Row */}
                <div className="flex gap-2 mb-4">
                  <select value={newCost.supplier} onChange={(e) => setNewCost({...newCost, supplier: e.target.value})} className="input-field text-xs">
                    <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="TRIVAGO">TRIVAGO</option><option value="OTHER">OTHER</option>
                  </select>
                  <select value={newCost.category} onChange={(e) => setNewCost({...newCost, category: e.target.value})} className="input-field text-xs">
                    <option value="FLIGHT">FLIGHT</option><option value="HOTEL">HOTEL</option><option value="CRUISE">CRUISE</option><option value="OTHER">OTHER</option>
                  </select>
                  <input type="number" value={newCost.amount} onChange={(e) => setNewCost({...newCost, amount: e.target.value})} className="input-field text-xs w-24" placeholder="£" />
                  <Button onClick={addCostItem} className="text-xs px-3">+</Button>
                </div>

                {/* List of Added Items */}
                <div className="space-y-2">
                  {(formData.supplierCosts || []).map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2 rounded border shadow-sm">
                      <div className="flex gap-2 text-xs font-bold text-slate-600">
                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{item.supplier}</span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">{item.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm">£{item.amount.toFixed(2)}</span>
                        <button type="button" onClick={() => removeCostItem(idx)} className="text-red-400 hover:text-red-600 font-bold px-1">×</button>
                      </div>
                    </div>
                  ))}
                  {(!formData.supplierCosts || formData.supplierCosts.length === 0) && (
                    <div className="text-center text-xs text-slate-400 italic py-2">No costs added yet</div>
                  )}
                </div>
              </div>

            </div>

             {/* DEPOSIT SECTION */}
             <div className="border-t p-6 bg-slate-50">
                <div className="flex justify-between mb-2"><h4 className="font-bold text-sm text-slate-700">Initial Payment / Deposit</h4></div>
                <div className="grid grid-cols-3 gap-4">
                  <input type="number" value={formData.initialPayments?.[0]?.amount} onChange={(e) => handlePaymentChange(0, 'amount', e.target.value)} className="input-field" placeholder="Amount" />
                  <select value={formData.initialPayments?.[0]?.transactionMethod} onChange={(e) => handlePaymentChange(0, 'transactionMethod', e.target.value)} className="input-field">
                    <option value="CASH">Cash</option><option value="BANK">Bank</option><option value="CARD">Card</option>
                  </select>
                  <input type="date" value={formData.initialPayments?.[0]?.paymentDate} onChange={(e) => handlePaymentChange(0, 'paymentDate', e.target.value)} className="input-field" />
                </div>
             </div>
          </div>

          {/* 5. INSTALMENTS (Only for INTERNAL) */}
          {formData.paymentMethod === 'INTERNAL' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-fade-in">
              <div className="bg-slate-100 px-6 py-3 border-b border-slate-200 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Payment Plan</h3>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-bold ${Math.abs(balance - instTotal) < 0.05 ? 'text-green-600' : 'text-red-600'}`}>
                    Remaining to Allocate: £{(balance - instTotal).toFixed(2)}
                  </span>
                  <button type="button" onClick={distributeBalance} className="text-xs text-blue-600 hover:underline font-semibold">Distribute Auto</button>
                  <Button onClick={addInstalment} variant="secondary" className="text-xs py-1 px-3">+ Add Row</Button>
                </div>
              </div>
              <div className="p-6 space-y-3">
                {(formData.instalments || []).map((inst, idx) => (
                  <div key={idx} className="flex gap-4 items-center">
                    <span className="text-xs font-bold text-slate-400 w-6">#{idx+1}</span>
                    <input type="date" value={inst.dueDate} onChange={(e) => handleInstalmentChange(idx, 'dueDate', e.target.value)} className="input-field" />
                    <input type="number" value={inst.amount} onChange={(e) => handleInstalmentChange(idx, 'amount', e.target.value)} className="input-field text-right" placeholder="Amount" />
                    <button type="button" onClick={() => removeInstalment(idx)} className="text-red-500 hover:text-red-700 px-2 font-bold text-xl">×</button>
                  </div>
                ))}
                {(!formData.instalments || formData.instalments.length === 0) && (
                  <div className="text-center text-slate-400 italic py-4">No instalments added yet. Add a row to cover the balance.</div>
                )}
              </div>
            </div>
          )}

          {/* STICKY FOOTER ACTION BAR */}
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 flex justify-end gap-4">
            <div className="max-w-7xl mx-auto w-full flex justify-end gap-4 px-4">
              {editModeId && (
                <Button onClick={handleCancelEdit} variant="secondary">
                  Cancel Edit
                </Button>
              )}
              <Button type="submit" className="px-8 py-2 text-lg shadow-lg" disabled={loading}>
                {loading ? 'Processing...' : (editModeId ? 'Update Booking' : 'Create Booking')}
              </Button>
            </div>
          </div>
          
        </form>

        {/* --- LIST VIEW --- */}
        <div className="mt-16 mb-20">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Pending Bookings List</h2>
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-slate-200">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Ref / PNR</th>
                  <th className="px-6 py-4">Passenger</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
                  <th className="px-6 py-4 text-right">Cost</th>
                  <th className="px-6 py-4 text-right">Profit</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">{formatDate(b.createdAt)}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <div className="font-bold text-slate-800">{b.refNo}</div>
                      <div className="text-slate-500">{b.pnr}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{b.paxName}</div>
                      <div className="text-xs text-slate-500">{b.numPax} Pax</div>
                    </td>
                    <td className="px-6 py-4">
                       <span className={`text-xs px-2 py-1 rounded-full ${b.paymentMethod === 'INTERNAL' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                         {b.paymentMethod}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono">{b.revenue?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">{b.prodCost?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-green-600">{b.profit?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center flex justify-center gap-2">
  {/* Edit Button */}
  <button 
    onClick={() => handleEdit(b)} 
    className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    EDIT
  </button>
  
  {/* Approve Button */}
  <button 
    onClick={async () => {
      if(!window.confirm("Approve this booking? It will move to live records.")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.post(`http://localhost:5000/api/bookings/${b.id}/approve`, {}, {
           headers: { Authorization: `Bearer ${token}` }
        });
        alert("Booking Approved!");
        fetchBookings(); // Refresh list to see it vanish
      } catch(alert) { alert("Error approving"); }
    }}
    className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    APPROVE
  </button>

  {/* Reject Button */}
  <button 
    onClick={async () => {
      if(!window.confirm("Reject and Delete permanently?")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/bookings/${b.id}/reject`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        fetchBookings(); // Refresh list
      } catch(alert) { alert("Error rejecting"); }
    }}
    className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    REJECT
  </button>
</td><td className="px-6 py-4 text-center flex justify-center gap-2">
  {/* Edit Button */}
  <button 
    onClick={() => handleEdit(b)} 
    className="text-blue-600 hover:bg-blue-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    EDIT
  </button>
  
  {/* Approve Button */}
  <button 
    onClick={async () => {
      if(!window.confirm("Approve this booking? It will move to live records.")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.post(`http://localhost:5000/api/bookings/${b.id}/approve`, {}, {
           headers: { Authorization: `Bearer ${token}` }
        });
        alert("Booking Approved!");
        fetchBookings(); // Refresh list to see it vanish
      } catch(alert) { alert("Error approving"); }
    }}
    className="text-green-600 hover:bg-green-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    APPROVE
  </button>

  {/* Reject Button */}
  <button 
    onClick={async () => {
      if(!window.confirm("Reject and Delete permanently?")) return;
      try {
        const token = localStorage.getItem('token');
        await axios.delete(`http://localhost:5000/api/bookings/${b.id}/reject`, {
           headers: { Authorization: `Bearer ${token}` }
        });
        fetchBookings(); // Refresh list
      } catch(alert) { alert("Error rejecting"); }
    }}
    className="text-red-600 hover:bg-red-50 px-2 py-1 rounded text-xs font-bold transition"
  >
    REJECT
  </button>
</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 0.25rem; text-transform: uppercase; }
        .input-field { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; transition: border-color 0.15s; outline: none; }
        .input-field:focus { border-color: #3b82f6; ring: 1px solid #3b82f6; }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}