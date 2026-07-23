import { Injectable, NotFoundException } from "@nestjs/common";
import type { ProductType } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { MAX_CATS_PER_SUBSCRIPTION } from "../common/config/pricing";

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** All active plans with their box contents, ordered for display. */
  async findAll() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { contents: { orderBy: { label: "asc" } } },
    });

    // Serialise Decimals to numbers for a clean JSON contract.
    return plans.map((p) => ({
      id: p.id,
      tier: p.tier,
      slug: p.slug,
      nameEn: p.nameEn,
      nameAr: p.nameAr,
      descriptionEn: p.descriptionEn,
      descriptionAr: p.descriptionAr,
      price: Number(p.basePrice), // monthly price, first cat included
      // Each ADDITIONAL cat in the household (MRC-FIN-002 §5); null = single-cat.
      modulePriceSar: p.modulePriceSar == null ? null : Number(p.modulePriceSar),
      maxCats: p.modulePriceSar == null ? 1 : MAX_CATS_PER_SUBSCRIPTION,
      minTermMonths: p.minTermMonths,
      // cogs is an internal margin figure — never serialised to the public plans
      // endpoint. Exposing it lets anyone compute our per-box margin (R006).
      currency: p.currency,
      // Our own shelf value (in-app ledger, R041)…
      retailValue: p.retailValue == null ? null : Number(p.retailValue),
      // …and the MARKET benchmark basket — the honest, advertisable comparison
      // (MRC-FIN-002 §7.5): verified five-store sweep prices, seeded per SKU
      // and gated by the box-economics invariants, so a savings claim can never
      // outrun what the market data supports (R006). Negative marketSavings is
      // serialised as null — a necessity tier priced at/above market makes no
      // claim rather than an inverted one.
      marketValue: p.marketValue == null ? null : Number(p.marketValue),
      marketSavings:
        p.marketValue == null || Number(p.marketValue) <= Number(p.basePrice)
          ? null
          : Math.round((Number(p.marketValue) - Number(p.basePrice)) * 100) / 100,
      marketSavingsPct:
        p.marketValue == null || Number(p.marketValue) <= Number(p.basePrice)
          ? null
          : Math.round(
              ((Number(p.marketValue) - Number(p.basePrice)) / Number(p.marketValue)) * 100
            ),
      contents: p.contents.map((c) => ({
        id: c.id,
        label: c.label,
        // Arabic label/unit so the Arabic checkout stops rendering its box
        // contents in English on the screen where the member commits money.
        labelAr: c.labelAr,
        quantity: c.quantity,
        unit: c.unit,
        unitAr: c.unitAr,
        // Ships once per cat vs once per household (multi-cat modules).
        perCat: c.perCat,
        // Whether this line can be customised (brand + flavor) in the box builder.
        selectable: !!c.selectableType,
      })),
    }));
  }

  /**
   * The box builder's data: every line of a plan, with — for the choosable
   * lines (food/litter/treats) — the brand + flavor options the member may
   * pick. In-stock supplier items come first; popular "to-source" options are
   * flagged honestly (R006). The plan's default product is marked `recommended`
   * so accepting the whole box is one tap (R002/R005). Price is unaffected —
   * the flat plan price covers any choice.
   */
  async box(planId: string) {
    const plan = await this.prisma.plan.findFirst({
      where: { id: planId, isActive: true },
      include: { contents: { orderBy: { label: "asc" } } },
    });
    if (!plan) throw new NotFoundException("Plan not found");

    const types = [
      ...new Set(plan.contents.map((c) => c.selectableType).filter((t): t is ProductType => !!t)),
    ];
    const products = types.length
      ? await this.prisma.product.findMany({
          where: { type: { in: types }, isActive: true, isSubscribable: true, deletedAt: null },
          include: { brand: { select: { nameEn: true, nameAr: true } } },
        })
      : [];

    const byType = new Map<ProductType, typeof products>();
    for (const p of products) {
      const arr = byType.get(p.type) ?? [];
      arr.push(p);
      byType.set(p.type, arr);
    }
    const rank = (s: string) => (s === "IN_STOCK" ? 0 : 1);

    // The guided picker's facets, derived from the catalog's own naming (the
    // supplier sheet and researched options both encode these in names/flavors)
    // — no schema change needed. Unknown → ADULT / regular formula.
    const textOf = (p: (typeof products)[number]) =>
      `${p.nameEn} ${p.flavorEn ?? ""} ${p.searchKeywords ?? ""}`.toLowerCase();
    const stageOf = (p: (typeof products)[number]): "KITTEN" | "ADULT" | "SENIOR" => {
      const t = textOf(p);
      if (/kitten|هريرة/.test(t)) return "KITTEN";
      if (/senior|كبار/.test(t)) return "SENIOR";
      return "ADULT";
    };
    const sterilizedOf = (p: (typeof products)[number]): boolean =>
      /sterili[sz]ed|معق/.test(textOf(p));

    return {
      planId: plan.id,
      tier: plan.tier,
      lines: plan.contents.map((c) => {
        const selectable = !!c.selectableType;
        const options = selectable
          ? (byType.get(c.selectableType as ProductType) ?? [])
              .slice()
              .sort(
                (a, b) =>
                  rank(a.sourcing) - rank(b.sourcing) ||
                  (a.brand?.nameEn ?? a.nameEn).localeCompare(b.brand?.nameEn ?? b.nameEn) ||
                  (a.flavorEn ?? "").localeCompare(b.flavorEn ?? "")
              )
              .map((p) => ({
                productId: p.id,
                brandEn: p.brand?.nameEn ?? p.nameEn,
                brandAr: p.brand?.nameAr ?? p.nameAr,
                flavorEn: p.flavorEn,
                flavorAr: p.flavorAr,
                inStock: p.sourcing === "IN_STOCK",
                recommended: p.id === c.productId,
                // Guided-picker facets (life stage → sterilised → brand → flavor).
                lifeStage: stageOf(p),
                sterilized: sterilizedOf(p),
              }))
          : undefined;
        return {
          contentId: c.id,
          label: c.label,
          quantity: c.quantity,
          unit: c.unit,
          selectable,
          defaultProductId: c.productId ?? null,
          options,
        };
      }),
    };
  }
}
