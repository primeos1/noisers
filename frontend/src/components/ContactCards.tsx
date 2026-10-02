import type { CSSProperties, ReactNode } from "react";
import { CLUB_EMAIL, INSTAGRAM_HANDLE, INSTAGRAM_URL, WHATSAPP_NUMBER, WHATSAPP_URL } from "../lib/contact";

const WHATSAPP_GREEN = "#25D366";

export function WhatsAppLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.05 21.5h-.01a9.43 9.43 0 0 1-4.8-1.31l-.35-.21-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.24-9.44 9.45-9.44 2.52 0 4.89.99 6.67 2.77a9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.43-9.44 9.43zm8.03-17.47A11.27 11.27 0 0 0 12.05.7C5.8.7.7 5.8.7 12.05c0 2 .52 3.95 1.52 5.67L.6 23.4l5.82-1.53a11.33 11.33 0 0 0 5.63 1.43h.01c6.25 0 11.34-5.09 11.35-11.35 0-3.03-1.18-5.88-3.33-8.02z" />
    </svg>
  );
}

function MailIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  );
}

function InstagramLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

interface CardProps {
  href: string;
  external?: boolean;
  accent: string;
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
}

function ContactCard({ href, external, accent, icon, label, value, note }: CardProps) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-ink-line bg-ink-raised p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[0_14px_40px_-18px_var(--accent)]"
      style={{ "--accent": accent } as CSSProperties}
    >
      <span
        className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <span
        className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={{ background: `${accent}1f`, color: accent }}
      >
        {icon}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>
          {label}
        </span>
        <span className="mt-1 block truncate text-[0.95rem] font-medium text-paper" title={value}>
          {value}
        </span>
        {note && <span className="mt-0.5 block text-xs text-mist">{note}</span>}
      </span>
      <span className="relative text-mist transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-paper">
        <ArrowIcon />
      </span>
    </a>
  );
}

export function EmailCard() {
  return (
    <ContactCard
      href={`mailto:${CLUB_EMAIL}`}
      accent="#d8b56a"
      icon={<MailIcon className="h-6 w-6" />}
      label="Email"
      value={CLUB_EMAIL}
    />
  );
}

export function WhatsAppCard({ label = "WhatsApp", note }: { label?: string; note?: string }) {
  return (
    <ContactCard
      href={WHATSAPP_URL}
      external
      accent={WHATSAPP_GREEN}
      icon={<WhatsAppLogo className="h-6 w-6" />}
      label={label}
      value={WHATSAPP_NUMBER}
      note={note}
    />
  );
}

export function InstagramCard() {
  return (
    <ContactCard
      href={INSTAGRAM_URL}
      external
      accent="#E1306C"
      icon={<InstagramLogo className="h-6 w-6" />}
      label="Instagram"
      value={`@${INSTAGRAM_HANDLE}`}
    />
  );
}
