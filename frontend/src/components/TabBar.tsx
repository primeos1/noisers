import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

export interface TabItem {
  label: string;
  to: string;
  end?: boolean;
  icon: ReactNode;
}

const itemClass = (active: boolean) =>
  `flex min-w-0 flex-1 flex-col items-center gap-1 text-[0.68rem] font-semibold tracking-wide transition-colors ${
    active ? "text-paper" : "text-mist"
  }`;

const pillClass = (active: boolean) =>
  `flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200 ${
    active ? "bg-paper text-ink" : ""
  }`;

/**
 * Floating thumb dock shown on phones only. `extra` is an optional trailing
 * button (e.g. "More") that isn't a route.
 */
export default function TabBar({
  tabs,
  label,
  extra,
}: {
  tabs: TabItem[];
  label: string;
  extra?: { label: string; icon: ReactNode; active: boolean; onClick: () => void };
}) {
  return (
    <nav className="tabbar md:hidden" aria-label={label}>
      <div className="glass flex rounded-[28px] px-1 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5">
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => itemClass(isActive)}>
            {({ isActive }) => (
              <>
                <span className={pillClass(isActive)}>{tab.icon}</span>
                <span className="max-w-full truncate">{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
        {extra && (
          <button type="button" onClick={extra.onClick} className={itemClass(extra.active)} aria-expanded={extra.active}>
            <span className={pillClass(extra.active)}>{extra.icon}</span>
            <span className="max-w-full truncate">{extra.label}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
