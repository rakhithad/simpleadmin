import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import BookingManager from './pages/BookingManager';
import ApprovedBookings from './pages/ApprovedBookings';
import CommissionLedger from './pages/CommissionLedger';
import UserManager from './pages/UserManager';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/bookings" element={<ProtectedRoute><BookingManager /></ProtectedRoute>} />
          <Route path="/approved-bookings" element={<ProtectedRoute><ApprovedBookings /></ProtectedRoute>} />
          <Route path="/commissions" element={<ProtectedRoute><CommissionLedger /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute><UserManager /></ProtectedRoute>} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;