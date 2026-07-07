"use client";

import * as React from "react";

/**
 * An <img> that renders a graceful fallback node when the source is missing or
 * fails to load — instead of the browser's broken-image "?" glyph. Resets when
 * the src changes (so a re-upload gets a fresh attempt).
 */
export function ImgWithFallback({
  src,
  alt = "",
  className,
  fallback,
  loading,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback: React.ReactNode;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      // Async decode keeps large photos off the main thread. Safe for exports:
      // the capture path awaits img.decode() explicitly. NB: we never default
      // loading to "lazy" — the off-screen export twin must load eagerly.
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
