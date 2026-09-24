import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <div className="pb-tabbar min-h-dvh bg-ink">
      <Navbar />
      <main key={pathname} className="screen-in">
        {children}
      </main>
      <Footer />
    </div>
  );
}
