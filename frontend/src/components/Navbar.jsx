import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  return (
    <nav className="bg-brand-main text-black px-8 py-4 flex justify-between items-center shadow-md">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-8 h-8 bg-brand-accent rounded-sm" />
          <span className="text-lg font-bold tracking-tight">CORP_SYS v2.0</span>
        </div>
        
        {/* Navigation Links */}
        <div className="hidden md:flex gap-6 text-sm font-medium">
          <button onClick={() => navigate('/dashboard')} className="opacity-80 hover:opacity-100">Dashboard</button>
          <button onClick={() => navigate('/bookings')} className="opacity-80 hover:opacity-100">Bookings</button>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button onClick={handleLogout} className="bg-white/10 hover:bg-white/20 px-3 py-1 rounded text-sm transition-colors">
          Logout
        </button>
      </div>
    </nav>
  );
}