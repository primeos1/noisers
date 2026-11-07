import { useEffect } from "react";
import { leagueUrl } from "../league/url";

/** The league moved to its own subdomain; start.js 301s there too. */
export default function LeagueRedirect() {
  useEffect(() => {
    window.location.replace(leagueUrl());
  }, []);
  return null;
}
