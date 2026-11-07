const CAPTAINS = new Set(["kelvinali", "kelvinalli", "rozay", "kentos", "obetayo", "ojayakanugbo", "ojay", "kachi"]);

export function CaptainBadge({ name }: { name: string }) {
  if (!CAPTAINS.has(name.toLowerCase().replace(/[^a-z0-9]/g, ""))) return null;
  return <span title="Captain" aria-label="Captain" style={{ display: "inline-block", marginLeft: "0.4em", padding: "0.1em 0.4em", border: "1px solid currentColor", borderRadius: "3px", fontSize: "0.65em", fontWeight: 700, lineHeight: 1.4, verticalAlign: "middle" }}>C</span>;
}
