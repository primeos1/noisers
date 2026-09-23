import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Squad from "./pages/Squad";
import TheVale from "./pages/TheVale";
import Highlights from "./pages/Highlights";
import Performance from "./pages/Performance";
import Login from "./pages/Login";
import PlayerLogin from "./pages/PlayerLogin";
import PlayerPortal from "./pages/PlayerPortal";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminLayout from "./components/admin/AdminLayout";
import AdminHome from "./pages/admin/AdminHome";
import AdminSquad from "./pages/admin/AdminSquad";
import AdminMatches from "./pages/admin/AdminMatches";
import MatchDay from "./pages/admin/MatchDay";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/squad" element={<Squad />} />
      <Route path="/the-vale" element={<TheVale />} />
      <Route path="/highlights" element={<Highlights />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/login" element={<Login />} />
      <Route path="/player-login" element={<PlayerLogin />} />

      <Route
        path="/portal"
        element={
          <ProtectedRoute roles={["player", "admin"]} loginPath="/player-login">
            <PlayerPortal />
          </ProtectedRoute>
        }
      />

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
      </Route>
    </Routes>
  );
}
