import logo from '../assets/The Give Collective.png';

export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-white border-b border-slate-100 shadow-sm">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center">
        <img src={logo} alt="logo" className="h-10 w-auto" />
      </div>
    </nav>
  );
}