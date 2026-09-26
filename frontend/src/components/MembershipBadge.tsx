import type { Membership } from "../lib/clubData";
import { membershipLabels } from "../lib/clubData";

// Small pill showing whether a player is a full member or a guest member.
// Teal for members, gold for guests, so the two read apart at a glance.
export default function MembershipBadge({
  membership,
  className = "",
}: {
  membership: Membership;
  className?: string;
}) {
  const tone =
    membership === "guest"
      ? "border-draw/60 bg-draw/15 text-draw"
      : "border-win/60 bg-win/15 text-win";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-wide ${tone} ${className}`}
    >
      {membershipLabels[membership]}
    </span>
  );
}
