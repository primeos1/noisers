import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./league.css";
import LeagueSite from "./LeagueSite";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LeagueSite />
  </StrictMode>,
);
