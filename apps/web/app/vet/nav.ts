import type { LucideIcon } from "lucide-react";
import { Sun, ClipboardList, Cat, ScanLine, ShieldAlert, FileKey } from "lucide-react";
import type { VetCapability } from "@moraqat/core";

/**
 * The single source of vet-portal navigation truth — read by the desktop rail,
 * the mobile tab bar, and the command shortcuts, so they can never drift.
 *
 * Two rules from the dossier are encoded here rather than in the components:
 *
 *  1. **Permission-aware IA, not greyed-out noise (§14).** A receptionist's nav
 *     shows what a receptionist does; she never sees a clinical destination she
 *     will be refused at. `capability` filters the list, it does not disable it.
 *  2. **The spine is the omnibox, not this list (§03).** Navigation is
 *     supporting cast: five destinations, one level deep, no chrome competing
 *     with the lookup box.
 */
export interface VetNavItem {
  href: string;
  icon: LucideIcon;
  en: string;
  ar: string;
  /** Exact-match the pathname (used only for the /vet root — Today). */
  exact?: boolean;
  /** Surfaced in the mobile thumb-zone bar; the rest live behind "More". */
  primary?: boolean;
  /** Hidden entirely unless the actor holds this capability. */
  capability?: VetCapability;
  /** Linear-style `g` then key jump. */
  shortcut?: string;
}

export const VET_NAV: VetNavItem[] = [
  { href: "/vet", icon: Sun, en: "Today", ar: "اليوم", exact: true, primary: true, shortcut: "t" },
  { href: "/vet/scan", icon: ScanLine, en: "Scan", ar: "مسح", primary: true, capability: "patient.search", shortcut: "s" },
  { href: "/vet/visits", icon: ClipboardList, en: "Visits", ar: "الزيارات", primary: true, capability: "visit.open", shortcut: "v" },
  { href: "/vet/patients", icon: Cat, en: "Patients", ar: "المرضى", primary: true, capability: "patient.view", shortcut: "p" },
  { href: "/vet/emergency", icon: ShieldAlert, en: "Emergency", ar: "الطوارئ", capability: "emergency.access", shortcut: "e" },
  { href: "/vet/consent", icon: FileKey, en: "Consent & access", ar: "الأذونات والسجل", capability: "patient.view", shortcut: "c" },
];

/**
 * The destinations this actor can actually use. Pass the capability predicate
 * from `useVetActor().can` — the same pure function the API guard runs, so the
 * interface and the authorisation can never disagree.
 */
export function visibleVetNav(can: (c: VetCapability) => boolean): VetNavItem[] {
  return VET_NAV.filter((item) => !item.capability || can(item.capability));
}
