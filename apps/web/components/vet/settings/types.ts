/**
 * Wire types for the clinic-settings surface. Each mirrors the response built
 * in the named API service FIELD FOR FIELD (the lesson of lib/vet-wire.ts: a
 * hand-imagined response type is how the portal once failed to match its own
 * API). Dates arrive as ISO strings over JSON.
 */

import type { VetRole } from "@moraqat/core";

type ISO = string;
type Bilingual = { ar: string; en: string };

/** GET /vet/org/branches — `VetOrgService.listBranches`. */
export interface OrgBranch {
  id: string;
  nameEn: string;
  nameAr: string;
  addressLine: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  phone: string | null;
  email: string | null;
  /** `[{ day: 0–6 (Sunday first), open?, close?, closed? }]` — rendered, never parsed for logic. */
  hours: unknown;
  emergency24h: boolean;
  directoryVisible: boolean;
  licenceNo: string | null;
  licenceExpiresAt: ISO | null;
  isActive: boolean;
  city: { id: string; nameEn: string; nameAr: string } | null;
  deviceCount: number;
  licenceExpiringSoon?: boolean;
}

/** GET /vet/org/devices — `VetOrgService.listDevices`. */
export interface CounterDevice {
  id: string;
  name: string;
  lastSeenAt: ISO | null;
  revokedAt: ISO | null;
  createdAt: ISO;
  branch: { id: string; nameEn: string; nameAr: string };
  registeredBy: string | null;
  active: boolean;
}

/** POST /vet/org/branches/:branchId/devices — `VetOrgService.registerDevice`. */
export interface RegisteredDevice {
  id: string;
  name: string;
  branchId: string;
  createdAt: ISO;
}

export type StaffStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";

/** GET /vet/staff — `VetStaffService.list`. */
export interface StaffRow {
  id: string;
  role: VetRole;
  roleLabel: Bilingual;
  status: StaffStatus;
  title: string | null;
  licenceNo: string | null;
  hasCounterPin: boolean;
  joinedAt: ISO | null;
  offboardedAt: ISO | null;
  createdAt: ISO;
  isSelf: boolean;
  user: { id: string; name: string | null; email: string; avatarUrl: string | null };
  branches: { id: string; nameEn: string; nameAr: string }[];
  capabilities: string[];
}

export interface StaffList {
  items: StaffRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/** GET /vet/staff/invites — `VetStaffService.listInvites`. */
export interface PendingInvite {
  id: string;
  email: string;
  fullName: string | null;
  role: VetRole;
  roleLabel: Bilingual;
  expiresAt: ISO;
  expired: boolean;
  createdAt: ISO;
  invitedBy: string | null;
}

/** GET /vet/staff/assignable-roles — `VetStaffService.assignable`. */
export interface AssignableRoles {
  roles: { role: VetRole; label: Bilingual; capabilities: string[] }[];
}
