import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { ProductsService } from "./products.service";
import { QueryProductsDto } from "./dto/query-products.dto";
import { Public } from "../common/decorators/public.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("products")
@Controller("products")
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // price / compareAtPrice make these a storefront, and a storefront with no
  // checkout is a promise the product can't keep during the census (R040).
  @Public()
  @Commercial()
  @Get()
  @ApiOperation({ summary: "List products with filters, sort and pagination" })
  findMany(@Query() query: QueryProductsDto) {
    return this.products.findMany(query);
  }

  @Public()
  @Commercial()
  @Get(":slug")
  @ApiOperation({ summary: "Get full product detail by slug" })
  findOne(@Param("slug") slug: string) {
    return this.products.findBySlug(slug);
  }
}
