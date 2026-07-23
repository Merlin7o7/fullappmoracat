import { Controller, Get, Param } from "@nestjs/common";
import { ApiTags, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { PlansService } from "./plans.service";
import { Public } from "../common/decorators/public.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("plans")
@Controller("plans")
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  // These are anonymous price lists — 199/219/329/479, market value, savings, and the
  // supplier catalog behind the box. Publishing a price for something nobody can
  // buy claims the product does something it doesn't (R040), and a shelf that
  // says "soon" is honest where a live price tag is not (R006).
  @Public()
  @Commercial()
  @Get()
  @ApiOkResponse({ description: "List all active subscription plans with box contents" })
  findAll() {
    return this.plans.findAll();
  }

  @Public()
  @Commercial()
  @Get(":id/box")
  @ApiOperation({ summary: "Box builder: each line + choosable brand/flavor options" })
  box(@Param("id") id: string) {
    return this.plans.box(id);
  }
}
