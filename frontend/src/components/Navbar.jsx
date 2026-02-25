import { useNavigate, NavLink } from 'react-router-dom';
import logo from '../assets/logo.png';

// Icons (Inline SVGs for no extra dependencies)
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
    <polyline points="16 17 21 12 16 7"></polyline>
    <line x1="21" y1="12" x2="9" y2="12"></line>
  </svg>
);

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Optional: Add a confirmation or loading state here
    if(window.confirm("Are you sure you want to log out?")) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/');
    }
  };

  // Helper for active link classes
  const getLinkClass = ({ isActive }) => 
    `px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 ${
      isActive 
        ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    }`;

  return (
    <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* --- LEFT: LOGO (Flex-1 to push center) --- */}
          <div className="flex-1 flex justify-start">
            <div 
              className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => navigate('/bookings')}
            >
              <img
                src={logo}   
                alt="Company Logo"
                className="h-20 w-auto object-contain"
              />
            </div>
          </div>

          {/* --- CENTER: NAVIGATION LINKS --- */}
          {/* Using NavLink automatically handles the 'active' styling */}
          <div className="hidden md:flex flex-1 justify-center gap-2 bg-slate-50 p-1.5 rounded-full border border-slate-100 shadow-inner">
            <NavLink to="/bookings" className={getLinkClass}>
              Drafts
            </NavLink>
            <NavLink to="/approved-bookings" className={getLinkClass}>
              Approved
            </NavLink>
            <NavLink to="/commissions" className={getLinkClass}>
              Commissions
            </NavLink>
          </div>

          {/* --- RIGHT: LOGOUT (Flex-1 to balance layout) --- */}
          <div className="flex-1 flex justify-end">
            <button 
              onClick={handleLogout} 
              className="group flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200 border border-transparent hover:border-red-100"
            >
              <span>Logout</span>
              <span className="group-hover:translate-x-1 transition-transform">
                <LogoutIcon />
              </span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}