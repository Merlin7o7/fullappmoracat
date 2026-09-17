import { Global, Module } from "@nestjs/common";
import { SmsService } from "./sms.service";

/** Global: auth (OTP), clinic claims and found-cat relays all send SMS. */
@Global()
@Module({
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
