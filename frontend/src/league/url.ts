/** Where the league site lives: the subdomain in production, league.localhost in dev. */
export function leagueUrl(hash = "") {
  const { protocol, hostname, port } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") return `${protocol}//league.localhost${port ? `:${port}` : ""}/${hash}`;
  const root = hostname.replace(/^(www\.)/, "");
  return `https://league.${root}/${hash}`;
}
