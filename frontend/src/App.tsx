import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Squad from "./pages/Squad";
import TheVale from "./pages/TheVale";
import Highlights from "./pages/Highlights";
import Login from "./pages/Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/squad" element={<Squad />} />
      <Route path="/the-vale" element={<TheVale />} />
      <Route path="/highlights" element={<Highlights />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  );
}
