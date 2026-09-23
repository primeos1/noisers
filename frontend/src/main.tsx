import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { SquadProvider } from "./lib/SquadContext";
import { MatchDayProvider } from "./lib/MatchDayContext";
import { CardsProvider } from "./lib/CardsContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SquadProvider>
          <MatchDayProvider>
            <CardsProvider>
              <App />
            </CardsProvider>
          </MatchDayProvider>
        </SquadProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
