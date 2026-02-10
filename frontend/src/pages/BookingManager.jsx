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
  const [editModeId, setEditModeId] = useState(null); // Track if we are editing

  // INITIAL STATE
  const initialFormState = {
    // Flight & Booking Info
    refNo: '', agentName: '', teamName: 'PH', 
    pnr: '', airline: '', fromTo: '', bookingType: 'FRESH',
    pcDate: formatDate(new Date()), travelDate: '',
    paymentMethod: 'FULL',
    
    // Financials
    revenue: 0, prodCost: 0, transFee: 0, surcharge: 0,
    
    // Passenger Details (Integrated directly here)
    numPax: 1,
    passengers: [{ 
      title: 'MR', firstName: '', middleName: '', lastName: '', 
      gender: 'MALE', category: 'ADULT', birthday: '', 
      email: '', contactNo: '', nationality: '' 
    }],
    
    // Initial Payment
    initialPayments: [{ amount: 0, transactionMethod: 'CASH', paymentDate: formatDate(new Date()) }]
  };

  const [formData, setFormData] = useState(initialFormState);

  // --- API CALLS ---
  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/bookings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setBookings(res.data.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchBookings(); }, []);

  // --- HANDLERS ---
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handler for nested Passenger fields
  const handlePaxChange = (field, value) => {
    const updatedPax = [...formData.passengers];
    updatedPax[0][field] = value;
    setFormData({ ...formData, passengers: updatedPax });
  };

  // Handler for Edit Button
  const handleEdit = (booking) => {
    setEditModeId(booking.id);
    
    // Populate form with existing data
    setFormData({
      ...booking,
      pcDate: formatDate(booking.pcDate),
      travelDate: formatDate(booking.travelDate),
      // Ensure we have at least one passenger object to edit
      passengers: booking.passengers.length > 0 ? [{
        ...booking.passengers[0],
        birthday: formatDate(booking.passengers[0].birthday)
      }] : initialFormState.passengers,
      // Keep payments as is (simplified for edit)
      initialPayments: initialFormState.initialPayments 
    });
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditModeId(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const token = localStorage.getItem('token');
    
    // Auto-generate PaxName for the booking record
    const paxName = `${formData.passengers[0].lastName}/${formData.passengers[0].firstName}`;
    const payload = { ...formData, paxName };

    try {
      if (editModeId) {
        // UPDATE MODE
        await axios.put(`http://localhost:5000/api/bookings/${editModeId}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Booking Updated Successfully');
      } else {
        // CREATE MODE
        await axios.post('http://localhost:5000/api/bookings', payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('Booking Created Successfully');
      }
      
      handleCancelEdit(); // Reset form
      fetchBookings(); // Refresh list
    } catch (err) {
      alert('Operation failed. Check console.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
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
          
          {/* CARD 1: FLIGHT & BOOKING DETAILS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Flight & Booking Details</h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="label">Ref No</label>
                <input name="refNo" value={formData.refNo} onChange={handleChange} className="input-field" required placeholder="BKG-001"/>
              </div>
              <div>
                <label className="label">PNR</label>
                <input name="pnr" value={formData.pnr} onChange={handleChange} className="input-field font-mono uppercase" required />
              </div>
              <div>
                <label className="label">Airline</label>
                <input name="airline" value={formData.airline} onChange={handleChange} className="input-field" required />
              </div>
              <div>
                <label className="label">Route (From/To)</label>
                <input name="fromTo" value={formData.fromTo} onChange={handleChange} className="input-field" placeholder="CMB-DXB" required />
              </div>
              <div>
                <label className="label">PC Date</label>
                <input type="date" name="pcDate" value={formData.pcDate} onChange={handleChange} className="input-field" required />
              </div>
              <div>
                <label className="label">Travel Date</label>
                <input type="date" name="travelDate" value={formData.travelDate} onChange={handleChange} className="input-field" />
              </div>
              <div>
                <label className="label">Booking Type</label>
                <select name="bookingType" value={formData.bookingType} onChange={handleChange} className="input-field">
                  <option value="FRESH">Fresh</option>
                  <option value="DATE_CHANGE">Date Change</option>
                  <option value="CANCELLATION">Cancellation</option>
                </select>
              </div>
              <div>
                <label className="label">Agent Name</label>
                <input name="agentName" value={formData.agentName} onChange={handleChange} className="input-field" />
              </div>
            </div>
          </div>

          {/* CARD 2: PASSENGER DETAILS (Integrated) */}
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
                <select value={formData.passengers[0].title} onChange={(e) => handlePaxChange('title', e.target.value)} className="input-field">
                  <option value="MR">Mr</option>
                  <option value="MRS">Mrs</option>
                  <option value="MS">Ms</option>
                  <option value="MASTER">Master</option>
                </select>
              </div>
              <div>
                <label className="label">First Name</label>
                <input value={formData.passengers[0].firstName} onChange={(e) => handlePaxChange('firstName', e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input value={formData.passengers[0].lastName} onChange={(e) => handlePaxChange('lastName', e.target.value)} className="input-field" required />
              </div>
              <div>
                <label className="label">Gender</label>
                <select value={formData.passengers[0].gender} onChange={(e) => handlePaxChange('gender', e.target.value)} className="input-field">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                </select>
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input type="date" value={formData.passengers[0].birthday} onChange={(e) => handlePaxChange('birthday', e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="label">Category</label>
                <select value={formData.passengers[0].category} onChange={(e) => handlePaxChange('category', e.target.value)} className="input-field">
                  <option value="ADULT">Adult</option>
                  <option value="CHILD">Child</option>
                  <option value="INFANT">Infant</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Email Address</label>
                <input type="email" value={formData.passengers[0].email} onChange={(e) => handlePaxChange('email', e.target.value)} className="input-field" />
              </div>
            </div>
          </div>

          {/* CARD 3: FINANCIALS */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
             <div className="bg-slate-100 px-6 py-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Financials</h3>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-5 gap-6">
              <div>
                <label className="label">Revenue</label>
                <input type="number" name="revenue" value={formData.revenue} onChange={handleChange} className="input-field text-right" step="0.01" />
              </div>
              <div>
                <label className="label">Prod Cost</label>
                <input type="number" name="prodCost" value={formData.prodCost} onChange={handleChange} className="input-field text-right" step="0.01" />
              </div>
              <div>
                <label className="label">Trans Fee</label>
                <input type="number" name="transFee" value={formData.transFee} onChange={handleChange} className="input-field text-right" step="0.01" />
              </div>
              <div>
                <label className="label">Surcharge</label>
                <input type="number" name="surcharge" value={formData.surcharge} onChange={handleChange} className="input-field text-right" step="0.01" />
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                 <label className="label text-green-700">Net Profit</label>
                 <div className="text-lg font-bold text-green-700 text-right">
                   {(parseFloat(formData.revenue || 0) + parseFloat(formData.surcharge || 0) - parseFloat(formData.prodCost || 0) - parseFloat(formData.transFee || 0)).toFixed(2)}
                 </div>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex justify-end gap-4">
            {editModeId && (
              <Button onClick={handleCancelEdit} variant="secondary">Cancel</Button>
            )}
            <Button type="submit" className="px-8" disabled={loading}>
              {loading ? 'Processing...' : (editModeId ? 'Update Booking' : 'Create Booking')}
            </Button>
          </div>
        </form>

        {/* --- LIST VIEW --- */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-slate-800 mb-4">Pending Bookings</h2>
          <div className="bg-white rounded-xl shadow-card overflow-hidden border border-slate-200">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Ref / PNR</th>
                  <th className="px-6 py-4">Passenger</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4 text-right">Revenue</th>
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
                    <td className="px-6 py-4">{b.fromTo} <br/><span className="text-xs text-slate-400">{b.airline}</span></td>
                    <td className="px-6 py-4 text-right font-mono">{b.revenue?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-green-600">{b.profit?.toFixed(2)}</td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => handleEdit(b)}
                        className="font-medium text-brand-accent hover:text-blue-700 hover:underline transition-all"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Styles for clean inputs */}
      <style>{`
        .label { display: block; font-size: 0.75rem; font-weight: 600; color: #64748b; margin-bottom: 0.25rem; text-transform: uppercase; }
        .input-field { width: 100%; border: 1px solid #cbd5e1; border-radius: 0.375rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; transition: border-color 0.15s; outline: none; }
        .input-field:focus { border-color: #3b82f6; ring: 1px solid #3b82f6; }
      `}</style>
    </div>
  );
}