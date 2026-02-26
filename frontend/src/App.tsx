import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import NotFound from "./pages/NotFound";
import HomeDashboard from "./pages/HomeDashboard";
import Login from "./pages/Login";
import MessengerTab from "@/components/MessengerTab";
import WebhookTab from "@/components/WebhookTab";

// ─── Protected Route ──────────────────────────────────────────────────────────

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isLoggedIn } = useAuth();
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
};

// ─── App Routes ───────────────────────────────────────────────────────────────

const AppRoutes = () => {
  const { isLoggedIn } = useAuth();

  return (
    <Routes>
      {/* Redirect root to /home */}
      <Route path="/" element={<Navigate to="/home" replace />} />

      {/* Login — redirect away if already authenticated */}
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/home" replace /> : <Login />}
      />

      {/* /home — shell stays mounted, inner content changes by nested route */}
      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <HomeDashboard />
          </ProtectedRoute>
        }
      >
        <Route path="messenger" element={<MessengerTab />} />
        <Route path="auto_messenger" element={<WebhookTab />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

// ─── Root ─────────────────────────────────────────────────────────────────────

const App = () => (
  <Router>
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  </Router>
);

export default App;
