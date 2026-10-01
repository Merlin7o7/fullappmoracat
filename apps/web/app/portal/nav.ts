import type { LucideIcon } from "lucide-react";
import {
  Cat, HeartPulse, Compass, UserRound, CalendarCheck, ShieldCheck, Repeat, Package,
  Users, Heart, Search, Stethoscope, Bell, ArrowRightLeft, MapPin, LifeBuoy, Settings,
} from "lucide-react";
import { commerceEnabled } from "@/lib/features";

/**
 * Four destinations — قططي · العناية · اكتشف · حسابي (UX reassessment §3).
 *
 * The old portal had fourteen global destinations and the cat lived in a
 * drawer, so nothing about a cat accumulated anywhere. Now everything that
 * takes a catId lives INSIDE the cat (its profile at /portal/cats/[id]); the
 * four tabs are the only global places:
 *
 *   قططي    the cats themselves — the home is the household's cats, each
 *           opening onto its own profile.
 *   العناية  what needs doing for them: the care agenda across cats, clinic
 *           access, and the membership/box when commerce is on.
 *   اكتشف   the cats around them: lost & found, adoption, the community, clinics.
 *   حسابي   the person: notifications, hand-overs, addresses, settings, help.
 *
 * Same tabs on the desktop rail and the phone bar, so the model never changes
 * with the screen.
 */

export interface PortalNavChild {
  href: string;
  icon: LucideIcon;
  en: string;
  ar: string;
  /** A commercial surface — hidden entirely while payments are disabled (R040). */
  commercial?: boolean;
}

export interface PortalTab {
  key: "cats" | "care" | "discover" | "account";
  href: string;
  icon: LucideIcon;
  en: string;
  ar: string;
  /** Path prefixes this tab owns (active-state matching). */
  owns: string[];
  children: PortalNavChild[];
}

export const PORTAL_TABS: PortalTab[] = [
  {
    key: "cats",
    href: "/portal",
    icon: Cat,
    en: "My cats",
    ar: "قططي",
    owns: ["/portal/cats", "/portal/welcome"],
    children: [],
  },
  {
    key: "care",
    href: "/portal/care",
    icon: HeartPulse,
    en: "Care",
    ar: "العناية",
    owns: ["/portal/care", "/portal/health-access", "/portal/subscriptions", "/portal/subscribe", "/portal/checkout", "/portal/orders"],
    children: [
      { href: "/portal/care", icon: CalendarCheck, en: "This week", ar: "هذا الأسبوع" },
      // Who may open your cat's medical record — and everyone who has (R106).
      { href: "/portal/health-access", icon: ShieldCheck, en: "Clinic access", ar: "وصول العيادات" },
      { href: "/portal/subscriptions", icon: Repeat, en: "Membership", ar: "العضوية", commercial: true },
      { href: "/portal/orders", icon: Package, en: "Boxes & orders", ar: "الصناديق والطلبات", commercial: true },
    ],
  },
  {
    key: "discover",
    href: "/portal/discover",
    icon: Compass,
    en: "Discover",
    ar: "اكتشف",
    owns: ["/portal/discover", "/portal/lost-found", "/portal/adoption", "/portal/community"],
    children: [
      // First on purpose: a member whose cat just slipped out is one tap from it.
      { href: "/portal/lost-found", icon: Search, en: "Lost & Found", ar: "مفقود وموجود" },
      { href: "/portal/adoption", icon: Heart, en: "Adoption", ar: "التبنّي" },
      { href: "/portal/community", icon: Users, en: "Community", ar: "المجتمع" },
      { href: "/vet-directory", icon: Stethoscope, en: "Clinics", ar: "العيادات" },
    ],
  },
  {
    key: "account",
    href: "/portal/account",
    icon: UserRound,
    en: "Account",
    ar: "حسابي",
    owns: ["/portal/account", "/portal/notifications", "/portal/transfers", "/portal/addresses", "/portal/settings", "/portal/support"],
    children: [
      { href: "/portal/notifications", icon: Bell, en: "Notifications", ar: "الإشعارات" },
      // Quiet by design — most members never see one, but a cat waiting to be
      // accepted must never be invisible.
      { href: "/portal/transfers", icon: ArrowRightLeft, en: "Hand-overs", ar: "نقل الملكية" },
      { href: "/portal/addresses", icon: MapPin, en: "Addresses", ar: "العناوين", commercial: true },
      { href: "/portal/settings", icon: Settings, en: "Settings", ar: "الإعدادات" },
      { href: "/portal/support", icon: LifeBuoy, en: "Help", ar: "المساعدة" },
    ],
  },
];

/** Tabs with their children filtered for the current commerce mode. */
export function visiblePortalTabs(): PortalTab[] {
  const commerce = commerceEnabled();
  return PORTAL_TABS.map((t) => ({ ...t, children: t.children.filter((c) => commerce || !c.commercial) }));
}

/** Which tab owns this path. /portal itself (and anything unclaimed) is "cats". */
export function activeTabKey(pathname: string): PortalTab["key"] {
  for (const t of PORTAL_TABS) {
    if (t.key === "cats") continue;
    if (t.owns.some((p) => pathname === p || pathname.startsWith(p + "/"))) return t.key;
  }
  return "cats";
}
