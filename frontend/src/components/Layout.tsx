import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import { screenKey } from "../lib/screenKey";

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="pb-tabbar min-h-dvh bg-ink">
      <Navbar />
      <main key={screenKey(pathname)} className="screen-in">
        {children}
      </main>
      <Footer />
    </div>
  );
}
