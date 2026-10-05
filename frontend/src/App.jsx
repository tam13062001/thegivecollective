// src/App.jsx
import { useState, useEffect } from "react"
import { Toaster } from "sonner"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import SocialDashboardPage from "./pages/SocialDashboardPage"
import SocialSharePage from "./pages/SocialSharePage"
import Homepage from "./pages/Homepage"
import NotFound from "./pages/404"
import LockScreen from "./components/LockScreen"
import { Navbar } from './components/Navbar'
import InsightsPage from "./pages/InsightsPage" 

function AppRoutes() {
  const location = useLocation();
  const isSharePage = location.pathname.replace(/\/+$/, "").toLowerCase() === "/share/social-dashboard";
  const [isAuthenticated, setIsAuthenticated] = useState(null)

  useEffect(() => {
    try {
      setIsAuthenticated(Boolean(localStorage.getItem("app_refresh_token")))
    } catch {
      setIsAuthenticated(false)
    }
  }, [])

  if (isAuthenticated === null) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Đang tải...</div>
  }

  return (
    <>
        {!isSharePage && <Navbar />}
        <Routes>
          <Route path="/share/social-dashboard" element={<SocialSharePage />} />
          {!isAuthenticated ? (
            <Route path="*" element={<LockScreen onUnlock={() => setIsAuthenticated(true)} />} />
          ) : (
            <>
              <Route path="/" element={<Homepage />} />
              {/* Thêm Route cho tab mới */}
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/social-dashboard" element={<SocialDashboardPage />} />
              <Route path="*" element={<NotFound />} />
            </>
          )}
        </Routes>
      <Toaster richColors position="top-right" />
    </>
  )
}

export default function App() {
  return <BrowserRouter><AppRoutes /></BrowserRouter>
}