// src/App.jsx
import { useState, useEffect } from "react"
import { Toaster } from "sonner"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Homepage from "./pages/Homepage"
import NotFound from "./pages/404"
import LockScreen from "./components/LockScreen"

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(null)

  // Kiểm tra "Refresh Token" khi ứng dụng khởi chạy
  useEffect(() => {
    const token = localStorage.getItem("app_refresh_token")
    if (token) {
      // Ở thực tế, bạn sẽ gửi token này lên API để verify, ở đây ta tin tưởng nó luôn
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  // Đang loading kiểm tra token thì chưa render gì cả
  if (isAuthenticated === null) {
    return <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>Đang tải...</div>
  }

  return (
    <>
      <BrowserRouter>
        <Routes>
          {/* Nếu chưa xác thực, tất cả các route đều hướng về LockScreen */}
          {!isAuthenticated ? (
            <Route path="*" element={<LockScreen onUnlock={() => setIsAuthenticated(true)} />} />
          ) : (
            <>
              {/* Nếu đã xác thực thành công */}
              <Route path="/" element={<Homepage />} />
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