import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: "List products with filters, sort and pagination" })
  findMany(@Query() query: QueryProductsDto) {
    return this.products.findMany(query);
  }

  @Public()
  @Get(":slug")
  @ApiOperation({ summary: "Get full product detail by slug" })
  findOne(@Param("slug") slug: string) {
    return this.products.findBySlug(slug);
  }
}
