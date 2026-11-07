const CAPTAINS = new Set(["kelvinali", "kelvinalli", "rozay", "kentos", "bukas", "ojayakanugbo", "ojay", "kachi"]);
const VICE_CAPTAINS = new Set(["emeka", "samido", "femi", "omotundesolomon", "yakmos", "obetayo"]);

export function CaptainBadge({ name }: { name: string }) {
  const normalizedName = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const role = CAPTAINS.has(normalizedName) ? "Captain" : VICE_CAPTAINS.has(normalizedName) ? "Vice captain" : null;
  if (!role) return null;
  return <span title={role} aria-label={role} style={{ display: "inline-block", marginLeft: "0.4em", padding: "0.1em 0.4em", border: "1px solid currentColor", borderRadius: "3px", fontSize: "0.65em", fontWeight: 700, lineHeight: 1.4, verticalAlign: "middle" }}>{role === "Captain" ? "C" : "VC"}</span>;
}
