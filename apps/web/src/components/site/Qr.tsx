import { useEffect, useRef, useState } from 'react';

/** A QR code drawn locally (qrcode library, loaded only when the code is about to be seen). */
export function Qr({ url, alt }: { url: string; alt: string }) {
  const [svg, setSvg] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  // The QR library loads only when the code is about to be seen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let live = true;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        void import('qrcode').then((m) =>
          m.default.toString(url, { type: 'svg', margin: 1, width: 176 }).then((out) => {
            if (live) setSvg(out);
          }),
        );
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [url]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={alt}
      className="size-44 shrink-0 rounded-card border bg-white p-1 [&>svg]:size-full"
      // The SVG is produced locally by the qrcode library from our own URL.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
