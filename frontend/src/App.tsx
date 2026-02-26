import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import MessengerApp from "./pages/Apis";
import NotFound from "./pages/NotFound";
import MessengerWebhook from "./pages/Webhooks";
import { TooltipProvider } from "./components/ui/tooltip";
import UnifiedDashboard from "./pages/MessengerDashboard";

const App = () => {
  return (
    <Router>
      <TooltipProvider>
        <Routes>
          <Route path="/" element={<UnifiedDashboard />} />
          <Route path="/webhook" element={<MessengerWebhook />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </Router>
  );
};

export default App;
