import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
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

  @Public()
  @Get(":id/box")
  @ApiOperation({ summary: "Box builder: each line + choosable brand/flavor options" })
  box(@Param("id") id: string) {
    return this.plans.box(id);
  }
}
