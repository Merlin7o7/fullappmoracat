import { BadRequestException } from "@nestjs/common";
import { findSaudiCity } from "@moraqat/core";
import type { PrismaService } from "../prisma/prisma.service";
import { vetError } from "./guards/vet-staff.guard";

/**
 * A branch knows its city two ways: `cityCode` (the census list — anywhere in
 * the Kingdom, what the directory search and the public page read) and `cityId`
 * (the DELIVERY city table — Riyadh and Jeddah today). Writing only one of them
 * is how the live clinic ended up with no city at all and vanished from every
 * city search. So every write goes through here and both fields agree:
 *
 *   - a census code also links the delivery city when one exists (slug === code);
 *   - a delivery-city id also stamps its census code.
 *
 * Returns only the fields to write (empty when the caller sent neither).
 */
export async function resolveBranchCity(
  prisma: PrismaService,
  input: { cityCode?: string | null; cityId?: string | null }
): Promise<{ cityCode?: string | null; cityId?: string | null }> {
  if (input.cityCode !== undefined && input.cityCode !== null) {
    const census = findSaudiCity(input.cityCode);
    if (!census) {
      throw new BadRequestException(vetError("VET_CITY_UNKNOWN", "Unknown city.", { cityCode: input.cityCode }));
    }
    const delivery = await prisma.city.findUnique({ where: { slug: census.code }, select: { id: true } });
    return { cityCode: census.code, cityId: input.cityId ?? delivery?.id ?? null };
  }
  if (input.cityId) {
    const city = await prisma.city.findUnique({ where: { id: input.cityId }, select: { slug: true } });
    if (!city) throw new BadRequestException(vetError("VET_CITY_UNKNOWN", "Unknown city.", { cityId: input.cityId }));
    return { cityId: input.cityId, cityCode: findSaudiCity(city.slug)?.code ?? null };
  }
  if (input.cityId === null || input.cityCode === null) return { cityId: null, cityCode: null };
  return {};
}
