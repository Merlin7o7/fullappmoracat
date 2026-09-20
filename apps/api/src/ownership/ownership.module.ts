import { Module } from "@nestjs/common";
import { OwnershipController } from "./ownership.controller";
import { OwnershipService } from "./ownership.service";

/**
 * Cat ID ownership transfer. Exported because adoption completes through it —
 * accepting an adoption request creates a transfer, so the two surfaces share
 * one transactional hand-over rather than each writing their own.
 */
@Module({
  controllers: [OwnershipController],
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
