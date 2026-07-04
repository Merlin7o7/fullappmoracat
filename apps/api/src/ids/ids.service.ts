import { Injectable } from "@nestjs/common";
import { randomInt } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Centralized identity issuance (#4). One place mints every permanent, unique,
 * immutable, human-readable number in the platform:
 *   • Member ID  — MRC-M-XXXXXX   (the customer)
 *   • Cat ID     — MRC-XXXX-XXXX  (the cat; unchanged format for continuity)
 *   • QR token   — opaque, revocable secret behind the Cat ID card QR (#2)
 *
 * Alphabet excludes 0/O/1/I/L so a number can be read aloud without ambiguity.
 * Uniqueness is enforced by a DB round-trip + retry; the address space (31^n)
 * makes collisions astronomically rare, so this scales to millions.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function pick(n: number): string {
  return Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

@Injectable()
export class IdsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Permanent Member ID, e.g. `MRC-M-7Q4K2P`. */
  async newMemberId(): Promise<string> {
    return this.unique(
      () => `MRC-M-${pick(6)}`,
      async (candidate) =>
        !(await this.prisma.user.findUnique({
          where: { memberIdNumber: candidate },
          select: { id: true },
        }))
    );
  }

  /** Permanent Cat ID, e.g. `MRC-D7Y9-X5CW`. */
  async newCatId(): Promise<string> {
    return this.unique(
      () => `MRC-${pick(4)}-${pick(4)}`,
      async (candidate) =>
        !(await this.prisma.cat.findUnique({
          where: { catIdNumber: candidate },
          select: { id: true },
        }))
    );
  }

  /** Opaque QR verification token (not human-facing) — 20 chars of entropy. */
  async newQrToken(): Promise<string> {
    return this.unique(
      () => pick(20),
      async (candidate) =>
        !(await this.prisma.cat.findUnique({
          where: { qrToken: candidate },
          select: { id: true },
        }))
    );
  }

  private async unique(gen: () => string, isFree: (c: string) => Promise<boolean>): Promise<string> {
    for (let i = 0; i < 6; i++) {
      const candidate = gen();
      if (await isFree(candidate)) return candidate;
    }
    // Six collisions in a row across a 31^n space is effectively impossible.
    throw new Error("Could not allocate a unique identifier");
  }
}
