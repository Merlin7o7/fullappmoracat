import { Global, Module } from "@nestjs/common";
import { TurnstileService } from "./turnstile.service";
import { TurnstileGuard } from "./turnstile.guard";
import { CensusIntegrityService } from "./census-integrity.service";

/**
 * Census-integrity + bot-protection primitives, exposed app-wide.
 *
 * Global so any controller can `@UseGuards(TurnstileGuard)` and any service can
 * inject `CensusIntegrityService` without threading imports through every
 * feature module. All three are cheap singletons and env-gated to no-ops when
 * their infra isn't provisioned.
 */
@Global()
@Module({
  providers: [TurnstileService, TurnstileGuard, CensusIntegrityService],
  exports: [TurnstileService, TurnstileGuard, CensusIntegrityService],
})
export class SecurityModule {}
