import { useLayoutEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home";
import Squad from "./pages/Squad";
import TheVale from "./pages/TheVale";
import Highlights from "./pages/Highlights";
import Performance from "./pages/Performance";
import Login from "./pages/Login";
import PlayerLogin from "./pages/PlayerLogin";
import JoinSquad from "./pages/JoinSquad";
import PortalLayout from "./components/portal/PortalLayout";
import PortalSquad from "./pages/portal/PortalSquad";
import PortalHistory from "./pages/portal/PortalHistory";
import PortalMatch from "./pages/portal/PortalMatch";
import PortalStats from "./pages/portal/PortalStats";
import PortalPlayer from "./pages/portal/PortalPlayer";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminSquad from "./pages/admin/AdminSquad";
import AdminMatches from "./pages/admin/AdminMatches";
import MatchDay from "./pages/admin/MatchDay";
import AdminCards from "./pages/admin/AdminCards";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminHomeContent from "./pages/admin/AdminHomeContent";
import AdminVale from "./pages/admin/AdminVale";
import AdminHighlights from "./pages/admin/AdminHighlights";
import PlayerProfile from "./pages/PlayerProfile";

// New screens open at the top, as in a native app (hash links excepted).
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    if (!hash) window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/squad" element={<Squad />} />
      <Route path="/squad/:id" element={<PlayerProfile />} />
      <Route path="/the-vale" element={<TheVale />} />
      <Route path="/highlights" element={<Highlights />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/login" element={<Login />} />
      <Route path="/player-login" element={<PlayerLogin />} />
      <Route path="/join" element={<JoinSquad />} />

      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={["player", "admin"]} loginPath="/player-login">
            <PortalLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PortalSquad />} />
        <Route path="history" element={<PortalHistory />} />
        <Route path="matches/:id" element={<PortalMatch />} />
        <Route path="stats" element={<PortalStats />} />
        <Route path="players/:id" element={<PortalPlayer />} />
      </Route>

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["admin"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="squad" element={<AdminSquad />} />
        <Route path="matches" element={<AdminMatches />} />
        <Route path="matchday" element={<MatchDay />} />
        <Route path="cards" element={<AdminCards />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="home-content" element={<AdminHomeContent />} />
        <Route path="vale" element={<AdminVale />} />
        <Route path="highlights" element={<AdminHighlights />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
    </>
  );
}
