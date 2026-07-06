import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join, dirname } from "node:path";

/** Allowed image types → file extension. */
const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Object storage — Cloudflare R2 (S3-compatible) in production, with a local
 * `.uploads` dev fallback so development works without cloud credentials.
 *
 * The prod path never touches local disk (Render's disk is ephemeral). The dev
 * fallback exists only so contributors can exercise uploads locally; it logs a
 * warning and is served via the /uploads static route. Swappable to S3/MinIO —
 * it's the standard S3 API.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger("Storage");
  private client?: S3Client;

  private get bucket(): string {
    return process.env.S3_BUCKET || "moracat-media";
  }

  /** Non-secret config summary for diagnostics (safe to expose briefly). */
  configSummary() {
    const host = (u?: string) => {
      try {
        return u ? new URL(u).host : null;
      } catch {
        return "invalid";
      }
    };
    const ak = process.env.S3_ACCESS_KEY ?? "";
    return {
      configured: this.isConfigured(),
      bucket: this.bucket,
      endpointHost: host(process.env.S3_ENDPOINT),
      publicHost: host(process.env.S3_PUBLIC_URL),
      accessKeyTail: ak ? ak.slice(-6) : null,
      region: process.env.S3_REGION ?? null,
      nodeEnv: process.env.NODE_ENV ?? null,
    };
  }

  /** Write → read-back → public-fetch round trip, for diagnosing prod uploads. */
  async selfTest() {
    if (!this.isConfigured()) return { configured: false };
    const key = `_selftest/${randomBytes(8).toString("hex")}.txt`;
    const out: Record<string, unknown> = { bucket: this.bucket, key };
    try {
      await this.s3().send(
        new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: "selftest", ContentType: "text/plain" })
      );
      out.put = true;
    } catch (e) {
      out.put = false;
      out.putError = (e as Error).name;
      return out;
    }
    try {
      const g = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      out.getOk = true;
      out.body = await g.Body?.transformToString();
    } catch (e) {
      out.getOk = false;
      out.getError = (e as Error).name;
    }
    const publicUrl = this.publicUrl(key);
    out.publicUrl = publicUrl;
    try {
      const r = await fetch(publicUrl);
      out.publicStatus = r.status;
    } catch {
      out.publicStatus = "fetch-error";
    }
    try {
      await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch {
      /* best effort */
    }
    return out;
  }

  /** True when real object storage is configured (else dev-local fallback). */
  isConfigured(): boolean {
    return Boolean(
      process.env.S3_ENDPOINT &&
        process.env.S3_ACCESS_KEY &&
        process.env.S3_SECRET_KEY &&
        process.env.S3_BUCKET
    );
  }

  private s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: process.env.S3_REGION || "auto",
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true, // R2 + custom endpoints want path-style addressing
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY as string,
          secretAccessKey: process.env.S3_SECRET_KEY as string,
        },
      });
    }
    return this.client;
  }

  /** Extension for an allowed image mime, or null if unsupported. */
  imageExt(mime: string): string | null {
    return IMAGE_EXT[mime] ?? null;
  }

  /** Build a unique, unguessable object key under a prefix. */
  buildKey(prefix: string, ext: string): string {
    return `${prefix}/${randomBytes(12).toString("hex")}.${ext}`;
  }

  /** Store bytes and return the public URL. */
  async upload(key: string, body: Buffer, contentType: string): Promise<string> {
    if (this.isConfigured()) {
      await this.s3().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: "public, max-age=31536000, immutable",
        })
      );
      return this.publicUrl(key);
    }

    // Never fall back to local disk in production: the returned URL would point
    // at the API host's ephemeral disk (and defaults to localhost), producing an
    // unreachable image → a broken "?" on every device. Fail loudly instead so
    // the client shows a clear error rather than storing a dead URL.
    if (process.env.NODE_ENV === "production") {
      this.logger.error("Upload attempted but object storage (S3_*) is not configured.");
      throw new ServiceUnavailableException("Image storage is not configured");
    }

    // ── Dev-only local fallback ──────────────────────────────────────────
    const abs = join(process.cwd(), ".uploads", key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);
    this.logger.warn(`Stored locally (dev): ${key} — set S3_* for production R2.`);
    return `${this.apiBase()}/uploads/${key}`;
  }

  /** Delete an object by key or by a URL we previously issued. Best-effort. */
  async remove(urlOrKey: string): Promise<void> {
    const key = this.keyFromUrl(urlOrKey);
    if (!key) return;
    try {
      if (this.isConfigured()) {
        await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      } else {
        await unlink(join(process.cwd(), ".uploads", key));
      }
    } catch (err) {
      this.logger.warn(`Failed to remove ${key}: ${(err as Error).message}`);
    }
  }

  publicUrl(key: string): string {
    const base = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
    if (base) return `${base}/${key}`;
    // Falls back to the raw S3 path (public only if the bucket is public).
    const endpoint = process.env.S3_ENDPOINT?.replace(/\/$/, "") ?? "";
    return `${endpoint}/${this.bucket}/${key}`;
  }

  /** Only delete objects we own (under our known prefixes / hosts). */
  private keyFromUrl(u: string): string | null {
    if (!u) return null;
    if (!u.startsWith("http")) return u; // already a bare key
    try {
      let path = new URL(u).pathname.replace(/^\//, "");
      if (path.startsWith("uploads/")) path = path.slice("uploads/".length);
      else if (path.startsWith(`${this.bucket}/`)) path = path.slice(this.bucket.length + 1);
      // Only manage our own namespaces (avoids deleting e.g. Google avatar URLs).
      return path.startsWith("cats/") || path.startsWith("users/") ? path : null;
    } catch {
      return null;
    }
  }

  private apiBase(): string {
    return (
      process.env.API_BASE_URL ||
      `http://localhost:${process.env.PORT ?? process.env.API_PORT ?? 4000}`
    );
  }
}
