import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import MessengerApp from "./pages/Apis";
import NotFound from "./pages/NotFound";
import MessengerWebhook from "./pages/Webhooks";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MessengerApp />} />
        <Route path="/webhook" element={<MessengerWebhook />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
