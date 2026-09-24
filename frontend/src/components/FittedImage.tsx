import { useEffect, useRef, useState } from "react";

// Fit the whole photo (instead of cropping to fill) once cropping would cut
// away this much of its height — e.g. a portrait phone photo in a wide banner.
const TOO_TALL = 1.4;

/**
 * A photo that fills its frame, absolutely positioned inside a `relative`
 * parent. Wide or roughly-matching photos are cropped to fill (object-cover),
 * but a photo much taller than its frame is shown whole, over a blurred copy
 * of itself so the frame never has empty bars. Re-checked whenever the frame
 * resizes, so the same photo can fill on a phone and fit on desktop.
 */
export default function FittedImage({
  src,
  alt = "",
  position = "object-center",
  loading = "lazy",
  className = "",
}: {
  src: string;
  alt?: string;
  /** object-position used when cropping, e.g. "object-top". */
  position?: string;
  loading?: "lazy" | "eager";
  /** Extra classes for the photo itself, e.g. "duotone". */
  className?: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [fit, setFit] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !natural) return;
    const check = () => {
      const { clientWidth: fw, clientHeight: fh } = frame;
      if (!fw || !fh) return;
      setFit(natural.w / natural.h < fw / fh / TOO_TALL);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [natural]);

  return (
    <div ref={frameRef} className="absolute inset-0 overflow-hidden">
      {fit && (
        <img
          src={src}
          alt=""
          aria-hidden="true"
          loading={loading}
          className={`absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl ${className}`}
        />
      )}
      <img
        key={src}
        src={src}
        alt={alt}
        loading={loading}
        onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
        className={`absolute inset-0 h-full w-full ${fit ? "object-contain" : `object-cover ${position}`} ${className}`}
      />
    </div>
  );
}
