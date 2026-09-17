import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { CertificatesService } from "./certificates.service";
import { CertificatesController, OwnerCertificatesController, VetCertificatesController } from "./certificates.controller";

/** Cat ID certificates: issue (owner / clinic), public verify, PDF (T9). */
@Module({
  // JwtModule for VetStaffGuard (counter-mode sessions), as vet-clinical does.
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [CertificatesController, OwnerCertificatesController, VetCertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
