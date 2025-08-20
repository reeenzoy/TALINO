import { createContext, useContext, useEffect, useRef, useState } from "react";

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

// Normalize server responses to { id, email } | null
const pickUser = (obj) =>
  obj?.user ?? (obj?.id && obj?.email ? { id: obj.id, email: obj.email } : null);

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const ran = useRef(false); // guard StrictMode double-run

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      try {
        const r = await fetch("/api/auth/me", { credentials: "include" });
        // If the server 500s, this path still resolves and we treat as logged out
        const data = await r.json().catch(() => ({}));
        setUser(pickUser(data));
      } catch {
        setUser(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const register = async (email, password) => {
    const r = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Registration failed");
    setUser(pickUser(data));
    return data;
  };

  const login = async (email, password) => {
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || "Login failed");
    setUser(pickUser(data));
    return data;
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthCtx.Provider value={{ user, ready, register, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}