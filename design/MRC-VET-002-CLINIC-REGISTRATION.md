# MRC-VET-002 — Clinic Registration Process

**Version:** 1.1 · **Date:** 2026-09-16 · **Status:** Built (branch `feat/vet-clinic-registration`) — see "As built" below
**Authorities:** `DESIGN-AUTHORITY.md` (R001–R120), `moracat-vet-portal-dossier.html` (MRC-VET-001 §01 partner journey, §02 invitations)

## Founder decisions (2026-09-16)

| Decision | Choice |
|---|---|
| Entry point | **Admin invite only.** No public application form. Every clinic is hand-invited by Moracat. |
| Staff/doctor invites | **Sent immediately at submission.** Accounts exist early; record access still waits for approval. |
| Terms signing | **Click-accept + typed name.** The signatory's name and title, a checkbox, the terms version, a hash of the exact text shown, time, IP and user agent. |
| CR verification | **Manual review** of the uploaded certificate. Wathq API deferred until volume justifies it. |

## Why this exists: the current chain is broken

1. `/vet/apply` posts `clinicNameAr/city/phone/email/why`; `ApplyDto` expects `clinicName/cityId/contactPhone/contactEmail/notes`. `forbidNonWhitelisted` makes every submission 400, so no application has ever been saved.
2. The admin pages (`app/admin/partners/*`) fetch `/admin/vet/*`, but the controller is `@Controller("vet/admin")`. They also use statuses that don't exist (`PENDING`, `ACTIVE`, `UNVERIFIED`), read fields the API doesn't return (`orgNameEn`, `branchCount`, `city` as a string), call `access-log` when the route is `access-logs`, and approve with `{}` although `nameAr` is required.
3. There is no admin "invite clinic" action, no owner setup UI (branches/staff/documents), no terms acceptance (`PartnerAgreement` is never written), and uploads are image-only (`POST /uploads/image`).

## Status machine

```
INVITED ──► REGISTERING ──► SUBMITTED ──► IN_REVIEW ──► APPROVED ──► LIVE
   │             ▲                            │
   │             └──── CHANGES_REQUESTED ◄────┤
   ▼                                          ▼
REVOKED / EXPIRED                          REJECTED (reason required)
LIVE ──► SUSPENDED (reason required) ──► APPROVED (re-going live is a second act)
```

Staff work is only possible in `APPROVED` or `LIVE` (`WORKABLE_ORG_STATUSES` in `vet-staff.guard.ts`). Staff invited at submission can accept and set a password, but the portal must show them a calm **"your clinic is under review"** screen, never an error (R084).
**Resolved at build:** record access waits for `LIVE`. `APPROVED` is a **setup sandbox** (`SETUP_SANDBOX_CAPABILITIES` in `packages/core/src/vet-permissions.ts`): search only, plus staff/branch/settings/device setup. It is also demo-quarantined, so its search can only ever resolve demo cats. Any other capability is refused with `VET_ORG_NOT_LIVE` (`sandbox: true`).

## As built (2026-09-16)

These differ from the plan below. The code is the authority.

- **Wizard steps:** account → clinic → **branches** (address, census city, map pin, hours, **MEWA licence number and expiry**) → **documents** (CR for the org, MEWA licence per branch, optional VAT/insurance/other) → team → terms. The licence number lives with its branch, and the upload lives in the documents step.
- **City:** branches store `cityCode` from the census city list (`packages/core/src/saudi-cities.ts`), so a clinic can be anywhere in the Kingdom. `cityId` is set only when a matching delivery city exists.
- **Single source of rules:** `packages/core/src/vet-registration.ts` holds the steps, Saudi format rules, `registrationGaps()` (the one completeness check the API and wizard share), `GO_LIVE_ITEMS`, and the versioned bilingual terms (`VET_PARTNER_AGREEMENT`, `VET_PDPL_ADDENDUM`, `VET_STAFF_CONFIDENTIALITY`). The API hashes `canonicalTermsText()`.
- **API:**
  - `vet/admin/clinics/*`: invite, list, detail, resend/revoke, document file/verify, request-changes, approve, reject.
  - `vet/registration/*`: public preview and account, authed claim/state/clinic/branches/documents/team/submit.
  - `vet/org/onboarding/*`: checklist, confirm-branches, request-go-live.
  - `vet/auth/invite/claim`: staff account creation with the confidentiality undertaking.
  - `POST /vet/apply` now answers **410** `VET_APPLY_RETIRED`.
- **Approval implies verification:** approve requires every required document to be verified and sets `verifiedAt`. Go-live (`vet/admin/orgs/:id/go-live`) is gated on `testScanAt` and publishes active branches with an unexpired licence to the directory.
- **Test scan:** an `APPROVED` clinic resolving a demo cat by exact identifier in patient search stamps `testScanAt`. Demo cats come from `db:seed:vet-demo`, so **prod must have the demo seed** for clinics to pass the gate.
- **Compliance cron:** `VetComplianceService` runs daily at 06:00 Riyadh. It sends licence and CR warnings at 60/30/7 days, and hides branches with an expired licence from the directory.
- **Documents:** stored under `private/vet/<orgId>/…` with 256-bit keys. They go to `S3_PRIVATE_BUCKET` when set, otherwise the main bucket, and are read only through the authorised API proxy.
- **Optional env:** `PARTNERS_NOTIFY_EMAIL` (ops inbox for new submissions and go-live requests), `S3_PRIVATE_BUCKET`.
- **Dev/test only:** invite endpoints return `devToken` / `devInviteTokens` outside production, so e2e can follow emailed links.

## Phase 0: stop the bleeding

- Rewire `app/admin/partners/page.tsx` and `[id]/page.tsx` to `/vet/admin/*`. Real statuses. Response types go through `lib/vet-wire.ts` adapters with no `as` casts (same discipline as the 2026-08-23 vet fix).
- Admin detail: add **Go live** and **Unverify** actions. Make the reject/suspend reasons match the DTOs.
- Retire the public apply door (admin-invite-only decision):
  - `/vet/apply` becomes an "invitation-only — contact us" page.
  - Remove it from `robots.ts` allow, `sitemap.ts`, the footer, the vet login and the vet-directory CTA.
  - `POST /vet/apply` returns 410.
- e2e: admin lists orgs, admin detail loads, approve works.

## Phase 1: admin invites a clinic

`/admin/partners` gets the primary button **دعوة عيادة / Invite clinic**.

- Fields: clinic name (ar, required; en optional), contact person, email, mobile (+966), tier (founding/standard), internal note.
- Creates a registration record in `INVITED`, plus a single-use token (hashed at rest, like `PartnerInvite`) with a **14-day expiry**.
- Sends a bilingual email (Arabic first): who invited them, what they'll need ready (CR certificate, MEWA licence, doctor details), and the link.
- Admin list shows invited clinics with **Resend** / **Revoke** / days remaining.
- CR uniqueness is checked at invite (if known) and again at submission.
- Permission: `partners.write`. Every action is audited.

## Phase 2: registration wizard (`/vet/register/[token]`)

Arabic default, RTL-native (R101), mobile-first. Autosaves after every step and can be resumed from the same link (R117). A progress rail shows 6 steps; every step can be revisited until submission.

1. **Owner account**
   - Full name (ar/en), mobile with OTP confirmation, password.
   - The email is fixed to the invited address (changing it requires admin).
   - An existing Moracat account is linked, never duplicated.
2. **Clinic legal information**
   - Legal entity name exactly as on the CR (ar + en), and the public clinic name (ar + en).
   - CR number (10 digits), unified national number (700…), CR expiry date, **CR certificate upload**.
   - VAT number and certificate (optional).
   - Logo (optional).
3. **Veterinary licence**
   - MEWA veterinary facility licence number, expiry date, **licence upload**.
   - One licence per branch if branches are licensed separately.
4. **Location and branches** (one or more)
   - Branch name (ar/en), city, district, street address, **National Address short code**, map pin (lat/lng + Maps URL).
   - Branch phone and email, opening hours per day, 24h emergency, services/specialties.
5. **Doctors and staff** (repeatable rows)
   - Full name (ar/en), email, mobile, role (`VET_SENIOR` / `VET` / `INTERN` / `VET_TECH` / `RECEPTION` / `MANAGER` / `FINANCE`), branch scope.
   - Doctors (`VET_SENIOR` / `VET` / `INTERN`) also need a **practitioner licence number + expiry** (upload optional).
   - Validation: unique emails and mobiles within the clinic; at least one doctor required.
6. **Review and terms**
   - Full read-only summary with "edit" links per section.
   - Shows the **Partner Agreement** and **PDPL data-processing addendum** (current version, ar/en, scrollable).
   - Signatory full name, job title, checkbox "I am authorised to bind this clinic and accept these terms".
   - Submit writes `PartnerAgreement`: version, contentHash, signedByName, signedByTitle, acceptedByUserId, IP, user agent, signedAt.

**On submit:**
- Status becomes `SUBMITTED`.
- **Staff invites are sent immediately** (bilingual, 7-day expiry, resendable).
- Owner gets a receipt email; admin gets a notification.
- The owner lands on a status page ("قيد المراجعة") that names what happens next and the expected review time.

## Phase 3: admin review

`/admin/partners/[id]` becomes the review workspace.

- Every section of the submission, with each document opened through a short-lived signed link.
- A **verify tick per document** (CR, VAT, MEWA licence per branch, doctor licences), each with expiry date and a warning badge.
- Staff roster with invite status (sent / accepted / expired).
- The signed agreement: version, signatory, timestamp, IP.

Actions:
- **Request changes**: a note plus the steps to reopen. Status becomes `CHANGES_REQUESTED`, the wizard reopens those steps, the owner is emailed.
- **Approve**: allowed only when every required document is ticked. Status becomes `APPROVED`, staff seats activate for those who accepted, owner and staff are emailed.
- **Reject**: reason required. Status becomes `REJECTED`, the owner is emailed, and pending staff invites are revoked.

## Phase 4: doctor and staff onboarding

- Invite email → `/vet/invite?token=`: set password (or link an existing account) → **staff confidentiality acknowledgment** (one screen, PDPL, plain language, versioned + stored) → role-tailored first screen.
- Before approval they see "clinic under review". After approval they get the full portal per the capability matrix.
- Owner can resend or revoke invites and add or remove staff (in-portal staff page; the API exists at `/vet/staff/*`).

## Phase 5: go-live checklist (owner portal)

1. Confirm branches and hours
2. Register the counter device(s)
3. Staff set their PINs
4. **One successful test scan** of the demo cat (hard gate)

When the checklist is complete, admin gets a "ready for go-live" signal, then clicks **Go live** + **Verify** and the branch appears in `/vet-directory`.

Ongoing: licence/CR expiry warnings at 60/30/7 days. An expired MEWA licence auto-hides that branch from the directory.

## Data model changes (one migration)

- `PartnerOrg`:
  - Status gains `INVITED`, `REGISTERING`, `SUBMITTED`, `CHANGES_REQUESTED`, `REJECTED`.
  - New fields: `legalNameAr`, `legalNameEn`, `unifiedNumber`, `crExpiresAt`, `changesRequestedNote`, `changesRequestedSteps`, `invitedById`, `submittedAt`.
- `ClinicRegistrationInvite`: orgId, email, contactName, phone, tokenHash, expiresAt, acceptedAt, revokedAt, invitedById.
- `Branch`: `district`, `nationalAddressCode`.
- `OrgDocument` (org-level CR/VAT; `BranchDocument` stays for the MEWA licence): kind, fileKey, number, issuedAt, expiresAt, verifiedAt, verifiedById.
- `PartnerInvite`: `fullNameAr`, `fullNameEn`, `phone`, `licenceNo`, `licenceExpiresAt`, `branchIds`.
- `PartnerStaff`: `licenceExpiresAt`, `confidentialityAcceptedAt`, `confidentialityVersion`.
- `PartnerAgreement`: `termsVersion`, `contentHash`, `signedByTitle`, `acceptedByUserId`, `ipAddress`, `userAgent`.
- `PartnerApplication`: kept read-only for history (public apply retired).

## Document uploads

- New `POST /vet/register/:token/documents` (and an authenticated equivalent).
- PDF/JPG/PNG, ≤10MB, MIME sniffed server-side.
- **Private R2 bucket/prefix**, never the public cat-photo path.
- Read only through signed URLs with a ≤5-minute TTL, issued to the owner of that clinic or to admins with `partners.read`.
- Account deletion / offboarding follows the PDPL retention rule (to be defined in the addendum).

## Terms content (draft by Claude, **lawyer review before first real clinic**)

**Partner Agreement:**
- Parties: Moracat legal entity from `lib/org.ts`.
- Clinic obligations: honour the stated member benefit; keep licences valid; notify changes.
- No payments from Moracat to clinics in v1.
- Record access only for treating the member's cat.
- Append-only medical records.
- Audit ledger visible to owners.
- Suspension grounds.
- 12-month term, auto-renew, 30-day exit either side.
- Brand usage.
- Moracat is not a medical provider (liability).
- Governing law: KSA.

**PDPL addendum:** roles (controller/processor per data type), purpose limitation, confidentiality of staff, breach notification, retention, deletion on exit.

**Staff acknowledgment:** a one-screen summary of the confidentiality duties.

## Verification per phase

Two-pass `pnpm e2e` grows each phase:
- invite → wizard autosave/resume → document upload → submit → staff invite accepted pre-approval gets "under review" → request changes → resubmit → approve → record access allowed → go-live gate blocks without test scan.
- Browser-verify every step in **Arabic and English**, mobile width.

## Build order

Phase 0 → 1 → 2 → 3 → 4 → 5. Phases 0–1 are small; Phase 2 is the bulk (wizard + uploads + migration).
