import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BookingManager from './pages/BookingManager';
import ApprovedBookings from './pages/ApprovedBookings';
import CommissionLedger from './pages/CommissionLedger';


function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bookings" element={<BookingManager />} />
          <Route path="/approved-bookings" element={<ApprovedBookings />} />
          <Route path="/commissions" element={<CommissionLedger />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;