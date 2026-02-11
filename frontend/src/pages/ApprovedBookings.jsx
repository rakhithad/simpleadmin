import { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';

// Utility: Format Date
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toISOString().split('T')[0];
};

// Utility: Calculate "Paid vs Owed" Status
const getPaymentStatus = (booking) => {
  const revenue = booking.revenue || 0;
  
  // Sum Initial Payments
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  
  // Sum Instalments (Paid Amount)
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  
  const totalPaid = initialTotal + instalmentPaid;
  
  if (totalPaid >= revenue) return { label: 'PAID IN FULL', color: 'bg-green-100 text-green-800' };
  if (totalPaid > 0) return { label: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800' };
  return { label: 'UNPAID', color: 'bg-red-100 text-red-800' };
};

export default function ApprovedBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApprovedBookings();
  }, []);

  const fetchApprovedBookings = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/bookings/approved', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setBookings(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Filter Logic
  const filteredBookings = bookings.filter(b => 
    b.refNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.folderNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.paxName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        
        {/* HEADER & SEARCH */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Master Booking Records</h1>
            <p className="text-slate-500 text-sm mt-1">View and manage all confirmed bookings.</p>
          </div>
          
          <div className="w-full md:w-96">
            <input 
              type="text" 
              placeholder="Search Folder No, Ref, or Pax Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700">
              <tr>
                <th className="px-6 py-4">Folder No</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Ref / PNR</th>
                <th className="px-6 py-4">Lead Passenger</th>
                <th className="px-6 py-4">Route</th>
                <th className="px-6 py-4 text-center">Payment Status</th>
                <th className="px-6 py-4 text-right">Revenue</th>
                <th className="px-6 py-4 text-right">Profit</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan="9" className="px-6 py-8 text-center text-slate-500">Loading records...</td></tr>
              ) : filteredBookings.length === 0 ? (
                <tr><td colSpan="9" className="px-6 py-8 text-center text-slate-500">No approved bookings found.</td></tr>
              ) : (
                filteredBookings.map((b) => {
                  const status = getPaymentStatus(b);
                  return (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      {/* FOLDER NO (Key Identifier) */}
                      <td className="px-6 py-4 font-bold text-blue-600">
                        {b.folderNo}
                      </td>
                      
                      <td className="px-6 py-4 text-slate-500">{formatDate(b.createdAt)}</td>
                      
                      <td className="px-6 py-4 font-mono text-xs">
                        <div className="font-bold text-slate-800">{b.refNo}</div>
                        <div className="text-slate-500">{b.pnr}</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{b.paxName}</div>
                        <div className="text-xs text-slate-500">{b.numPax} Pax</div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{b.fromTo}</div>
                        <div className="text-xs text-slate-400">{b.airline}</div>
                      </td>

                      {/* PAYMENT STATUS BADGE */}
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 text-right font-mono text-slate-700">
                        £{b.revenue?.toFixed(2)}
                      </td>
                      
                      <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                        £{b.profit?.toFixed(2)}
                      </td>
                      
                      <td className="px-6 py-4 text-center">
                        <button className="text-blue-600 hover:text-blue-800 font-medium text-xs border border-blue-200 hover:bg-blue-50 px-3 py-1 rounded transition">
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}