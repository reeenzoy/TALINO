import { useAuth } from "./auth/AuthProvider";
import AuthedApp from "./AuthedApp";

export default function App() {
  const { ready } = useAuth();
  if (!ready) return null; // small boot guard

  // Always render the main app; login is optional via modal
  return <AuthedApp />;
}