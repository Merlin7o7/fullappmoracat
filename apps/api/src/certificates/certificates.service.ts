import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { Prisma } from "@moraqat/db";
import { deriveVaccinationStatus } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { EventsService } from "../events/events.service";
import { apiBase } from "../files/files.service";
import type { VetActor } from "../vet/decorators/vet-actor.decorator";
import { renderCertificatePdf, type CertificateSnapshot } from "./certificate-pdf";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Cat ID certificates (MRC-PROD-001 T9).
 *
 * A certificate is a frozen snapshot: what the record said at the moment of
 * issue, numbered and signed with an unguessable verify token. The PDF is
 * rendered lazily from that snapshot (and cached privately), so the document
 * in someone's hand always matches what the verify page says.
 */
@Injectable()
export class CertificatesService {
  private readonly logger = new Logger("Certificates");

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsService
  ) {}

  /** The owner asks for their cat's certificate. */
  async issueForOwner(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, userId, deletedAt: null, claimStatus: "CLAIMED" },
      select: { id: true, catIdNumber: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    if (!cat.catIdNumber) {
      throw new BadRequestException({ code: "CAT_ID_NOT_ISSUED", message: "This cat doesn't have a Cat ID yet." });
    }
    return this.issue(cat.id, { userId });
  }

  /**
   * A partner clinic issues one for a patient it treats. Only a LIVE clinic
   * with a treatment relationship (an opened visit) may sign a certificate;
   * the clinic's name then appears as the issuer.
   */
  async issueForClinic(actor: VetActor, catId: string) {
    if (actor.orgStatus !== "LIVE") {
      throw new ForbiddenException({ code: "VET_ORG_NOT_LIVE", message: "Only a live clinic can issue certificates." });
    }
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, deletedAt: null, isDemo: actor.orgIsDemo },
      select: { id: true, catIdNumber: true, claimStatus: true },
    });
    if (!cat) throw new NotFoundException("Patient not found");
    const treated = await this.prisma.visit.count({ where: { catId: cat.id, orgId: actor.orgId } });
    if (treated === 0) {
      throw new ForbiddenException({ code: "VET_NO_RELATIONSHIP", message: "This clinic has no visit on record for that patient." });
    }
    if (!cat.catIdNumber || cat.claimStatus !== "CLAIMED") {
      throw new BadRequestException({
        code: "CAT_ID_NOT_ISSUED",
        message: "The owner hasn't claimed this cat yet — the Cat ID is issued at claim.",
      });
    }
    return this.issue(cat.id, { orgId: actor.orgId, userId: actor.userId });
  }

  private async issue(catId: string, by: { userId?: string; orgId?: string }) {
    const cat = await this.prisma.cat.findUniqueOrThrow({
      where: { id: catId },
      select: {
        id: true,
        name: true,
        catIdNumber: true,
        gender: true,
        birthDate: true,
        microchipNo: true,
        coatColor: true,
        breed: { select: { nameAr: true, nameEn: true } },
        vaccinations: {
          orderBy: { administeredAt: "desc" },
          take: 40,
          select: { name: true, administeredAt: true, dueAt: true, clinic: true, orgId: true },
        },
      },
    });
    const orgIds = [...new Set(cat.vaccinations.map((v) => v.orgId).filter((x): x is string => !!x))];
    const orgs = orgIds.length
      ? await this.prisma.partnerOrg.findMany({ where: { id: { in: orgIds } }, select: { id: true, nameAr: true, nameEn: true } })
      : [];
    const orgById = new Map(orgs.map((o) => [o.id, o]));
    const issuer = by.orgId
      ? await this.prisma.partnerOrg.findUnique({ where: { id: by.orgId }, select: { nameAr: true, nameEn: true } })
      : null;

    const snapshot: CertificateSnapshot = {
      catName: cat.name,
      catIdNumber: cat.catIdNumber ?? "",
      breed: cat.breed ? { ar: cat.breed.nameAr, en: cat.breed.nameEn } : null,
      gender: cat.gender ?? null,
      birthDate: cat.birthDate?.toISOString() ?? null,
      microchipNo: cat.microchipNo ?? null,
      coatColor: cat.coatColor ?? null,
      vaccinations: cat.vaccinations.map((v) => {
        const org = v.orgId ? orgById.get(v.orgId) : null;
        return {
          name: v.name,
          administeredAt: v.administeredAt.toISOString(),
          dueAt: v.dueAt?.toISOString() ?? null,
          clinic: org ? { ar: org.nameAr, en: org.nameEn } : v.clinic ? { ar: v.clinic, en: v.clinic } : null,
          verified: !!v.orgId,
        };
      }),
      issuedBy: issuer ? { ar: issuer.nameAr, en: issuer.nameEn } : null,
    };

    const number = `MRC-CERT-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const verifyToken = randomBytes(18).toString("base64url");
    const cert = await this.prisma.certificate.create({
      data: {
        catId: cat.id,
        number,
        verifyToken,
        kind: "CAT_ID",
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        issuedByOrgId: by.orgId ?? null,
        issuedByUserId: by.userId ?? null,
      },
      select: { id: true, number: true, verifyToken: true, issuedAt: true },
    });
    this.events.emit("certificate_issued", {
      userId: by.userId,
      catId: cat.id,
      orgId: by.orgId,
      props: { by: by.orgId ? "clinic" : "owner", vaccinations: snapshot.vaccinations.length },
    });
    return this.present(cert);
  }

  /** Public verification — never more than what the certificate itself shows. */
  async verify(token: string) {
    const cert = await this.prisma.certificate.findUnique({
      where: { verifyToken: token },
      select: {
        id: true,
        number: true,
        kind: true,
        snapshot: true,
        issuedAt: true,
        revokedAt: true,
        catId: true,
        issuedByOrg: { select: { nameAr: true, nameEn: true } },
      },
    });
    if (!cert) return { valid: false as const };
    const snap = cert.snapshot as unknown as CertificateSnapshot;
    const standing = deriveVaccinationStatus(
      snap.vaccinations.map((v) => ({ administeredAt: new Date(v.administeredAt), dueAt: v.dueAt ? new Date(v.dueAt) : null }))
    ).standing;
    this.events.emit("certificate_verified", { catId: cert.catId, props: { valid: !cert.revokedAt } });
    return {
      valid: !cert.revokedAt,
      revoked: !!cert.revokedAt,
      number: cert.number,
      kind: cert.kind,
      catName: snap.catName,
      catIdNumber: snap.catIdNumber,
      breed: snap.breed,
      issuedAt: cert.issuedAt,
      issuedBy: cert.issuedByOrg ? { ar: cert.issuedByOrg.nameAr, en: cert.issuedByOrg.nameEn } : null,
      vaccinationStanding: standing,
      verifiedVaccinations: snap.vaccinations.filter((v) => v.verified).length,
      totalVaccinations: snap.vaccinations.length,
    };
  }

  /** The PDF, rendered from the frozen snapshot and cached privately. */
  async pdf(token: string): Promise<{ buffer: Buffer; fileName: string }> {
    const cert = await this.prisma.certificate.findUnique({
      where: { verifyToken: token },
      select: { id: true, number: true, snapshot: true, issuedAt: true, pdfKey: true, revokedAt: true },
    });
    if (!cert || cert.revokedAt) throw new NotFoundException("Certificate not found");
    const fileName = `moracat-certificate-${cert.number}.pdf`;
    if (cert.pdfKey) {
      try {
        return { buffer: await this.storage.getPrivate(cert.pdfKey), fileName };
      } catch {
        /* cache miss — re-render below */
      }
    }
    const snap = cert.snapshot as unknown as CertificateSnapshot;
    const buffer = await renderCertificatePdf({
      ...snap,
      number: cert.number,
      issuedAt: cert.issuedAt.toISOString(),
      verifyUrl: `${SITE()}/certificates/verify/${token}`,
    });
    try {
      const key = this.storage.buildPrivateKey(`certificates/${cert.id}`, "pdf");
      await this.storage.putPrivate(key, buffer, "application/pdf");
      await this.prisma.certificate.update({ where: { id: cert.id }, data: { pdfKey: key } });
    } catch (e) {
      this.logger.warn(`certificate ${cert.number} not cached: ${(e as Error).message}`);
    }
    return { buffer, fileName };
  }

  /** The owner's latest live certificate for a cat, if any. */
  async latestForOwner(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({ where: { id: catId, userId, deletedAt: null }, select: { id: true } });
    if (!cat) throw new NotFoundException("Cat not found");
    const cert = await this.prisma.certificate.findFirst({
      where: { catId: cat.id, revokedAt: null },
      orderBy: { issuedAt: "desc" },
      select: { id: true, number: true, verifyToken: true, issuedAt: true },
    });
    return cert ? this.present(cert) : null;
  }

  private present(cert: { id: string; number: string; verifyToken: string; issuedAt: Date }) {
    return {
      id: cert.id,
      number: cert.number,
      issuedAt: cert.issuedAt,
      verifyUrl: `${SITE()}/certificates/verify/${cert.verifyToken}`,
      pdfUrl: `${apiBase()}/api/certificates/${cert.verifyToken}/pdf`,
    };
  }
}
