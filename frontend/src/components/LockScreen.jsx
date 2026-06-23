// src/pages/LockScreen.jsx
import { useState } from "react"
import { toast } from "sonner"

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Check PIN code
    if (pin === "Collective") {
      // Store mock refresh token in localStorage
      localStorage.setItem("app_refresh_token", "fake-secure-jwt-token-12345")
      toast.success("Unlocked successfully!")
      onUnlock() // Update authentication state in App.jsx
    } else {
      toast.error("Incorrect. Please try again!")
      setPin("")
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Access Portal</h2>
        <p>Enter the password to continue</p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            maxLength={5}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="Input pass"
            style={styles.input}
          />
          <button type="submit" style={styles.button}>Enter</button>
        </form>
      </div>
    </div>
  )
}

// Basic clean styling
const styles = {
  container: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: "#f3f4f6" },
  card: { padding: "2rem", background: "#fff", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", textAlign: "center", width: "300px" },
  input: { display: "block", width: "100%", padding: "10px", margin: "1rem 0", boxSizing: "border-box", textAlign: "center", fontSize: "1.2rem", letterSpacing: "5px", borderRadius: "4px", border: "1px solid #ccc" },
  button: { width: "100%", padding: "10px", background: "#0070f3", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }
}