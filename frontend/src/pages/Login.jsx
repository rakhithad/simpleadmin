import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Button from "../components/Button";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.type]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', formData);
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        navigate('/bookings');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 p-6">
      
      {/* GLASS CARD */}
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-white/50 p-10 animate-fade-in">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4 text-3xl">
            ✈️
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">Welcome Back</h2>
          <p className="text-slate-400 text-sm mt-1">Sign in to access your dashboard</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm text-red-600 rounded-xl text-xs font-bold border border-red-100 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Email Address</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
              placeholder="consultant@company.com"
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase mb-1 ml-1">Password</label>
            <input 
              type="password" 
              value={formData.password}
              onChange={handleChange}
              className="w-full bg-white/50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-700"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-xl shadow-slate-900/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-xs text-slate-400">Protected System • Authorized Personnel Only</p>
        </div>
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}