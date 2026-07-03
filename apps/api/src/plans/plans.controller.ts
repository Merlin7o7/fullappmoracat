import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOkResponse } from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: "List all active subscription plans with box contents" })
  findAll() {
    return this.plans.findAll();
  }
}
