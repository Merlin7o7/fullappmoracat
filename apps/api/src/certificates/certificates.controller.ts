import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, StreamableFile, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { VetStaffGuard } from "../vet/guards/vet-staff.guard";
import { VetCapability } from "../vet/decorators/vet-capability.decorator";
import { VetActorParam, type VetActor } from "../vet/decorators/vet-actor.decorator";
import { VET_ORG_HEADER } from "../vet/guards/vet-staff.guard";
import { CertificatesService } from "./certificates.service";

/** Public: verify + the PDF itself (the verify token is what the document carries). */
@ApiTags("certificates")
@Controller("certificates")
export class CertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get("verify/:token")
  @ApiOperation({ summary: "Verify a certificate by its token (public)" })
  verify(@Param("token") token: string) {
    return this.certificates.verify(token);
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":token/pdf")
  @Header("Cache-Control", "private, no-store")
  @ApiOperation({ summary: "The certificate PDF (public by token)" })
  async pdf(@Param("token") token: string) {
    const doc = await this.certificates.pdf(token);
    return new StreamableFile(doc.buffer, {
      type: "application/pdf",
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      length: doc.buffer.length,
    });
  }
}

/** Owner: issue / fetch the certificate for one of their cats. */
@ApiTags("cats")
@ApiBearerAuth()
@Controller("cats")
export class OwnerCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Post(":id/certificate")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Issue a Cat ID certificate for my cat (needs a Cat ID)" })
  issue(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.certificates.issueForOwner(userId, id);
  }

  @Get(":id/certificate")
  @ApiOperation({ summary: "My cat's latest certificate, if one was issued" })
  latest(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.certificates.latestForOwner(userId, id);
  }
}

/** Clinic: issue a signed certificate for a patient it treats. */
@ApiTags("vet")
@ApiBearerAuth()
@ApiHeader({ name: VET_ORG_HEADER, description: "PartnerOrg id the caller is acting inside", required: true })
@UseGuards(VetStaffGuard)
@Controller("vet/patients")
export class VetCertificatesController {
  constructor(private readonly certificates: CertificatesService) {}

  @Post(":catId/certificate")
  @VetCapability("record.write")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Issue a clinic-signed Cat ID certificate for a patient" })
  issue(@VetActorParam() actor: VetActor, @Param("catId") catId: string) {
    return this.certificates.issueForClinic(actor, catId);
  }
}
