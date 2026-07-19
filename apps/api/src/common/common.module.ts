import { Global, Module } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";

/**
 * Cross-cutting primitives that several domains need.
 *
 * Global so the money paths (checkout, subscriptions) and any future
 * side-effectful endpoint can depend on idempotency without every module having
 * to re-import it — replay safety should be the easy default, not a per-module
 * decision somebody can forget to make.
 */
@Global()
@Module({
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class CommonModule {}
