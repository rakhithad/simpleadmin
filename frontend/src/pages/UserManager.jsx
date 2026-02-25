import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Navbar from '../components/Navbar';

// --- ROLE BADGES ---
const getRoleBadge = (role) => {
  const styles = {
    'SUPER_ADMIN': 'bg-purple-100 text-purple-700 border-purple-200',
    'ADMIN': 'bg-indigo-100 text-indigo-700 border-indigo-200',
    'SUPER_MANAGER': 'bg-pink-100 text-pink-700 border-pink-200',
    'MANAGEMENT': 'bg-orange-100 text-orange-700 border-orange-200',
    'CONSULTANT': 'bg-emerald-100 text-emerald-700 border-emerald-200'
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${styles[role] || 'bg-slate-100'}`}>{role.replace('_', ' ')}</span>;
};

// --- TEAM BADGES ---
const getTeamBadge = (team) => {
  if (!team) return <span className="text-slate-400">-</span>;
  return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-100 uppercase">{team}</span>;
};

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(null);

  // Form State
  const initialForm = {
    email: '', password: '', firstName: '', lastName: '', 
    title: 'MR', role: 'CONSULTANT', team: 'PH', contactNo: ''
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:5000/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) setUsers(res.data.data);
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const payload = { ...formData };
      
      // If editing and password is empty, remove it so we don't hash an empty string
      if (editMode && !payload.password) delete payload.password;

      if (editMode) {
        await axios.put(`http://localhost:5000/api/users/${editMode.id}`, payload, {
           headers: { Authorization: `Bearer ${token}` }
        });
        alert("User Updated!");
      } else {
        await axios.post(`http://localhost:5000/api/users`, payload, {
           headers: { Authorization: `Bearer ${token}` }
        });
        alert("User Created!");
      }
      
      closeModal();
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Operation Failed");
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("Are you sure? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:5000/api/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.message || "Delete Failed");
    }
  };

  const openEdit = (user) => {
    setEditMode(user);
    setFormData({ 
      ...user, 
      password: '' // Reset password field for security
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditMode(null);
    setFormData(initialForm);
  };

  return (
    <div className="min-h-screen bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-indigo-50 pb-20 font-sans text-slate-600">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <div>
             <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">User Management</h1>
             <p className="text-slate-400 text-sm mt-1 font-medium">Manage consultant access and roles.</p>
          </div>
          <button 
            onClick={() => setShowModal(true)} 
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-900/20 font-bold text-sm transition-all flex items-center gap-2"
          >
            <span>+</span> Add User
          </button>
        </div>

        {/* USERS TABLE */}
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 overflow-hidden">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="bg-slate-50/50 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-6 py-4">Name / Contact</th>
                <th className="px-6 py-4">Role & Team</th>
                <th className="px-6 py-4 text-center">Activity</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50/50">
              {loading ? <tr><td colSpan="4" className="p-8 text-center text-slate-400">Loading...</td></tr> : users.map(user => (
                <tr key={user.id} className="hover:bg-white/60 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{user.title} {user.firstName} {user.lastName}</div>
                    <div className="text-xs text-slate-400 font-mono">{user.email}</div>
                    {user.contactNo && <div className="text-[10px] text-blue-400 mt-0.5">{user.contactNo}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {getRoleBadge(user.role)}
                      {getTeamBadge(user.team)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="text-xs text-slate-500">
                      <span className="font-bold">{user._count?.approvedBookings || 0}</span> Approved
                    </div>
                    <div className="text-[10px] text-slate-400">
                      <span className="font-bold">{user._count?.pendingBookings || 0}</span> Pending
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openEdit(user)} className="text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Edit</button>
                      <button onClick={() => handleDelete(user.id)} className="text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in">
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{editMode ? 'Edit User' : 'Create New User'}</h2>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
            </div>
            
            <div className="p-8 space-y-6">
              {/* Name Row */}
              <div className="grid grid-cols-6 gap-4">
                <div className="col-span-1">
                  <label className="label">Title</label>
                  <select className="input-modern" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}>
                    <option>MR</option><option>MRS</option><option>MS</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="label">First Name</label>
                  <input className="input-modern" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="col-span-3">
                  <label className="label">Last Name</label>
                  <input className="input-modern" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
              </div>

              {/* Contact Row */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Email Address</label>
                  <input type="email" className="input-modern" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                  <label className="label">Contact No</label>
                  <input type="text" className="input-modern" value={formData.contactNo} onChange={e => setFormData({...formData, contactNo: e.target.value})} />
                </div>
              </div>

              {/* Role Row */}
              <div className="grid grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div>
                  <label className="label text-blue-400">System Role</label>
                  <select className="input-modern" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                    <option value="CONSULTANT">Consultant</option>
                    <option value="MANAGEMENT">Management</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="label text-blue-400">Department / Team</label>
                  <select className="input-modern" value={formData.team} onChange={e => setFormData({...formData, team: e.target.value})}>
                    <option value="PH">PH</option>
                    <option value="TOURS">Tours</option>
                    <option value="MARKETING">Marketing</option>
                    <option value="IT">IT</option>
                    <option value="QC">QC</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="label">Password {editMode && <span className="text-slate-400 font-normal normal-case">(Leave blank to keep current)</span>}</label>
                <input type="password" className="input-modern" required={!editMode} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} placeholder={editMode ? "••••••••" : "Enter secure password"} />
              </div>
            </div>

            <div className="px-8 py-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">Cancel</button>
              <button type="submit" className="px-8 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 transition-colors">
                {editMode ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      )}

      <style>{`
        .label { display: block; font-size: 0.65rem; font-weight: 800; color: #94a3b8; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.05em; }
        .input-modern { width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.6rem 0.8rem; font-size: 0.875rem; color: #334155; transition: all 0.2s; outline: none; }
        .input-modern:focus { border-color: #60a5fa; box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1); }
        .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; opacity: 0; transform: translateY(10px); }
        @keyframes fadeIn { to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
