import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { StorageService } from "../storage/storage.service";

/**
 * Short-lived, signed download links for PRIVATE objects (T12, T9).
 *
 * Medical images and certificates live under `private/` and are never public
 * URLs. An authorised read (owner route, clinic route with consent + access
 * log) mints a token that names the object, its type and an expiry; the file
 * route only checks the signature and streams. The authorisation decision and
 * the access-ledger entry always happen where the token is minted — never here.
 */
export interface FileToken {
  /** Private object key (private/…). */
  k: string;
  /** Content type to serve. */
  m: string;
  /** Download name. */
  n: string;
  /** Expiry, epoch seconds. */
  e: number;
}

const DEFAULT_TTL_SEC = 5 * 60;

@Injectable()
export class FilesService {
  constructor(private readonly storage: StorageService) {}

  private secret(): string {
    return process.env.JWT_ACCESS_SECRET ?? "dev-files-secret";
  }

  private sign(payload: string): string {
    return createHmac("sha256", this.secret()).update(payload).digest("base64url");
  }

  mint(input: { key: string; mime: string; fileName: string; ttlSec?: number }): string {
    if (!input.key.startsWith("private/")) throw new Error("Only private objects get file tokens");
    const body: FileToken = {
      k: input.key,
      m: input.mime,
      n: input.fileName,
      e: Math.floor(Date.now() / 1000) + (input.ttlSec ?? DEFAULT_TTL_SEC),
    };
    const payload = Buffer.from(JSON.stringify(body)).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  /** Absolute URL the browser can open (no auth header needed — the token is the grant). */
  urlFor(token: string): string {
    return `${apiBase()}/api/files/${token}`;
  }

  /** Mint + URL in one go, for routes that return `{ url }`. */
  linkFor(input: { key: string; mime: string; fileName: string; ttlSec?: number }): string {
    return this.urlFor(this.mint(input));
  }

  async open(token: string): Promise<{ buffer: Buffer; mime: string; fileName: string }> {
    const dot = token.lastIndexOf(".");
    if (dot <= 0 || token.length > 2048) throw new UnauthorizedException("Bad file token");
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expected = this.sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException("Bad file token");
    let body: FileToken;
    try {
      body = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as FileToken;
    } catch {
      throw new UnauthorizedException("Bad file token");
    }
    if (!body.k?.startsWith("private/") || body.e < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException("File link expired");
    }
    try {
      const buffer = await this.storage.getPrivate(body.k);
      return { buffer, mime: body.m || "application/octet-stream", fileName: body.n || "file" };
    } catch {
      throw new NotFoundException("File not found");
    }
  }
}

export function apiBase(): string {
  // Production sets API_BASE_URL (the Tamara adapter already relies on it); the
  // other two names are accepted so local/dev envs keep working unchanged.
  const base = process.env.API_PUBLIC_URL || process.env.API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";
  return base.replace(/\/+$/, "");
}
