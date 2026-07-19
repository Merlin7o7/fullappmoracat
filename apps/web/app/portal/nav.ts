import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Repeat, Cat, Package, MapPin, Settings, Users, LifeBuoy, Bell, Info, ShieldCheck,
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
  { href: "/portal/notifications", icon: Bell, en: "Notifications", ar: "الإشعارات" },
  // Who may open your cat's medical record — and a ledger of everyone who has.
  // Privacy is only real if the member can find it (R106).
  { href: "/portal/health-access", icon: ShieldCheck, en: "Health access", ar: "الوصول الطبي" },
  { href: "/portal/subscriptions", icon: Repeat, en: "Subscriptions", ar: "الاشتراكات", commercial: true },
  { href: "/portal/orders", icon: Package, en: "Orders", ar: "الطلبات", commercial: true },
  { href: "/portal/addresses", icon: MapPin, en: "Addresses", ar: "العناوين" },
  { href: "/portal/support", icon: LifeBuoy, en: "Support", ar: "الدعم", primary: true },
  { href: "/portal/settings", icon: Settings, en: "Settings", ar: "الإعدادات" },
  { href: "/about", icon: Info, en: "About Moracat", ar: "عن مرقط" },
];

/** Nav items visible in the current commerce mode (drops commercial surfaces in beta). */
export function visiblePortalNav(): PortalNavItem[] {
  const commerce = commerceEnabled();
  return PORTAL_NAV.filter((item) => commerce || !item.commercial);
}
