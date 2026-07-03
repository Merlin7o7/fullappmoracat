import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("geo")
@Controller()
export class GeoController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get("cities")
  @ApiOperation({ summary: "List active delivery cities" })
  async cities() {
    const cities = await this.prisma.city.findMany({
      where: { isActive: true },
      orderBy: { nameEn: "asc" },
      select: { id: true, slug: true, nameEn: true, nameAr: true },
    });
    return cities;
  }
}
