/**
 * Which "screen" a path belongs to. Screens slide in and open at the top;
 * a Noisers story (/noisers/:id) opens as a reader over the feed, so it
 * counts as the same screen as /noisers.
 */
export function screenKey(pathname: string) {
  return pathname.startsWith("/noisers/") ? "/noisers" : pathname;
}
