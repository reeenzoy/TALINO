import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErr("");
    setLoading(true);
    try {
      if (mode === "login") await login(email, pwd);
      else await register(email, pwd);
      // AuthProvider sets user; App will swap to AuthedApp
    } catch (ex) {
      setErr(ex.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-svh place-items-center text-textp">
      <div className="w-full max-w-sm rounded-2xl border border-borderc bg-bgs p-6 shadow-card">
        {/* Brand */}
        <div className="mb-5 text-center">
          <div className="mx-auto mb-3 grid size-12 place-items-center rounded-xl text-xl font-bold">
            <img src="/bot_logo.png" alt="TALINO AI Logo" className="h-full w-full object-contain" />
          </div>
          <h1 className="text-lg font-semibold">Welcome</h1>
          <p className="mt-1 text-sm text-texts">Sign in or create an account</p>
        </div>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-2 rounded-lg border border-borderc bg-bgp p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-md px-3 py-2 text-sm ${mode === "login" ? "bg-bgs text-textp" : "text-texts hover:text-textp"}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`rounded-md px-3 py-2 text-sm ${mode === "register" ? "bg-bgs text-textp" : "text-texts hover:text-textp"}`}
          >
            Register
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-texts">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-borderc bg-bgp px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-texts">Password</label>
            <div className="flex items-stretch gap-2">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                required
                minLength={8}
                className="w-full rounded-lg border border-borderc bg-bgp px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="rounded-lg border border-borderc px-3 text-sm text-texts hover:bg-bgs"
                aria-label={showPwd ? "Hide password" : "Show password"}
                title={showPwd ? "Hide password" : "Show password"}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {err && (
            <div className="rounded-md border border-error/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait…" : mode === "login" ? "Login" : "Register"}
          </button>
        </form>
      </div>
    </div>
  );
}
