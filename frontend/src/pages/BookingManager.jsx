import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import Button from '../components/Button';

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
};

const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

export default function BookingManager() {
  const [bookings, setBookings] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModeId, setEditModeId] = useState(null);

  // --- INITIAL STATE ---
  const initialFormState = {
    paymentMethod: 'FULL',
    refNo: '', agentName: '', teamName: 'PH', 
    pnr: '', airline: '', fromTo: '', bookingType: 'FRESH',
    pcDate: formatDate(new Date()), travelDate: '', returnDate: '', description: '',
    revenue: 0, transFee: 0, surcharge: 0,
    supplierCosts: [], 
    numPax: 1,
    paxName: '', 
    passengers: [{ 
      title: 'MR', firstName: '', middleName: '', lastName: '', 
      gender: 'MALE', category: 'ADULT', birthday: '', 
      email: '', contactNo: '', nationality: '' 
    }],
    initialPayments: [{ amount: 0, transactionMethod: 'CASH', paymentDate: formatDate(new Date()), creditNoteId: null, _search: '', _wallet: null }],
    instalments: []
  };

  const [formData, setFormData] = useState(initialFormState);
  const [newCost, setNewCost] = useState({ supplier: 'BTRES', category: 'FLIGHT', amount: '' });

  useEffect(() => { 
    fetchBookings(); 
    fetchConsultants();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/bookings', { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success && Array.isArray(res.data.data)) setBookings(res.data.data);
    } catch (err) { console.error(err); }
  };

  const fetchConsultants = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/users', { headers: { Authorization: `Bearer ${token}` } });
      if (res.data.success) {
        const agents = res.data.data.filter(u => ['CONSULTANT', 'MANAGEMENT', 'ADMIN', 'SUPER_ADMIN'].includes(u.role));
        setConsultants(agents);
        if (agents.length > 0 && !formData.agentName) {
            setFormData(prev => ({...prev, agentName: `${agents[0].firstName} ${agents[0].lastName}`, teamName: agents[0].team || 'PH'}));
        }
      }
    } catch (err) { console.error("Failed to fetch users", err); }
  };

  const calculateFinancials = () => {
    const rev = parseFloat(formData.revenue || 0);
    const fee = parseFloat(formData.transFee || 0);
    const sur = parseFloat(formData.surcharge || 0);
    const totalProdCost = (formData.supplierCosts || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    const profit = rev - (totalProdCost + sur + fee);
    const paid = (formData.initialPayments || []).reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const balance = rev - paid;
    const instTotal = (formData.instalments || []).reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    return { profit, balance, instTotal, totalProdCost };
  };

  const { profit, balance, instTotal, totalProdCost } = calculateFinancials();

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

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
    
    // If they change away from PAX_CREDIT, clear the wallet data for this specific row
    if (field === 'transactionMethod' && value !== 'PAX_CREDIT') {
        newPayments[index].creditNoteId = null;
        newPayments[index]._wallet = null;
        newPayments[index]._search = '';
    }

    let newRevenue = formData.revenue;
    if (formData.paymentMethod === 'FULL' && index === 0 && field === 'amount') {
        newRevenue = value;
    }
    setFormData({ ...formData, initialPayments: newPayments, revenue: newRevenue });
  };

  const addCostItem = () => {
    if (!newCost.amount || parseFloat(newCost.amount) <= 0) return;
    setFormData({ ...formData, supplierCosts: [...(formData.supplierCosts || []), { ...newCost, amount: parseFloat(newCost.amount) }] });
    setNewCost({ supplier: 'BTRES', category: 'FLIGHT', amount: '' }); 
  };
  const removeCostItem = (index) => {
    const newCosts = (formData.supplierCosts || []).filter((_, i) => i !== index);
    setFormData({ ...formData, supplierCosts: newCosts });
  };
  const addInstalment = () => setFormData({ ...formData, instalments: [...(formData.instalments || []), { dueDate: '', amount: 0, status: 'PENDING' }] });
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

  const handleEdit = (booking) => {
    setEditModeId(booking.id);
    setFormData({
      ...booking,
      pcDate: formatDate(booking.pcDate),
      travelDate: formatDate(booking.travelDate),
      returnDate: formatDate(booking.returnDate),
      supplierCosts: booking.supplierCosts || [],
      passengers: booking.passengers && booking.passengers.length > 0 ? [{ ...booking.passengers[0], birthday: formatDate(booking.passengers[0].birthday) }] : initialFormState.passengers,
      initialPayments: booking.pendingInitialPayments && booking.pendingInitialPayments.length > 0 
        ? booking.pendingInitialPayments.map(p => ({...p, paymentDate: formatDate(p.paymentDate), creditNoteId: p.paxCreditNoteId || null, _search: '', _wallet: null}))
        : initialFormState.initialPayments,
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

    if (formData.paymentMethod === 'INTERNAL') {
      if (Math.abs(balance - instTotal) > 0.05) { 
        alert(`STRICT MATH ERROR:\n\nBalance Remaining: £${balance.toFixed(2)}\nInstalments Total: £${instTotal.toFixed(2)}\n\nPlease ensure instalments match the balance exactly.`);
        setLoading(false);
        return;
      }
    }

    if (formData.returnDate && formData.instalments.length > 0) {
        const returnD = new Date(formData.returnDate).getTime();
        const lastInstD = Math.max(...formData.instalments.map(i => new Date(i.dueDate).getTime()));
        if (lastInstD >= returnD) {
          alert("DATE ERROR:\n\nThe last instalment due date MUST be strictly BEFORE the Return Date.");
          setLoading(false);
          return;
        }
    }

    // Safety check for Wallets across ALL deposits
    for (const ip of formData.initialPayments) {
        if (ip.transactionMethod === 'PAX_CREDIT') {
            const requestedAmt = parseFloat(ip.amount || 0);
            if (!ip._wallet || requestedAmt > ip._wallet.remainingAmount) {
                alert(`WALLET ERROR: Invalid wallet selected or insufficient funds for the £${requestedAmt} deposit.`);
                setLoading(false);
                return;
            }
        }
    }

    const token = localStorage.getItem('token');
    const paxName = formData.paxName || `${formData.passengers?.[0]?.lastName}/${formData.passengers?.[0]?.firstName}`;
    const payload = { ...formData, paxName, prodCost: totalProdCost };

    try {
      const url = editModeId ? `http://localhost:5000/api/bookings/${editModeId}` : 'http://localhost:5000/api/bookings';
      const method = editModeId ? axios.put : axios.post;
      await method(url, payload, { headers: { Authorization: `Bearer ${token}` } });
      
      alert(editModeId ? 'Booking Updated Successfully' : 'Booking Created Successfully');
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
    <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 pb-32 font-sans text-slate-600">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-12">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">
              {editModeId ? `Editing Booking #${editModeId}` : 'New Booking Entry'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">Create Folders or manage Folders.</p>
          </div>
          {editModeId && (
            <button onClick={handleCancelEdit} className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 px-4 py-2 rounded-lg border border-red-100 transition-colors">
              Cancel Edit Mode
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* 1. PAYMENT METHOD TOGGLE (Segmented Control) */}
          <div className="flex justify-center p-1.5 rounded-2xl bg-white/60 backdrop-blur-md border border-white/40 shadow-lg shadow-blue-900/5 w-full max-w-md mx-auto relative overflow-hidden">
            <button
              type="button"
              onClick={() => {
                  const currentDeposit = formData.initialPayments?.[0]?.amount || 0;
                  setFormData({ ...formData, paymentMethod: 'FULL', instalments: [], revenue: currentDeposit })
              }}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative z-10 ${formData.paymentMethod === 'FULL' ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Full Payment
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, paymentMethod: 'INTERNAL'})}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 relative z-10 ${formData.paymentMethod === 'INTERNAL' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Internal (Instalments)
            </button>
          </div>

          {/* 2. GLASS CARD: CORE INFO */}
          <div className="glass-card animate-fade-in">
            <div className="section-header">
              <span className="text-xl">✈️</span> Flight & Booking Details
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="col-span-1 md:col-span-1"><label className="label">Ref No</label><input name="refNo" value={formData.refNo} onChange={handleChange} className="input-modern" required placeholder="BKG-001"/></div>
              <div className="col-span-1 md:col-span-1"><label className="label">PNR</label><input name="pnr" value={formData.pnr} onChange={handleChange} className="input-modern font-mono uppercase tracking-widest text-blue-600 font-bold" required /></div>
              <div className="col-span-1 md:col-span-2"><label className="label">Airline</label><input name="airline" value={formData.airline} onChange={handleChange} className="input-modern" required /></div>
              <div className="col-span-1 md:col-span-1"><label className="label">Route</label><input name="fromTo" value={formData.fromTo} onChange={handleChange} className="input-modern" placeholder="CMB-DXB" required /></div>
              
              <div className="col-span-1 md:col-span-1">
                <label className="label">Agent Name</label>
                <select name="agentName" value={formData.agentName} onChange={(e) => {
                    const selectedAgent = consultants.find(c => `${c.firstName} ${c.lastName}` === e.target.value);
                    setFormData({ ...formData, agentName: e.target.value, teamName: selectedAgent ? selectedAgent.team : formData.teamName });
                  }} 
                  className="input-modern" required
                >
                  <option value="" disabled>Select Consultant...</option>
                  {consultants.map(c => ( <option key={c.id} value={`${c.firstName} ${c.lastName}`}>{c.firstName} {c.lastName} ({c.team || 'No Team'})</option> ))}
                </select>
              </div>

              <div className="col-span-1 md:col-span-1"><label className="label">PC Date</label><input type="date" name="pcDate" value={formData.pcDate} onChange={handleChange} className="input-modern" required /></div>
              <div className="col-span-1 md:col-span-1"><label className="label">Travel Date</label><input type="date" name="travelDate" value={formData.travelDate} onChange={handleChange} className="input-modern" required /></div>
              <div className="col-span-1 md:col-span-1"><label className="label text-blue-500">Return Date</label><input type="date" name="returnDate" value={formData.returnDate} onChange={handleChange} className="input-modern" /></div>
              
              {editModeId && (
                <div className="col-span-1 md:col-span-5 border-t border-slate-100 pt-4 mt-2">
                  <label className="label text-rose-500">Edit Booking Type (Warning: Only change if error)</label>
                  <div className="flex gap-4">
                    {['FRESH', 'DATE_CHANGE', 'CANCELLATION'].map(type => (
                      <label key={type} className={`cursor-pointer border rounded-lg px-4 py-2 text-xs font-bold transition-all ${formData.bookingType === type ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-200' : 'bg-transparent border-slate-200 text-slate-400'}`}>
                        <input type="radio" name="bookingType" value={type} checked={formData.bookingType === type} onChange={handleChange} className="hidden" />
                        {type.replace('_', ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. GLASS CARD: PASSENGER */}
          <div className="glass-card animate-fade-in" style={{animationDelay: '0.1s'}}>
            <div className="section-header flex justify-between items-center">
              <div className="flex items-center gap-2"><span className="text-xl">👤</span> Lead Passenger</div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
              
              <div className="md:col-span-12 mb-2 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100 flex items-center justify-between shadow-sm">
                <div>
                  <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide">Total Passengers</h4>
                  <p className="text-xs text-blue-400 font-medium">Include adults & children</p>
                </div>
                <div className="flex items-center gap-3 bg-white rounded-lg p-1 shadow-sm border border-blue-100">
                  <button type="button" onClick={() => handleChange({ target: { name: 'numPax', value: Math.max(1, parseInt(formData.numPax || 1) - 1) } })} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-bold text-xl">-</button>
                  <input type="number" name="numPax" value={formData.numPax} onChange={handleChange} className="w-12 text-center text-xl font-bold text-slate-700 outline-none bg-transparent" min="1" max="50" />
                  <button type="button" onClick={() => handleChange({ target: { name: 'numPax', value: parseInt(formData.numPax || 1) + 1 } })} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors font-bold text-xl">+</button>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="label">Title</label>
                <select value={formData.passengers?.[0]?.title} onChange={(e) => handlePaxChange('title', e.target.value)} className="input-modern">
                  <option value="MR">Mr</option><option value="MRS">Mrs</option><option value="MS">Ms</option><option value="MASTER">Master</option>
                </select>
              </div>
              <div className="md:col-span-5"><label className="label">First Name</label><input value={formData.passengers?.[0]?.firstName} onChange={(e) => handlePaxChange('firstName', e.target.value)} className="input-modern" required /></div>
              <div className="md:col-span-5"><label className="label">Last Name</label><input value={formData.passengers?.[0]?.lastName} onChange={(e) => handlePaxChange('lastName', e.target.value)} className="input-modern" required /></div>
              
              <div className="md:col-span-3">
                <label className="label">Gender</label>
                <select value={formData.passengers?.[0]?.gender} onChange={(e) => handlePaxChange('gender', e.target.value)} className="input-modern">
                  <option value="MALE">Male</option><option value="FEMALE">Female</option>
                </select>
              </div>
              <div className="md:col-span-3"><label className="label">DOB</label><input type="date" value={formData.passengers?.[0]?.birthday} onChange={(e) => handlePaxChange('birthday', e.target.value)} className="input-modern" /></div>
              <div className="md:col-span-3"><label className="label">Email</label><input type="email" value={formData.passengers?.[0]?.email} onChange={(e) => handlePaxChange('email', e.target.value)} className="input-modern" /></div>
              <div className="md:col-span-3"><label className="label">Contact No</label><input value={formData.passengers?.[0]?.contactNo} onChange={(e) => handlePaxChange('contactNo', e.target.value)} className="input-modern" /></div>
            </div>
          </div>

          {/* 4. GLASS CARD: FINANCIALS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT: REVENUE & PROFIT */}
            <div className="lg:col-span-5 space-y-4">
              <div className="glass-card h-full p-6 flex flex-col justify-between">
                <div>
                   <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Revenue & Fees</h3>
                   <div className="space-y-4">
                     <div>
                       <label className="label">Client Revenue (£)</label>
                       <input 
                         type="number" name="revenue" value={formData.revenue} onChange={handleChange} step="0.01" 
                         className={`input-modern text-right font-mono text-lg font-bold ${formData.paymentMethod === 'FULL' ? 'bg-slate-100/50 text-slate-400' : 'text-slate-800'}`}
                         readOnly={formData.paymentMethod === 'FULL'}
                       />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                       <div><label className="label">Trans Fee (£)</label><input type="number" name="transFee" value={formData.transFee} onChange={handleChange} className="input-modern text-right font-mono" step="0.01" /></div>
                       <div><label className="label">Surcharge (£)</label><input type="number" name="surcharge" value={formData.surcharge} onChange={handleChange} className="input-modern text-right font-mono" step="0.01" /></div>
                     </div>
                   </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200/60">
                   <div className="flex justify-between items-end mb-2">
                     <span className="text-xs font-bold text-slate-400 uppercase">Product Cost</span>
                     <span className="font-mono text-slate-600">£{totalProdCost.toFixed(2)}</span>
                   </div>
                   <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-4 border border-emerald-100 flex justify-between items-center shadow-sm">
                      <span className="text-emerald-800 font-bold text-sm uppercase tracking-wider">Net Profit</span>
                      <span className="text-3xl font-bold text-emerald-600 font-mono tracking-tight">£{profit.toFixed(2)}</span>
                   </div>
                </div>
              </div>
            </div>

            {/* RIGHT: SUPPLIER BREAKDOWN */}
            <div className="lg:col-span-7">
               <div className="glass-card h-full p-6">
                 <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Supplier Cost Breakdown</h3>
                 
                 {/* Mini Form */}
                 <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/60 flex flex-wrap gap-2 mb-4 items-end">
                    <div className="flex-1 min-w-[100px]">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Supplier</label>
                      <select value={newCost.supplier} onChange={(e) => setNewCost({...newCost, supplier: e.target.value})} className="input-modern text-xs py-2">
                        <option value="BTRES">BTRES</option><option value="LYCA">LYCA</option><option value="TRIVAGO">TRIVAGO</option><option value="OTHER">OTHER</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Type</label>
                      <select value={newCost.category} onChange={(e) => setNewCost({...newCost, category: e.target.value})} className="input-modern text-xs py-2">
                        <option value="FLIGHT">FLIGHT</option><option value="HOTEL">HOTEL</option><option value="CRUISE">CRUISE</option><option value="OTHER">OTHER</option>
                      </select>
                    </div>
                    <div className="w-24">
                      <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Cost (£)</label>
                      <input type="number" value={newCost.amount} onChange={(e) => setNewCost({...newCost, amount: e.target.value})} className="input-modern text-xs py-2 font-mono" placeholder="0.00" />
                    </div>
                    <Button onClick={addCostItem} className="h-[38px] px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold">+</Button>
                 </div>

                 {/* List */}
                 <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                   {(formData.supplierCosts || []).map((item, idx) => (
                     <div key={idx} className="flex justify-between items-center bg-white/60 p-3 rounded-lg border border-white/60 shadow-sm hover:shadow-md transition-all group">
                       <div className="flex items-center gap-3">
                         <div className="h-8 w-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold border border-blue-100">
                           {item.supplier.charAt(0)}
                         </div>
                         <div>
                           <div className="text-xs font-bold text-slate-700">{item.supplier}</div>
                           <div className="text-[10px] font-bold text-slate-400 uppercase bg-slate-100 px-1.5 py-0.5 rounded w-fit">{item.category}</div>
                         </div>
                       </div>
                       <div className="flex items-center gap-4">
                         <span className="font-mono text-sm font-bold text-slate-600">£{item.amount.toFixed(2)}</span>
                         <button type="button" onClick={() => removeCostItem(idx)} className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 font-bold px-2">×</button>
                       </div>
                     </div>
                   ))}
                   {(!formData.supplierCosts || formData.supplierCosts.length === 0) && (
                     <div className="text-center py-8 text-slate-300 border-2 border-dashed border-slate-100 rounded-xl">
                       No costs added yet
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>

          {/* 5. DEPOSITS & INSTALMENTS */}
          <div className="glass-card animate-fade-in" style={{animationDelay: '0.2s'}}>
             <div className="section-header">💰 Payment Schedule</div>
             <div className="p-8">
                
                {/* DEPOSIT ROWS */}
                <div className="mb-6">
                   <div className="flex justify-between items-center mb-3">
                       <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-green-400"></span> Initial Deposits
                       </h4>
                       <Button 
                         type="button" 
                         onClick={() => {
                           setFormData({
                             ...formData, 
                             initialPayments: [...formData.initialPayments, { amount: 0, transactionMethod: 'CASH', paymentDate: formatDate(new Date()), creditNoteId: null, _search: '', _wallet: null }]
                           });
                         }} 
                         className="text-[10px] py-1 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
                       >+ Add Deposit</Button>
                   </div>
                   
                   <div className="space-y-4">
                     {formData.initialPayments.map((ip, idx) => (
                         <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 relative">
                           {idx > 0 && <button type="button" onClick={() => {
                               const newIPs = formData.initialPayments.filter((_, i) => i !== idx);
                               setFormData({...formData, initialPayments: newIPs});
                           }} className="absolute top-2 right-2 text-slate-400 hover:text-red-500 font-bold">×</button>}
                           
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div>
                               <label className="label">Method</label>
                               <select value={ip.transactionMethod} onChange={(e) => handlePaymentChange(idx, 'transactionMethod', e.target.value)} className="input-modern">
                                <option value="CASH">Cash</option><option value="BANK">Bank Transfer</option><option value="CARD">Card</option>
                                <option value="PAX_CREDIT">Use Pax Credit Note</option>
                               </select>
                             </div>

                             <div>
                               <label className="label">Amount</label>
                               <input 
                                 type="number" 
                                 value={ip.amount} 
                                 onChange={(e) => handlePaymentChange(idx, 'amount', e.target.value)} 
                                 className="input-modern font-mono font-bold text-green-700" 
                                 max={ip._wallet ? ip._wallet.remainingAmount : undefined}
                                 placeholder="0.00" 
                               />
                             </div>
                             
                             <div>
                               <label className="label">Date Received</label>
                               <input type="date" value={ip.paymentDate} onChange={(e) => handlePaymentChange(idx, 'paymentDate', e.target.value)} className="input-modern" />
                             </div>
                           </div>

                           {/* SHOW WALLET SEARCH PER ROW IF SELECTED */}
                           {ip.transactionMethod === 'PAX_CREDIT' && (
                              <div className="mt-4 bg-blue-50 p-4 rounded-xl border border-blue-100 animate-fade-in">
                                 <label className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-2">Search Cancelled Folder No.</label>
                                 <div className="flex gap-2">
                                    <input 
                                       type="text" 
                                       placeholder="e.g. 1.c" 
                                       className="w-full border border-blue-200 p-2 rounded-lg text-sm font-mono uppercase focus:ring-2 focus:ring-blue-400 outline-none bg-white" 
                                       value={ip._search || ''} 
                                       onChange={e => {
                                           const newIPs = [...formData.initialPayments];
                                           newIPs[idx]._search = e.target.value;
                                           setFormData({...formData, initialPayments: newIPs});
                                       }} 
                                    />
                                    <button 
                                       type="button" 
                                       onClick={async () => {
                                            try {
                                              const token = localStorage.getItem('token');
                                              const res = await axios.get(`http://localhost:5000/api/bookings/credits/pax/search?folder=${ip._search}`, { headers: { Authorization: `Bearer ${token}` } });
                                              const newIPs = [...formData.initialPayments];
                                              if (res.data.success) {
                                                  newIPs[idx]._wallet = res.data.data;
                                                  newIPs[idx].creditNoteId = res.data.data.id;
                                              } else {
                                                  newIPs[idx]._wallet = null;
                                                  newIPs[idx].creditNoteId = null;
                                                  alert(res.data.message);
                                              }
                                              setFormData({...formData, initialPayments: newIPs});
                                            } catch(alert) { alert("Not found"); }
                                       }} 
                                       className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-md hover:bg-blue-700 transition-colors"
                                    >Search</button>
                                 </div>
                                 {ip._wallet && (
                                    <div className="mt-3 bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center text-xs shadow-sm">
                                      <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Available Credit:</span>
                                      <span className="font-mono text-emerald-600 font-bold text-base">{formatMoney(ip._wallet.remainingAmount)}</span>
                                    </div>
                                 )}
                              </div>
                           )}
                         </div>
                     ))}
                   </div>
                </div>

                {/* INSTALMENTS (Conditional) */}
                {formData.paymentMethod === 'INTERNAL' && (
                  <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4 border-t border-slate-100 pt-6">
                       <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Instalment Plan
                       </h4>
                       <div className="flex items-center gap-3">
                         <span className={`text-xs font-bold px-3 py-1 rounded-full border ${Math.abs(balance - instTotal) < 0.05 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                           Remaining: £{(balance - instTotal).toFixed(2)}
                         </span>
                         <button type="button" onClick={distributeBalance} className="text-[10px] font-bold text-blue-500 hover:text-blue-700 uppercase tracking-wide">Auto-Distribute</button>
                         <Button onClick={addInstalment} className="text-xs py-1 px-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm">+ Row</Button>
                       </div>
                    </div>

                    <div className="space-y-2">
                      {(formData.instalments || []).map((inst, idx) => (
                        <div key={idx} className="flex gap-4 items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                          <span className="text-[10px] font-bold text-slate-300 w-6 text-center">#{idx+1}</span>
                          <input type="date" value={inst.dueDate} onChange={(e) => handleInstalmentChange(idx, 'dueDate', e.target.value)} className="input-modern py-1.5 text-xs" />
                          <input type="number" value={inst.amount} onChange={(e) => handleInstalmentChange(idx, 'amount', e.target.value)} className="input-modern py-1.5 text-xs text-right font-mono" placeholder="0.00" />
                          <button type="button" onClick={() => removeInstalment(idx)} className="text-slate-300 hover:text-red-500 px-2 text-lg">×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
             </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="fixed bottom-0 left-0 right-0 z-50">
            <div className="h-1 w-full bg-gradient-to-r from-transparent via-blue-400/50 to-transparent"></div>
            <div className="bg-white/90 backdrop-blur-xl border-t border-white/60 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] px-6 py-4">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="hidden sm:flex items-center gap-6">
                   <div>
                      <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Revenue</span>
                      <span className="font-mono font-bold text-slate-700">£{parseFloat(formData.revenue || 0).toFixed(2)}</span>
                   </div>
                   <div className="h-8 w-px bg-slate-200"></div>
                   <div>
                      <span className="block text-[10px] uppercase font-bold text-emerald-600 tracking-wider">Est. Profit</span>
                      <span className="font-mono font-bold text-emerald-600 text-lg">£{profit.toFixed(2)}</span>
                   </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto justify-end">
                  {editModeId && (
                    <button type="button" onClick={handleCancelEdit} className="px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                      Cancel
                    </button>
                  )}
                  <button type="submit" disabled={loading} className="relative overflow-hidden group px-8 py-3 rounded-xl bg-slate-900 text-white shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2">
                    <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent z-10"></div>
                    <span className="font-bold text-sm relative z-20">{loading ? 'Processing...' : (editModeId ? 'Update Booking' : 'Create Booking')}</span>
                    {!loading && <svg className="w-4 h-4 relative z-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
        </form>

        {/* --- TABLE VIEW --- */}
        <div className="mt-24 mb-20">
          <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <span className="text-2xl">📂</span> Pending Approvals
          </h2>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="bg-slate-50/80 text-[10px] uppercase font-bold text-slate-500 tracking-wider border-b border-slate-200">
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
                  <tr key={b.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-6 py-4 text-slate-500 font-medium">{formatDate(b.createdAt)}</td>
                    <td className="px-6 py-4 font-mono text-xs">
                      <div className="font-bold text-slate-800">{b.refNo}</div>
                      <div className="text-blue-500">{b.pnr}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-700">{b.paxName}</div>
                      <div className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1">{b.numPax} Pax</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${b.paymentMethod === 'INTERNAL' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                          {b.paymentMethod}
                        </span>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">{b.revenue?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono text-slate-400">{b.prodCost?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600 bg-emerald-50/30">{b.profit?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(b)} className="text-blue-600 bg-blue-50 hover:bg-blue-100 p-1.5 rounded-md transition-colors" title="Edit">✏️</button>
                            <button onClick={async () => {
                                if(!window.confirm("Approve this booking? It will move to live records.")) return;
                                try {
                                  const token = localStorage.getItem('token');
                                  await axios.post(`http://localhost:5000/api/bookings/${b.id}/approve`, {}, { headers: { Authorization: `Bearer ${token}` } });
                                  alert("Booking Approved!");
                                  fetchBookings(); 
                                } catch(alert) { alert("Error approving"); }
                              }} className="text-emerald-600 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-md transition-colors" title="Approve">✅</button>
                            <button onClick={async () => {
                                if(!window.confirm("Reject and Delete permanently?")) return;
                                try {
                                  const token = localStorage.getItem('token');
                                  await axios.delete(`http://localhost:5000/api/bookings/${b.id}/reject`, { headers: { Authorization: `Bearer ${token}` } });
                                  fetchBookings(); 
                                } catch(alert) { alert("Error rejecting"); }
                              }} className="text-red-500 bg-red-50 hover:bg-red-100 p-1.5 rounded-md transition-colors" title="Reject">🗑️</button>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {bookings.length === 0 && (
                <div className="p-12 text-center text-slate-400 font-medium bg-slate-50/50">
                    No pending bookings found.
                </div>
            )}
          </div>
        </div>

      </div>

      <style>{`
        .glass-card { background: rgba(255, 255, 255, 0.7); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 4px 20px -5px rgba(0, 0, 0, 0.05); border-radius: 1rem; overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .section-header { background: rgba(248, 250, 252, 0.6); padding: 1rem 2rem; border-bottom: 1px solid rgba(226, 232, 240, 0.6); font-weight: 700; color: #475569; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
        .label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-modern { width: 100%; background: rgba(255, 255, 255, 0.6); border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.6rem 0.8rem; font-size: 0.875rem; color: #334155; transition: all 0.2s; outline: none; }
        .input-modern:focus { background: #ffffff; border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1); }
        .input-modern:read-only { background: #f1f5f9; color: #94a3b8; cursor: not-allowed; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; opacity: 0; transform: translateY(10px); }
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 2px; }
        @keyframes shimmer { 100% { transform: translateX(100%); } }
      `}</style>
    </div>
  );
}