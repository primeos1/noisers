// The gold "C" armband shown next to a team's captain.
export default function CaptainBand({ className = "" }: { className?: string }) {
  return (
    <span
      title="Captain"
      aria-label="Captain"
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-justice/70 bg-justice/15 text-[0.65rem] font-bold text-justice ${className}`}
    >
      C
    </span>
  );
}
