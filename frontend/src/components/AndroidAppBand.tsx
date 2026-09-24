import logoWhite from "../assets/brand/logo-white.png";

// The latest APK from `eas build --profile preview` (mobile/), uploaded to R2
// under a fixed key so this link never changes between builds. R2 serves it
// with Content-Disposition: attachment; filename="Noisers FC.apk".
export const ANDROID_APP_URL = "https://media.noisersfc.com/app/noisers-fc.apk";

const ANDROID_GREEN = "#3DDC84";

function AndroidLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M17.6 9.48l1.84-3.18a.38.38 0 0 0-.66-.38l-1.87 3.23a11.43 11.43 0 0 0-9.82 0L5.22 5.92a.38.38 0 0 0-.66.38L6.4 9.48A10.78 10.78 0 0 0 1 18h22a10.78 10.78 0 0 0-5.4-8.52zM7 15.25a1.25 1.25 0 1 1 1.25-1.25A1.25 1.25 0 0 1 7 15.25zm10 0A1.25 1.25 0 1 1 18.25 14 1.25 1.25 0 0 1 17 15.25z"
        fill={ANDROID_GREEN}
      />
    </svg>
  );
}

export default function AndroidAppBand() {
  return (
    <section className="relative overflow-hidden border-y border-ink-line bg-ink-raised">
      {/* Oversized crest watermark */}
      <img
        src={logoWhite}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 top-1/2 w-[26rem] -translate-y-1/2 opacity-[0.05] md:-right-10 md:w-[34rem]"
      />
      <div
        className="pointer-events-none absolute -left-32 -top-32 h-80 w-80 rounded-full opacity-20 blur-3xl"
        style={{ background: ANDROID_GREEN }}
        aria-hidden="true"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-10 md:py-16">
        <div className="flex items-center gap-5 md:gap-7">
          <div className="grid h-20 w-20 shrink-0 place-items-center rounded-[22%] bg-ink shadow-[0_12px_40px_-8px_rgba(0,0,0,0.8)] ring-1 ring-ink-line md:h-24 md:w-24">
            <img src={logoWhite} alt="Noisers FC app icon" className="h-[88%] w-[88%]" />
          </div>
          <div>
            <p
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: ANDROID_GREEN }}
            >
              <AndroidLogo className="h-4 w-4" />
              Now on Android
            </p>
            <h2 className="mt-2 font-display text-4xl leading-[0.95] tracking-tight text-paper md:text-6xl">
              THE NOISERS FC APP
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-paper-dim md:text-base">
              Squad, match days, stats and fines, live in your pocket.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-3 md:items-end">
          <a
            href={ANDROID_APP_URL}
            download="Noisers FC.apk"
            className="group flex items-center justify-center gap-4 border-2 border-paper bg-paper px-7 py-4 text-ink transition-colors hover:bg-transparent hover:text-paper"
          >
            <AndroidLogo className="h-9 w-9 transition-transform group-hover:-translate-y-0.5" />
            <span className="flex flex-col text-left leading-none">
              <span className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] opacity-70">
                Download for
              </span>
              <span className="mt-1 font-display text-3xl font-bold tracking-tight">ANDROID</span>
            </span>
          </a>
          <p className="text-center text-xs text-mist md:text-right">
            Noisers FC.apk · allow “Install unknown apps” when asked
          </p>
        </div>
      </div>
    </section>
  );
}
