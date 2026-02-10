import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'; // Ensure axios is installed
import Button from "../components/Button";

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle typing
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.type]: e.target.value });
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Call your Backend
      const response = await axios.post('http://localhost:5000/api/auth/login', formData);

      if (response.data.success) {
        // 2. Save the "Passport" (Token)
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));

        // 3. Go Inside!
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8">
        <h2 className="text-3xl font-extrabold text-slate-900 text-center mb-6">System Login</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input 
              type="email" 
              value={formData.email}
              onChange={handleChange}
              className="w-full mt-1 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="admin@company.com"
              required 
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <input 
              type="password" 
              value={formData.password}
              onChange={handleChange}
              className="w-full mt-1 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="••••••••"
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Authenticating...' : 'Enter System'}
          </Button>
        </form>
      </div>
    </div>
  );
}