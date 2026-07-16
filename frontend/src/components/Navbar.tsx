// src/components/Navbar.tsx
import { NavLink } from 'react-router-dom';
import logo from '../assets/The Give Collective.png';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto h-full px-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 md:gap-8 w-full">
          <img src={logo} alt="logo" className="h-8 md:h-10 w-auto shrink-0" />
          
          {/* Đã xóa class 'hidden' và tối ưu kích thước cho mobile */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar w-full">
            <NavLink 
              to="/" 
              className={({ isActive }) => `whitespace-nowrap px-3 md:px-4 py-2 rounded-lg text-[13px] md:text-sm font-medium transition-colors ${isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              Overview
            </NavLink>
            <NavLink 
              to="/insights" 
              className={({ isActive }) => `whitespace-nowrap px-3 md:px-4 py-2 rounded-lg text-[13px] md:text-sm font-medium transition-colors ${isActive ? 'bg-slate-100 text-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              Insights & Top Posts
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}