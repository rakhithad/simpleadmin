import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const navigate = useNavigate();

  // SENIOR FIX: Read localStorage directly during initialization
  // This avoids the "double render" and the useEffect error completely.
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  useEffect(() => {
    // Only use useEffect for side effects like redirecting
    const token = localStorage.getItem('token');
    if (!token || !user) {
      navigate('/'); 
    }
  }, [navigate, user]);

  // Prevent flashing content if user isn't loaded yet
  if (!user) return null; 

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-card border border-slate-100">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-wider">Active Session</h3>
            <p className="mt-2 text-xl font-bold text-brand-main">
              {user.firstName} {user.lastName}
            </p>
            <div className="mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-brand-accent border border-blue-100">
              {user.role}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}