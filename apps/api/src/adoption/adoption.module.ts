import { Module } from "@nestjs/common";
import { AdoptionController } from "./adoption.controller";
import { AdoptionService } from "./adoption.service";
import { OwnershipModule } from "../ownership/ownership.module";

/**
 * Adoption sits on top of ownership rather than beside it: completing an
 * adoption creates a Cat ID transfer through OwnershipService, so there is
 * exactly one transactional path by which a cat changes hands.
 */
@Module({
  imports: [OwnershipModule],
  controllers: [AdoptionController],
  providers: [AdoptionService],
  exports: [AdoptionService],
})
export class AdoptionModule {}
