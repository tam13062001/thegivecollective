// src/pages/LockScreen.jsx
import { useState } from "react"
import { toast } from "sonner"

export default function LockScreen({ onUnlock }) {
  const [password, setPassword] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Check password (case-sensitive)
    if (password === "Collective") {
      // Store mock refresh token in localStorage
      localStorage.setItem("app_refresh_token", "fake-secure-jwt-token-12345")
      toast.success("Unlocked successfully!")
      onUnlock() // Update authentication state in App.jsx
    } else {
      toast.error("Incorrect password. Please try again!")
      setPassword("")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
      <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center relative overflow-hidden">
        
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <div className="relative z-10">
          {/* Lock Icon */}
          <div className="mx-auto w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-slate-900/20">
            <svg 
              className="w-7 h-7 text-white" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Access Portal</h2>
          <p className="text-sm text-slate-500 mb-8">Enter the master password to continue</p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-5 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white transition-all placeholder:text-slate-400 text-center tracking-widest font-medium"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0"
            >
              Unlock
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}