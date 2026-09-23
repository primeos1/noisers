import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./lib/AuthContext";
import { SquadProvider } from "./lib/SquadContext";
import { MatchDayProvider } from "./lib/MatchDayContext";
import { CardsProvider } from "./lib/CardsContext";
import { SettingsProvider } from "./lib/SettingsContext";
import { HomeContentProvider } from "./lib/HomeContentContext";
import { ValeContentProvider } from "./lib/ValeContentContext";
import { HighlightsProvider } from "./lib/HighlightsContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SettingsProvider>
          <HomeContentProvider>
            <ValeContentProvider>
              <HighlightsProvider>
                <SquadProvider>
                  <MatchDayProvider>
                    <CardsProvider>
                      <App />
                    </CardsProvider>
                  </MatchDayProvider>
                </SquadProvider>
              </HighlightsProvider>
            </ValeContentProvider>
          </HomeContentProvider>
        </SettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
