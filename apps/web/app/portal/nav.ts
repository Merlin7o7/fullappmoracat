import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Repeat, Cat, Package, MapPin, Settings, Users, LifeBuoy, Bell, ShieldCheck,
  Heart, Search, ArrowRightLeft,
} from "lucide-react";
import { commerceEnabled } from "@/lib/features";

export interface PortalNavItem {
  href: string;
  icon: LucideIcon;
  en: string;
  ar: string;
  /** Exact-match the pathname (used only for the /portal root). */
  exact?: boolean;
  /** Surfaced in the mobile thumb-zone bar; the rest live behind "More". */
  primary?: boolean;
  /** A commercial surface — hidden entirely while payments are disabled. */
  commercial?: boolean;
}

/**
 * The single source of portal navigation truth — consumed by both the desktop
 * rail and the mobile bottom nav so they never drift. Order is the desktop
 * order; `primary` picks the ≤5 mobile thumb-zone tabs (R100).
 */
export const PORTAL_NAV: PortalNavItem[] = [
  { href: "/portal", icon: LayoutDashboard, en: "Overview", ar: "نظرة عامة", exact: true, primary: true },
  { href: "/portal/cats", icon: Cat, en: "My Cats", ar: "قططي", primary: true },
  { href: "/portal/community", icon: Users, en: "Community", ar: "المجتمع", primary: true },
  // The cat's life beyond this household (2026-09-20). Adoption and Lost &
  // Found sit beside Community because they are the same idea — this cat, and
  // the people around them — not a separate marketplace section.
  { href: "/portal/adoption", icon: Heart, en: "Adoption", ar: "التبني" },
  // In the thumb zone on a phone: a member whose cat just slipped out of the
  // door must never have to look under "More" (R100; the emergency outranks
  // every other destination).
  { href: "/portal/lost-found", icon: Search, en: "Lost & Found", ar: "مفقود وموجود", primary: true },
  // Hand-overs in flight. Quiet by design: most members never see one, but a
  // cat waiting to be accepted must never be invisible.
  { href: "/portal/transfers", icon: ArrowRightLeft, en: "Hand-overs", ar: "نقل الملكية" },
  { href: "/portal/notifications", icon: Bell, en: "Notifications", ar: "الإشعارات" },
  // Who may open your cat's medical record — and a ledger of everyone who has.
  // Privacy is only real if the member can find it (R106).
  { href: "/portal/health-access", icon: ShieldCheck, en: "Health access", ar: "الوصول الطبي" },
  { href: "/portal/subscriptions", icon: Repeat, en: "Subscriptions", ar: "الاشتراكات", commercial: true },
  { href: "/portal/orders", icon: Package, en: "Orders", ar: "الطلبات", commercial: true },
  // Delivery addresses exist for orders; with nothing for sale they are a
  // door onto an empty room, so they follow the commerce switch (R040).
  { href: "/portal/addresses", icon: MapPin, en: "Addresses", ar: "العناوين", commercial: true },
  { href: "/portal/support", icon: LifeBuoy, en: "Support", ar: "الدعم" },
  { href: "/portal/settings", icon: Settings, en: "Settings", ar: "الإعدادات" },
];

/** Nav items visible in the current commerce mode (drops commercial surfaces in beta). */
export function visiblePortalNav(): PortalNavItem[] {
  const commerce = commerceEnabled();
  return PORTAL_NAV.filter((item) => commerce || !item.commercial);
}
