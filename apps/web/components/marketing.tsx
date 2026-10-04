"use client";

import * as React from "react";
import { cn } from "@moraqat/ui";

/**
 * The marketing boundary (DESIGN-AUTHORITY 2026-10-02 amendment; audit
 * MRC-UX-AUDIT-2026-10-04 Part 05 "Glitter").
 *
 * Glitter — `.mesh-bg-rich`, `.btn-shine`, `.underline-marker` and the
 * <Sparkles> glints — is allowed on public marketing surfaces only. Instead of
 * trusting every screen to remember that, the CSS for those classes only
 * matches under a `.marketing` ancestor, and <Sparkles> renders nothing
 * outside this provider. Wrap a marketing page's root in <MarketingProvider>;
 * product UI (portal, vet, documents, welcome) never does.
 */
const MarketingContext = React.createContext(false);

export function useIsMarketing() {
  return React.useContext(MarketingContext);
}

export function MarketingProvider({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <MarketingContext.Provider value={true}>
      <div className={cn("marketing", className)}>{children}</div>
    </MarketingContext.Provider>
  );
}
