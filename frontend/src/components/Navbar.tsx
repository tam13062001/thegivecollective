// src/components/Navbar.tsx
import { NavLink } from 'react-router-dom';
import logo from '../assets/The Give Collective.png';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <img src={logo} alt="logo" className="h-10 w-auto" />
          
          {/* Thêm Menu chuyển tab ở đây */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink 
              to="/" 
              className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              Overview
            </NavLink>
            <NavLink 
              to="/insights" 
              className={({ isActive }) => `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              Insights & Top Posts
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}