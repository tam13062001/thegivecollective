// src/components/Navbar.tsx
import { NavLink, useLocation } from 'react-router-dom';
import logo from '../assets/The Give Collective.png';

export function Navbar() {
  const location = useLocation();
  const isInsights = location.pathname === '/insights';

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 h-16 border-b transition-colors ${isInsights
        ? 'border-signal-border bg-signal-ink/95 shadow-none'
        : 'border-slate-100 bg-white shadow-sm'
        }`}
    >
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 md:px-6">
        <div className="flex w-full items-center gap-3 md:gap-8">
          <img src={logo} alt="The Give Collective" className="h-8 w-auto shrink-0 md:h-10" />

          <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto">
            <NavLink
              to="/"
              className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors md:px-4 md:text-sm ${isActive
                ? isInsights
                  ? 'text-signal-muted'
                  : 'bg-slate-100 text-slate-800'
                : isInsights
                  ? 'text-signal-muted hover:bg-signal-surface hover:text-signal-text'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              Overview
            </NavLink>
            <NavLink
              to="/insights"
              className={({ isActive }) => `relative whitespace-nowrap rounded-lg px-3 py-2 text-[13px] font-medium transition-colors md:px-4 md:text-sm ${isActive
                ? isInsights
                  ? 'text-signal-text after:absolute after:inset-x-3 after:-bottom-[17px] after:h-0.5 after:bg-signal-coral md:after:inset-x-4'
                  : 'bg-slate-100 text-slate-800'
                : isInsights
                  ? 'text-signal-muted hover:bg-signal-surface hover:text-signal-text'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                }`}
            >
              Insights & Top Posts
            </NavLink>
          </div>
        </div>
      </div>
    </nav>
  );
}