import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';
import PaymentTerminal from '../components/PaymentTerminal'; // <--- Ensure this is imported

// --- UTILITIES ---
const formatDate = (d) => d ? new Date(d).toISOString().split('T')[0] : '-';
const formatMoney = (m) => `£${parseFloat(m || 0).toFixed(2)}`;

// Helper to determine Payment Status Badge
const getPaymentStatus = (booking) => {
  const revenue = booking.revenue || 0;
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  
  if (totalPaid >= revenue - 0.05) return { label: 'PAID FULL', color: 'bg-green-100 text-green-800 border-green-200' };
  if (totalPaid > 0) return { label: 'PARTIAL', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
  return { label: 'UNPAID', color: 'bg-red-100 text-red-800 border-red-200' };
};

// --- SUB-COMPONENT: The "Drawer" that opens up ---
// FIXED: Added 'onUpdate' to the props below 👇
const ExpandedDetails = ({ booking, onUpdate }) => {
  // Calculate financial totals for the UI
  const initialTotal = booking.initialPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
  const instalmentPaid = booking.instalments?.reduce((sum, i) => sum + (i.paidAmount || 0), 0) || 0;
  const totalPaid = initialTotal + instalmentPaid;
  const balance = (booking.revenue || 0) - totalPaid;

  // Calculate total from the Breakdown list to check for discrepancies
  const breakdownTotal = booking.supplierCosts?.reduce((sum, c) => sum + c.amount, 0) || 0;

  return (
    <div className="bg-slate-50 border-t border-b border-slate-200 p-6 shadow-inner animate-fade-in text-sm">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* COLUMN 1: TRIP & PAX */}
        <div className="space-y-4">
          <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1">Trip Details</h4>
          <div className="grid grid-cols-2 gap-y-2 text-slate-600">
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Agent</span>{booking.agentName} ({booking.teamName})</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Type</span>{booking.bookingType}</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">Travel Date</span>{formatDate(booking.travelDate)}</div>
            <div><span className="block text-[10px] text-slate-400 uppercase font-bold">PC Date</span>{formatDate(booking.pcDate)}</div>
            <div className="col-span-2"><span className="block text-[10px] text-slate-400 uppercase font-bold">Approved By</span>{booking.approvedBy?.firstName} {booking.approvedBy?.lastName}</div>
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

        {/* COLUMN 2: SUPPLIER COSTS */}
        <div>
          <div className="flex justify-between items-end border-b border-slate-300 pb-1">
            <h4 className="font-bold text-slate-700 uppercase text-xs">Supplier Breakdown</h4>
            <span className="text-[10px] text-slate-400">Total: {formatMoney(booking.prodCost)}</span>
          </div>
          
          {(!booking.supplierCosts || booking.supplierCosts.length === 0) ? (
            <div className="bg-yellow-50 rounded border border-yellow-200 p-4 text-center mt-2">
              <p className="text-xs text-yellow-700 italic">No breakdown items found.</p>
              <p className="text-[10px] text-yellow-600 mt-1">This booking might have been created before the update.</p>
            </div>
          ) : (
            <div className="bg-white rounded border border-slate-200 overflow-hidden mt-2 shadow-sm">
              {/* Header Row */}
              <div className="grid grid-cols-3 bg-slate-100 px-3 py-1.5 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase">
                <span>Supplier</span>
                <span>Category</span>
                <span className="text-right">Cost</span>
              </div>
              
              {/* Items */}
              {booking.supplierCosts.map((c, i) => (
                <div key={i} className="grid grid-cols-3 px-3 py-2 border-b border-slate-100 last:border-0 text-slate-600 items-center">
                  <div className="font-bold text-xs text-blue-700">{c.supplier}</div>
                  <div>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                      {c.category}
                    </span>
                  </div>
                  <div className="text-right font-mono text-xs">{formatMoney(c.amount)}</div>
                  {/* Optional Description Row */}
                  {c.description && <div className="col-span-3 text-[10px] text-slate-400 italic mt-1">{c.description}</div>}
                </div>
              ))}
              
              {/* Totals Check */}
              <div className="flex justify-between px-3 py-2 bg-slate-50 font-bold text-slate-700 border-t border-slate-200 text-xs">
                <span>Calculated Total</span>
                <span className={breakdownTotal !== booking.prodCost ? 'text-red-600' : 'text-slate-700'}>
                  {formatMoney(breakdownTotal)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* COLUMN 3: FINANCIALS */}
        <div>
          <h4 className="font-bold text-slate-700 uppercase text-xs border-b border-slate-300 pb-1">Financial Summary</h4>
          <div className="space-y-2 mt-2 bg-white p-3 rounded border border-slate-200 shadow-sm">
            <div className="flex justify-between text-slate-500"><span>Revenue:</span> <span className="text-slate-800 font-bold">{formatMoney(booking.revenue)}</span></div>
            <div className="flex justify-between text-slate-500"><span>Product Cost:</span> <span className="text-red-400 font-medium">-{formatMoney(booking.prodCost)}</span></div>
            <div className="flex justify-between text-slate-500 text-xs pl-2"><span>(Trans Fee + Surcharge):</span> <span className="text-red-300">-{formatMoney((booking.transFee || 0) + (booking.surcharge || 0))}</span></div>
            <div className="border-t border-slate-100 my-1"></div>
            <div className="flex justify-between text-slate-700"><span>Net Profit:</span> <span className="text-green-600 font-bold text-lg">{formatMoney(booking.profit)}</span></div>
            
            <div className="border-t border-dashed my-2"></div>
            <div className="flex justify-between text-slate-500"><span>Total Paid:</span> <span className="text-blue-600 font-bold">{formatMoney(totalPaid)}</span></div>
            
            <div className={`flex justify-between p-2 rounded font-bold border ${balance > 0.05 ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              <span>Outstanding:</span>
              <span>{formatMoney(balance)}</span>
            </div>
          </div>

          {/* INSTALMENTS PREVIEW */}
          {booking.instalments.length > 0 && (
            <div className="mt-4">
              <h4 className="font-bold text-slate-400 uppercase text-[10px] mb-1">Upcoming Instalments</h4>
              <div className="bg-white rounded border border-slate-200 overflow-hidden">
                {booking.instalments.map((inst, i) => (
                  <div key={i} className="flex justify-between items-center px-2 py-1.5 border-b border-slate-100 last:border-0 text-xs hover:bg-slate-50">
                    <span className="text-slate-500">{formatDate(inst.dueDate)}</span>
                    <div className="text-right">
                      <div className="text-slate-700 font-medium">{formatMoney(inst.amount)}</div>
                      {inst.paidAmount > 0 && <div className="text-[10px] text-green-600">Paid: {formatMoney(inst.paidAmount)}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* PAYMENT TERMINAL (Full Width) */}
        <div className="col-span-1 md:col-span-3">
            <PaymentTerminal booking={booking} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
export default function ApprovedBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Track expanded rows (Key = booking ID, Value = boolean)
  const [expandedRows, setExpandedRows] = useState({});

  const toggleRow = (id) => {
    setExpandedRows(prev => ({
      ...prev,
      [id]: !prev[id] // Toggle true/false
    }));
  };

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
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Master Booking Records</h1>
            <p className="text-sm text-slate-500">Click any row to expand details.</p>
          </div>
          <input 
            type="text" 
            placeholder="Search Folder, Ref, or Pax..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg w-full md:w-80 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-100 text-xs uppercase font-bold text-slate-700">
              <tr>
                <th className="px-4 py-4 w-8"></th> {/* Arrow Column */}
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
              {loading ? (
                <tr><td colSpan="8" className="p-8 text-center text-slate-400">Loading records...</td></tr>
              ) : filteredBookings.length === 0 ? (
                <tr><td colSpan="8" className="p-8 text-center text-slate-400">No records found.</td></tr>
              ) : (
                filteredBookings.map((b) => {
                  const status = getPaymentStatus(b);
                  const isExpanded = expandedRows[b.id];

                  return (
                    <React.Fragment key={b.id}>
                      {/* PARENT ROW - CLICKABLE */}
                      <tr 
                        onClick={() => toggleRow(b.id)}
                        className={`cursor-pointer transition-all border-l-4 ${isExpanded ? 'bg-blue-50 border-l-blue-500' : 'hover:bg-slate-50 border-l-transparent'}`}
                      >
                        <td className="px-4 py-4 text-center text-slate-400 text-xs">
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td className="px-6 py-4 font-bold text-blue-700">{b.folderNo}</td>
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
                          <div>{b.fromTo}</div>
                          <div className="text-xs text-slate-400">{b.airline}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-green-600">
                          {formatMoney(b.profit)}
                        </td>
                      </tr>

                      {/* CHILD ROW - EXPANDABLE */}
                      {isExpanded && (
                        <tr>
                          <td colSpan="8" className="p-0">
                            <ExpandedDetails 
                              booking={b} 
                              onUpdate={fetchApprovedBookings}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Small Animation for the drawer */}
      <style>{`
        .animate-fade-in { animation: fadeIn 0.3s ease-out; } 
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}


