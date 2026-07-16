// src/App.jsx
import { useState, useEffect } from "react"
import { Toaster } from "sonner"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Homepage from "./pages/Homepage"
import NotFound from "./pages/404"
import LockScreen from "./components/LockScreen"
import { Navbar } from './components/Navbar'
import InsightsPage from "./pages/InsightsPage" 
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null)

  useEffect(() => {
    const token = localStorage.getItem("app_refresh_token")
    if (token) {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  if (isAuthenticated === null) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Đang tải...</div>
  }

  return (
    <>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {!isAuthenticated ? (
            <Route path="*" element={<LockScreen onUnlock={() => setIsAuthenticated(true)} />} />
          ) : (
            <>
              <Route path="/" element={<Homepage />} />
              {/* Thêm Route cho tab mới */}
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="*" element={<NotFound />} />
            </>
          )}
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </>
  )
}

export default App